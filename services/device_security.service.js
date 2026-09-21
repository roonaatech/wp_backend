const db = require("../models");
const EmployeeDevice = db.employee_devices;
const DeviceViolationLog = db.device_violation_logs;
const User = db.user;
const Role = db.roles;
const Setting = db.settings;
const emailService = require("../utils/email.service");
const { Op } = db.Sequelize;

/**
 * Single Device Security Service
 * Enforces 1 Mobile Device per Employee and detects cross-employee proxy attendance attempts
 */
class DeviceSecurityService {

    /**
     * Helper to detect whether a request is from a Mobile Client (Mobile App or Mobile Browser)
     * @param {Object} params
     * @param {string} [params.userAgent]
     * @param {boolean|string} [params.isMobile]
     * @param {boolean|string} [params.isMobileApp]
     * @returns {boolean}
     */
    isMobileClient({ userAgent = '', isMobile, isMobileApp = false } = {}) {
        if (isMobileApp === true || isMobileApp === 'true') return true;
        if (isMobile === true || isMobile === 'true') return true;
        if (isMobile === false || isMobile === 'false') return false;

        if (!userAgent) return false;
        // Regex checking for Android, iPhone, iPad, iPod, BlackBerry, Opera Mini, Mobile, okhttp, Expo, WorkPulseApp
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|okhttp|Expo|WorkPulseApp/i;
        return mobileRegex.test(userAgent);
    }

    /**
     * Verify device authorization and update/bind device for the employee
     * @param {Object} params
     * @param {number} params.staffId - Employee staff ID
     * @param {string} params.deviceId - Unique device UUID/fingerprint from client
     * @param {string} [params.deviceName] - Device model / browser (e.g., "iPhone 15 / Safari")
     * @param {string} [params.userAgent] - Browser User-Agent
     * @param {string} [params.ipAddress] - Request IP address
     * @param {boolean|string} [params.isMobile] - Explicit mobile flag
     * @param {boolean|string} [params.isMobileApp] - Mobile app flag
     * @param {string} [params.action] - Action being performed (e.g. 'ATTENDANCE_BADGE', 'FACE_ATTENDANCE')
     * @returns {Promise<{ allowed: boolean, error?: string, violationLogged?: boolean, isDesktop?: boolean }>}
     */
    async verifyAndBindDevice({ staffId, deviceId, deviceName, userAgent, ipAddress, action = 'ATTENDANCE_BADGE', isMobile, isMobileApp }) {
        if (!staffId) {
            return { allowed: false, error: "Staff ID is required for device verification." };
        }

        // Strict Requirement: Single-Device Security Binding & Anti-Proxy rules ONLY apply to mobile clients (mobile app / mobile browser).
        // Laptop / desktop browser logins (PC, Mac, Linux) MUST NEVER be blocked and MUST NEVER trigger security violations.
        const isMobileDevice = this.isMobileClient({ userAgent, isMobile, isMobileApp });
        if (!isMobileDevice) {
            return { allowed: true, isDesktop: true };
        }

        // If no deviceId provided (e.g. desktop non-mobile browser call without fingerprint), allow
        if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
            return { allowed: true };
        }

        const cleanDeviceId = deviceId.trim();

        try {
            // 1. Check if this deviceId is actively registered to a DIFFERENT employee
            const conflictDevice = await EmployeeDevice.findOne({
                where: {
                    device_id: cleanDeviceId,
                    staff_id: { [Op.ne]: staffId },
                    is_active: true
                }
            });

            if (conflictDevice) {
                // Fetch attempting user and original bound user details
                const [attemptingUser, boundUser] = await Promise.all([
                    User.findOne({ where: { staffid: staffId }, attributes: ['staffid', 'firstname', 'lastname', 'email', 'role'] }),
                    User.findOne({ where: { staffid: conflictDevice.staff_id }, attributes: ['staffid', 'firstname', 'lastname', 'email', 'role'] })
                ]);

                const attemptingName = attemptingUser ? `${attemptingUser.firstname} ${attemptingUser.lastname}` : `Staff #${staffId}`;
                const boundName = boundUser ? `${boundUser.firstname} ${boundUser.lastname}` : `Staff #${conflictDevice.staff_id}`;

                console.warn(`[SECURITY ALERT] Proxy attendance attempt detected! Device ${cleanDeviceId} is bound to ${boundName} (ID: ${conflictDevice.staff_id}), but was used by ${attemptingName} (ID: ${staffId}).`);

                // 2. Log violation in database
                const violationRecord = await DeviceViolationLog.create({
                    attempted_staff_id: staffId,
                    bound_staff_id: conflictDevice.staff_id,
                    device_id: cleanDeviceId,
                    device_name: deviceName || conflictDevice.device_name || 'Mobile Device',
                    ip_address: ipAddress || 'Unknown',
                    violation_type: 'PROXY_ATTENDANCE_DEVICE_CONFLICT',
                    details: JSON.stringify({
                        action,
                        attempted_user: {
                            staff_id: staffId,
                            name: attemptingName,
                            email: attemptingUser?.email
                        },
                        bound_user: {
                            staff_id: conflictDevice.staff_id,
                            name: boundName,
                            email: boundUser?.email
                        },
                        user_agent: userAgent,
                        detected_at: new Date()
                    }),
                    status: 'REPORTED'
                });

                // 3. Dispatch urgent email notification to HR & Admins asynchronously
                this.notifyHrOfDeviceViolation({
                    violationId: violationRecord.id,
                    attemptingUser,
                    boundUser,
                    deviceId: cleanDeviceId,
                    deviceName: deviceName || conflictDevice.device_name || 'Mobile Device',
                    ipAddress,
                    action,
                    detectedAt: new Date()
                }).catch(emailErr => {
                    console.error("[DeviceSecurityService] Failed to send HR violation email:", emailErr);
                });

                return {
                    allowed: false,
                    error: `Security Violation: This mobile device is registered to another employee (${boundName}). Attendance generation has been blocked and this incident has been reported to HR.`,
                    violationLogged: true,
                    violationId: violationRecord.id
                };
            }

            // 2. Check if current employee already has this device registered
            const existingDeviceForUser = await EmployeeDevice.findOne({
                where: {
                    staff_id: staffId,
                    device_id: cleanDeviceId
                }
            });

            const now = new Date();

            if (existingDeviceForUser) {
                // Update active status and last active time
                await existingDeviceForUser.update({
                    is_active: true,
                    last_active_at: now,
                    ip_address: ipAddress || existingDeviceForUser.ip_address,
                    device_name: deviceName || existingDeviceForUser.device_name,
                    user_agent: userAgent || existingDeviceForUser.user_agent
                });

                // Ensure any OTHER devices for this employee are deactivated (Single Device Rule)
                await EmployeeDevice.update(
                    { is_active: false },
                    {
                        where: {
                            staff_id: staffId,
                            device_id: { [Op.ne]: cleanDeviceId },
                            is_active: true
                        }
                    }
                );
            } else {
                // Employee is using a new phone/device for the first time
                // Deactivate old devices for this employee
                await EmployeeDevice.update(
                    { is_active: false },
                    {
                        where: {
                            staff_id: staffId,
                            is_active: true
                        }
                    }
                );

                // Register the new device as active
                await EmployeeDevice.create({
                    staff_id: staffId,
                    device_id: cleanDeviceId,
                    device_name: deviceName || 'Mobile Device',
                    user_agent: userAgent || '',
                    ip_address: ipAddress || '',
                    first_bound_at: now,
                    last_active_at: now,
                    is_active: true
                });

                console.log(`[DeviceSecurityService] Bound new device ${cleanDeviceId} to employee ID: ${staffId}`);
            }

            return { allowed: true };

        } catch (err) {
            console.error("[DeviceSecurityService] Error during device verification:", err);
            // On unexpected internal DB error, allow request to avoid locking out legitimate users due to DB blips
            return { allowed: true, warning: err.message };
        }
    }

    /**
     * Dispatch urgent security violation alert to HR & Admins
     */
    async notifyHrOfDeviceViolation({ violationId, attemptingUser, boundUser, deviceId, deviceName, ipAddress, action, detectedAt }) {
        try {
            // Find all HR & Admin recipients (hierarchy level 0 or 1, or HR roles)
            const hrRoles = await Role.findAll({
                where: {
                    [Op.or]: [
                        { hierarchy_level: { [Op.lte]: 1 } },
                        { name: { [Op.like]: '%hr%' } },
                        { display_name: { [Op.like]: '%hr%' } },
                        { can_manage_users: true }
                    ]
                },
                attributes: ['id']
            });

            const roleIds = hrRoles.map(r => r.id);

            const hrAdmins = await User.findAll({
                where: {
                    role: { [Op.in]: roleIds },
                    active: 1
                },
                attributes: ['email', 'firstname', 'lastname']
            });

            const recipientEmails = hrAdmins.map(u => u.email).filter(Boolean);

            // Also check for a global notification email setting
            const hrEmailSetting = await Setting.findOne({ where: { key: 'hr_notification_email' } });
            if (hrEmailSetting && hrEmailSetting.value && !recipientEmails.includes(hrEmailSetting.value)) {
                recipientEmails.push(hrEmailSetting.value);
            }

            if (recipientEmails.length === 0) {
                console.warn("[DeviceSecurityService] No HR or Admin emails found to send device violation alert.");
                return;
            }

            const attemptingName = attemptingUser ? `${attemptingUser.firstname} ${attemptingUser.lastname}` : 'Unknown';
            const attemptingEmail = attemptingUser?.email || 'N/A';
            const boundName = boundUser ? `${boundUser.firstname} ${boundUser.lastname}` : 'Unknown';
            const boundEmail = boundUser?.email || 'N/A';
            const formattedTime = new Date(detectedAt).toLocaleString('en-US', { timeZoneName: 'short' });

            const subject = `⚠️ [WorkPulse Security Alert] Proxy Attendance Attempt Detected - Device Conflict (#${violationId})`;

            const htmlBody = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 16px; color: #1e293b;">
                    
                    <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 20px 24px; border-radius: 12px; color: #ffffff; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2);">
                        <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">🚨 Proxy Attendance Violation Alert</h2>
                        <p style="margin: 0; font-size: 13px; opacity: 0.9;">A mobile device registered to one employee was used to attempt attendance for another employee.</p>
                    </div>

                    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Incident Details</h3>
                        
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 10px 0; color: #64748b; width: 40%;"><strong>Attempting Employee:</strong></td>
                                <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">
                                    ${attemptingName} (Staff ID: ${attemptingUser?.staffid || 'N/A'})<br>
                                    <span style="color: #64748b; font-size: 12px;">${attemptingEmail}</span>
                                </td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 10px 0; color: #64748b;"><strong>Device Registered Owner:</strong></td>
                                <td style="padding: 10px 0; color: #dc2626; font-weight: 600;">
                                    ${boundName} (Staff ID: ${boundUser?.staffid || 'N/A'})<br>
                                    <span style="color: #64748b; font-size: 12px;">${boundEmail}</span>
                                </td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 10px 0; color: #64748b;"><strong>Action Attempted:</strong></td>
                                <td style="padding: 10px 0; color: #0f172a;">${action}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 10px 0; color: #64748b;"><strong>Device Model:</strong></td>
                                <td style="padding: 10px 0; color: #0f172a;">${deviceName}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 10px 0; color: #64748b;"><strong>IP Address:</strong></td>
                                <td style="padding: 10px 0; color: #0f172a;">${ipAddress || 'Unknown'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #64748b;"><strong>Timestamp:</strong></td>
                                <td style="padding: 10px 0; color: #0f172a;">${formattedTime}</td>
                            </tr>
                        </table>
                    </div>

                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; font-size: 13px; color: #991b1b; line-height: 1.5; margin-bottom: 24px;">
                        <strong>Action Taken:</strong> The attendance / badge request was <strong>automatically blocked</strong>. Both accounts have been flagged in the audit system for review.
                    </div>

                    <p style="text-align: center; font-size: 12px; color: #94a3b8; margin: 0;">
                        WorkPulse Automated Security Defense System &bull; Confidential
                    </p>
                </div>
            `;

            for (const email of recipientEmails) {
                await emailService.sendEmail(email, subject, htmlBody);
            }

            console.log(`[DeviceSecurityService] Dispatched violation email to ${recipientEmails.length} recipients: ${recipientEmails.join(', ')}`);

        } catch (err) {
            console.error("[DeviceSecurityService] Error in notifyHrOfDeviceViolation:", err);
        }
    }

    /**
     * Reset device binding for an employee (Admin action)
     * @param {number} staffId - Target employee
     * @param {number} adminId - Administrator performing reset
     * @param {string} [reason] - Reason for reset
     */
    async resetEmployeeDeviceBinding(staffId, adminId, reason = 'Administrator reset') {
        const updated = await EmployeeDevice.update(
            { is_active: false },
            { where: { staff_id: staffId, is_active: true } }
        );

        console.log(`[DeviceSecurityService] Admin ${adminId} reset device bindings for employee ${staffId}. Reason: ${reason}`);
        return { success: true, count: updated[0] };
    }
}

module.exports = new DeviceSecurityService();
