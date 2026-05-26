const db = require("../models");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");
const emailService = require("../utils/email.service");

const User = db.user;
const Role = db.roles;
const LeaveType = db.leave_types;
const UserLeaveType = db.user_leave_types;
const EmployeeProfile = db.employee_profiles;
const EmployeeEducation = db.employee_educations;
const EmployeeExperience = db.employee_experiences;
const EmployeeFamilyMember = db.employee_family_members;
const EmployeeDocument = db.employee_documents;
const Op = db.Sequelize.Op;

// Helper to get error message
const getErrorMessage = (err) => {
    if (err.name === "SequelizeValidationError" || err.name === "SequelizeUniqueConstraintError") {
        return err.errors.map(e => `${e.path}: ${e.message}`).join(", ");
    }
    return err.message || "Some error occurred during the operation.";
};

/**
 * Onboard a new employee with core credentials and extended joining form data
 * POST /api/onboarding/employee
 */
exports.onboardEmployee = async (req, res) => {
    const {
        // User Credentials
        firstname, lastname, email, secondary_email, password, role, approving_manager_id, gender, abis_access, send_welcome_email,
        
        // Personal Details
        birthplace, height_weight, blood_group, date_of_birth, age, has_disability, disability_details,
        marital_status, no_of_children, hobbies, nationality, religion,
        
        // Addresses
        present_address, present_contact_no, permanent_address, permanent_contact_no,
        
        // Family Details
        father_name, father_age, father_occupation, father_work_status,
        mother_name, mother_age, mother_occupation,
        
        // Bank details
        bank_account_number, bank_ifsc_code, bank_name_address,
        
        // Consent & Signature Details
        consent_given, signature_name, onboarding_place, signature_data,
        
        // List data arrays (JSON stringified)
        educations, experiences, family_members
    } = req.body;

    // 1. Basic Field Validations
    if (!firstname || !lastname || !email || !password || !role || !gender || !date_of_birth) {
        return res.status(400).send({
            message: "Firstname, lastname, email, password, role, gender, and date of birth are required."
        });
    }

    const roleInt = parseInt(role);
    if (isNaN(roleInt) || roleInt === 0) {
        return res.status(400).send({ message: "Invalid Role value." });
    }

    // Begin sequelize transaction
    const transaction = await db.sequelize.transaction();

    try {
        // Validate role assignment hierarchy (HR context)
        const newRole = await Role.findByPk(roleInt);
        if (!newRole) {
            await transaction.rollback();
            return res.status(400).send({ message: "Invalid role specified." });
        }

        // Hierarchy check: prevent onboarding of higher hierarchy roles
        const callerUser = await User.findByPk(req.userId);
        const callerRole = callerUser ? await Role.findByPk(callerUser.role) : null;
        if (callerRole && newRole.hierarchy_level < callerRole.hierarchy_level) {
            await transaction.rollback();
            return res.status(403).send({
                message: "You do not have permission to onboard higher hierarchy roles."
            });
        }

        // Validate unique email
        const existingUser = await User.findOne({ where: { email: email } });
        if (existingUser) {
            await transaction.rollback();
            return res.status(409).send({ message: "Email already exists." });
        }

        // Hash password
        const hashedPassword = bcrypt.hashSync(password, 8);

        // Create basic user
        const user = await User.create({
            firstname,
            lastname,
            email,
            secondary_email: secondary_email || null,
            password: hashedPassword,
            role: roleInt,
            approving_manager_id: approving_manager_id ? parseInt(approving_manager_id) : null,
            gender: gender,
            abis_access: abis_access === 'true' || abis_access === true,
            active: 1
        }, { transaction });

        // 2. Decode and save signature image if present
        let signaturePath = null;
        if (signature_data) {
            const dir = "uploads/signatures";
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const base64Data = signature_data.replace(/^data:image\/png;base64,/, "");
            signaturePath = `${dir}/sig-${user.staffid}-${Date.now()}.png`;
            fs.writeFileSync(signaturePath, base64Data, "base64");
        }

        // Calculate age from date_of_birth
        let calculatedAge = age ? parseInt(age) : null;
        if (date_of_birth) {
            const birthDate = new Date(date_of_birth);
            const today = new Date();
            let ageVal = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                ageVal--;
            }
            calculatedAge = ageVal;
        }

        // Create Extended Employee Profile
        await EmployeeProfile.create({
            staff_id: user.staffid,
            birthplace,
            height_weight,
            blood_group,
            date_of_birth: date_of_birth || null,
            age: calculatedAge,
            has_disability: has_disability === 'true' || has_disability === true,
            disability_details: disability_details || null,
            marital_status,
            no_of_children: no_of_children ? parseInt(no_of_children) : 0,
            hobbies,
            nationality,
            religion,
            present_address,
            present_contact_no,
            permanent_address,
            permanent_contact_no,
            father_name,
            father_age: father_age ? parseInt(father_age) : null,
            father_occupation,
            father_work_status,
            mother_name,
            mother_age: mother_age ? parseInt(mother_age) : null,
            mother_occupation,
            bank_account_number,
            bank_ifsc_code,
            bank_name_address,
            consent_given: consent_given === 'true' || consent_given === true,
            signature_name,
            signature_path: signaturePath,
            signature_date: new Date(),
            onboarding_place
        }, { transaction });

        // 3. Process dynamic list arrays
        if (educations) {
            const eduList = typeof educations === "string" ? JSON.parse(educations) : educations;
            if (eduList && eduList.length > 0) {
                const eduData = eduList.map(edu => ({
                    staff_id: user.staffid,
                    qualification: edu.qualification,
                    specialization: edu.specialization || null,
                    grade: edu.grade || null,
                    university_city: edu.university_city || null,
                    year_of_completion: edu.year_of_completion ? parseInt(edu.year_of_completion) : null
                }));
                await EmployeeEducation.bulkCreate(eduData, { transaction });
            }
        }

        if (experiences) {
            const expList = typeof experiences === "string" ? JSON.parse(experiences) : experiences;
            if (expList && expList.length > 0) {
                const expData = expList.map(exp => ({
                    staff_id: user.staffid,
                    post_held: exp.post_held,
                    department_function: exp.department_function || null,
                    company_name: exp.company_name,
                    city: exp.city || null,
                    tenure: exp.tenure || null
                }));
                await EmployeeExperience.bulkCreate(expData, { transaction });
            }
        }

        if (family_members) {
            const famList = typeof family_members === "string" ? JSON.parse(family_members) : family_members;
            if (famList && famList.length > 0) {
                const famData = famList.map(fam => ({
                    staff_id: user.staffid,
                    name: fam.name,
                    relationship: fam.relationship || "Brother",
                    work_status: fam.work_status || null,
                    educational_status: fam.educational_status || null,
                    marital_status: fam.marital_status || null,
                    residing_in: fam.residing_in || null
                }));
                await EmployeeFamilyMember.bulkCreate(famData, { transaction });
            }
        }

        // 4. File attachments uploads
        if (req.files && req.files.length > 0) {
            const docsToCreate = req.files.map(file => {
                const docType = file.fieldname.replace(/^doc_/, "");
                return {
                    staff_id: user.staffid,
                    document_type: docType,
                    file_name: file.originalname,
                    file_path: file.path,
                    file_size: file.size
                };
            });
            await EmployeeDocument.bulkCreate(docsToCreate, { transaction });
        }

        // Commit transaction
        await transaction.commit();

        // Log administrative action
        await logActivity({
            admin_id: req.userId,
            action: "CREATE",
            entity: "UserOnboarding",
            entity_id: user.staffid,
            affected_user_id: user.staffid,
            description: `Onboarded new employee ${user.firstname} ${user.lastname} and created extended joining profile`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        // Send Welcome Email if requested
        if (send_welcome_email === 'true' || send_welcome_email === true) {
            try {
                const appUrl = req.headers.origin || "http://localhost:5173";
                const emailSubject = "Welcome to WorkPulse - Complete Your Profile Activation";
                const emailBody = `
                    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #f1f5f9; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); background-color: #ffffff;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #4f46e5; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.05em;">WorkPulse</h1>
                            <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Your Employee Management & Collaboration Hub</p>
                        </div>
                        <div style="background-color: #faf5ff; border: 1px solid #f3e8ff; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                            <h2 style="color: #581c87; margin-top: 0; font-size: 18px; font-weight: 700;">Welcome to the Team, ${firstname}!</h2>
                            <p style="color: #6b21a8; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
                                Your employee profile has been successfully initialized by Human Resources. To activate your account, you must complete your profile audit, sign the employment declaration, and set your new password.
                            </p>
                        </div>
                        <div style="margin-bottom: 25px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
                            <h3 style="color: #1e293b; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Your Temporary Login Credentials</h3>
                            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b; width: 120px; font-weight: 500;">Primary Email:</td>
                                    <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${email}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Temp Password:</td>
                                    <td style="padding: 6px 0; color: #e11d48; font-family: monospace; font-weight: 700; font-size: 15px;">${password}</td>
                                </tr>
                            </table>
                        </div>
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${appUrl}/login" style="background-color: #4f46e5; color: #ffffff; padding: 14px 30px; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.25); display: inline-block;">Log In & Activate Profile</a>
                        </div>
                        <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center; font-size: 11px; color: #94a3b8;">
                            <p style="margin: 0;">If you have any questions or require assistance, please contact the HR Department.</p>
                            <p style="margin: 5px 0 0;">WorkPulse Security Team © 2026</p>
                        </div>
                    </div>
                `;
                
                await emailService.sendEmail(email, emailSubject, emailBody);
            } catch (emailErr) {
                console.error("[EmailService] Failed to send welcome onboarding email:", emailErr);
            }
        }

        res.status(201).send({
            message: "Employee successfully onboarded.",
            staffid: user.staffid,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email
        });

    } catch (err) {
        console.error("Error onboarding employee:", err);
        await transaction.rollback();
        res.status(500).send({
            message: getErrorMessage(err)
        });
    }
};

/**
 * Get full extended profile of an employee including all joining form records
 * GET /api/onboarding/employee/:id
 */
exports.getEmployeeExtendedProfile = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await User.findByPk(id, {
            attributes: ['staffid', 'userid', 'firstname', 'lastname', 'email', 'secondary_email', 'role', 'active', 'approving_manager_id', 'gender', 'last_login', 'abis_access'],
            include: [
                { model: EmployeeProfile, as: 'profile_info' },
                { model: EmployeeEducation, as: 'educations' },
                { model: EmployeeExperience, as: 'experiences' },
                { model: EmployeeFamilyMember, as: 'family_members' },
                { model: EmployeeDocument, as: 'documents' }
            ]
        });

        if (!user) {
            return res.status(404).send({ message: "Employee not found." });
        }

        // Hierarchy check: prevent viewing higher hierarchy profiles
        const callerUser = await User.findByPk(req.userId);
        const callerRole = callerUser ? await Role.findByPk(callerUser.role) : null;
        const targetRole = await Role.findByPk(user.role);
        if (callerRole && targetRole && targetRole.hierarchy_level < callerRole.hierarchy_level) {
            return res.status(403).send({
                message: "Access denied. You do not have permission to view higher hierarchy profiles."
            });
        }

        res.status(200).send(user);

    } catch (err) {
        console.error("Error fetching employee extended profile:", err);
        res.status(500).send({ message: getErrorMessage(err) });
    }
};

/**
 * Update employee extended joining profile
 * PUT /api/onboarding/employee/:id
 */
exports.updateEmployeeExtendedProfile = async (req, res) => {
    const { id } = req.params;
    const {
        // User Credentials
        firstname, lastname, email, secondary_email, password, role, approving_manager_id, gender, active, abis_access,
        
        // Personal Details
        birthplace, height_weight, blood_group, date_of_birth, age, has_disability, disability_details,
        marital_status, no_of_children, hobbies, nationality, religion,
        
        // Addresses
        present_address, present_contact_no, permanent_address, permanent_contact_no,
        
        // Family Details
        father_name, father_age, father_occupation, father_work_status,
        mother_name, mother_age, mother_occupation,
        
        // Bank details
        bank_account_number, bank_ifsc_code, bank_name_address,
        
        // Consent & Signature Details
        consent_given, signature_name, onboarding_place, signature_data,
        
        // List data arrays
        educations, experiences, family_members
    } = req.body;

    const transaction = await db.sequelize.transaction();

    try {
        const user = await User.findByPk(id);
        if (!user) {
            await transaction.rollback();
            return res.status(404).send({ message: "Employee not found." });
        }

        // Hierarchy check: prevent editing higher hierarchy profiles
        const callerUser = await User.findByPk(req.userId);
        const callerRole = callerUser ? await Role.findByPk(callerUser.role) : null;
        const targetRole = await Role.findByPk(user.role);
        if (callerRole && targetRole && targetRole.hierarchy_level < callerRole.hierarchy_level) {
            await transaction.rollback();
            return res.status(403).send({
                message: "Access denied. You do not have permission to modify higher hierarchy profiles."
            });
        }

        // Validate basic fields
        if (!firstname || !lastname || !email || !role || !date_of_birth) {
            await transaction.rollback();
            return res.status(400).send({ message: "Firstname, lastname, email, role, and date of birth are required." });
        }

        const roleInt = parseInt(role);

        // Hierarchy check: prevent assigning a role of higher hierarchy
        const newRole = await Role.findByPk(roleInt);
        if (callerRole && newRole && newRole.hierarchy_level < callerRole.hierarchy_level) {
            await transaction.rollback();
            return res.status(403).send({
                message: "Access denied. You do not have permission to assign higher hierarchy roles."
            });
        }

        // Update core user
        const updateUserData = {
            firstname,
            lastname,
            email,
            secondary_email: secondary_email !== undefined ? secondary_email : user.secondary_email,
            role: roleInt,
            approving_manager_id: approving_manager_id ? parseInt(approving_manager_id) : null,
            gender,
            abis_access: abis_access !== undefined ? (abis_access === 'true' || abis_access === true) : user.abis_access,
            active: active !== undefined ? parseInt(active) : user.active
        };

        if (password) {
            updateUserData.password = bcrypt.hashSync(password, 8);
        }

        await user.update(updateUserData, { transaction });

        // Update profile
        let profile = await EmployeeProfile.findOne({ where: { staff_id: id } });

        // Decode and save signature image if present in edit
        let signaturePath = profile ? profile.signature_path : null;
        if (signature_data && signature_data.startsWith("data:image/png;base64,")) {
            const dir = "uploads/signatures";
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const base64Data = signature_data.replace(/^data:image\/png;base64,/, "");
            signaturePath = `${dir}/sig-${id}-${Date.now()}.png`;
            fs.writeFileSync(signaturePath, base64Data, "base64");
        }

        // Calculate age from date_of_birth
        let calculatedAge = age ? parseInt(age) : null;
        if (date_of_birth) {
            const birthDate = new Date(date_of_birth);
            const today = new Date();
            let ageVal = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                ageVal--;
            }
            calculatedAge = ageVal;
        }

        const profileData = {
            birthplace,
            height_weight,
            blood_group,
            date_of_birth: date_of_birth !== undefined ? date_of_birth : (profile ? profile.date_of_birth : null),
            age: calculatedAge,
            has_disability: has_disability === 'true' || has_disability === true,
            disability_details: disability_details || null,
            marital_status,
            no_of_children: no_of_children ? parseInt(no_of_children) : 0,
            hobbies,
            nationality,
            religion,
            present_address,
            present_contact_no,
            permanent_address,
            permanent_contact_no,
            father_name,
            father_age: father_age ? parseInt(father_age) : null,
            father_occupation,
            father_work_status,
            mother_name,
            mother_age: mother_age ? parseInt(mother_age) : null,
            mother_occupation,
            bank_account_number,
            bank_ifsc_code,
            bank_name_address,
            consent_given: consent_given === 'true' || consent_given === true,
            signature_name,
            signature_path: signaturePath,
            onboarding_place
        };

        if (profile) {
            await profile.update(profileData, { transaction });
        } else {
            await EmployeeProfile.create({
                staff_id: id,
                ...profileData,
                signature_date: new Date()
            }, { transaction });
        }

        // Update list arrays by replacing existing ones to avoid primary key collisions
        // 1. Qualifications
        await EmployeeEducation.destroy({ where: { staff_id: id }, transaction });
        if (educations) {
            const eduList = typeof educations === "string" ? JSON.parse(educations) : educations;
            if (eduList && eduList.length > 0) {
                const eduData = eduList.map(edu => ({
                    staff_id: id,
                    qualification: edu.qualification,
                    specialization: edu.specialization || null,
                    grade: edu.grade || null,
                    university_city: edu.university_city || null,
                    year_of_completion: edu.year_of_completion ? parseInt(edu.year_of_completion) : null
                }));
                await EmployeeEducation.bulkCreate(eduData, { transaction });
            }
        }

        // 2. Experiences
        await EmployeeExperience.destroy({ where: { staff_id: id }, transaction });
        if (experiences) {
            const expList = typeof experiences === "string" ? JSON.parse(experiences) : experiences;
            if (expList && expList.length > 0) {
                const expData = expList.map(exp => ({
                    staff_id: id,
                    post_held: exp.post_held,
                    department_function: exp.department_function || null,
                    company_name: exp.company_name,
                    city: exp.city || null,
                    tenure: exp.tenure || null
                }));
                await EmployeeExperience.bulkCreate(expData, { transaction });
            }
        }

        // 3. Siblings
        await EmployeeFamilyMember.destroy({ where: { staff_id: id }, transaction });
        if (family_members) {
            const famList = typeof family_members === "string" ? JSON.parse(family_members) : family_members;
            if (famList && famList.length > 0) {
                const famData = famList.map(fam => ({
                    staff_id: id,
                    name: fam.name,
                    relationship: fam.relationship || "Brother",
                    work_status: fam.work_status || null,
                    educational_status: fam.educational_status || null,
                    marital_status: fam.marital_status || null,
                    residing_in: fam.residing_in || null
                }));
                await EmployeeFamilyMember.bulkCreate(famData, { transaction });
            }
        }

        // 4. File attachments uploads
        if (req.files && req.files.length > 0) {
            // Delete previous physical file and DB record of same type to prevent duplicates
            for (const file of req.files) {
                const docType = file.fieldname.replace(/^doc_/, "");
                const existingDoc = await EmployeeDocument.findOne({
                    where: { staff_id: id, document_type: docType },
                    transaction
                });
                if (existingDoc) {
                    try {
                        if (fs.existsSync(existingDoc.file_path)) {
                            fs.unlinkSync(existingDoc.file_path);
                        }
                    } catch (err) {
                        console.error(`Failed to delete previous physical document file at ${existingDoc.file_path}:`, err);
                    }
                    await existingDoc.destroy({ transaction });
                }
            }

            const docsToCreate = req.files.map(file => {
                const docType = file.fieldname.replace(/^doc_/, "");
                return {
                    staff_id: id,
                    document_type: docType,
                    file_name: file.originalname,
                    file_path: file.path,
                    file_size: file.size
                };
            });
            await EmployeeDocument.bulkCreate(docsToCreate, { transaction });
        }

        await transaction.commit();

        // Log admin update
        await logActivity({
            admin_id: req.userId,
            action: "UPDATE",
            entity: "UserOnboarding",
            entity_id: id,
            affected_user_id: id,
            description: `Updated extended joining profile for employee ${user.firstname} ${user.lastname}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({ message: "Employee profile successfully updated." });

    } catch (err) {
        console.error("Error updating employee profile:", err);
        await transaction.rollback();
        res.status(500).send({ message: getErrorMessage(err) });
    }
};

/**
 * Securely download candidate's uploaded attachment files after permission validations
 * GET /api/onboarding/employee/:id/document/:docId
 */
exports.downloadEmployeeDocument = async (req, res) => {
    const { id, docId } = req.params;

    try {
        const loggedInUserId = req.userId;
        const requestedEmployeeId = parseInt(id);

        if (loggedInUserId !== requestedEmployeeId) {
            // Check if the logged-in user has permission to view users
            const loggedInUser = await User.findByPk(loggedInUserId);
            if (!loggedInUser) {
                return res.status(403).send({ message: "Access denied. User not found." });
            }
            const role = await Role.findByPk(loggedInUser.role);
            const hasPermission = role && (
                role.can_view_users === 'all' || role.can_view_users === 'subordinates' ||
                role.can_manage_users === 'all' || role.can_manage_users === 'subordinates'
            );
            if (!hasPermission) {
                return res.status(403).send({ message: "Access denied. You do not have permission to view this document." });
            }

            // Hierarchy check for document downloads
            const targetUser = await User.findByPk(requestedEmployeeId);
            if (targetUser) {
                const targetRole = await Role.findByPk(targetUser.role);
                if (role && targetRole && targetRole.hierarchy_level < role.hierarchy_level) {
                    return res.status(403).send({
                        message: "Access denied. You do not have permission to view documents of higher hierarchy profiles."
                    });
                }
            }
        }

        const doc = await EmployeeDocument.findOne({
            where: {
                id: docId,
                staff_id: id
            }
        });

        if (!doc) {
            return res.status(404).send({ message: "Requested document not found." });
        }

        const absolutePath = path.resolve(doc.file_path);

        if (!fs.existsSync(absolutePath)) {
            return res.status(404).send({ message: "Document file does not exist on server storage." });
        }

        res.setHeader("Content-Disposition", `attachment; filename="${doc.file_name}"`);
        res.sendFile(absolutePath);

    } catch (err) {
        console.error("Error downloading employee document:", err);
        res.status(500).send({ message: getErrorMessage(err) });
    }
};

/**
 * Get the extended profile of the currently logged in employee
 * GET /api/onboarding/my-profile
 */
exports.getMyProfile = async (req, res) => {
    const id = req.userId; // Decrypted from JWT token

    try {
        const user = await User.findByPk(id, {
            attributes: ['staffid', 'userid', 'firstname', 'lastname', 'email', 'secondary_email', 'role', 'active', 'approving_manager_id', 'gender', 'last_login', 'abis_access'],
            include: [
                { model: EmployeeProfile, as: 'profile_info' },
                { model: EmployeeEducation, as: 'educations' },
                { model: EmployeeExperience, as: 'experiences' },
                { model: EmployeeFamilyMember, as: 'family_members' },
                { model: EmployeeDocument, as: 'documents' }
            ]
        });

        if (!user) {
            return res.status(404).send({ message: "Employee profile not found." });
        }

        res.status(200).send(user);

    } catch (err) {
        console.error("Error fetching my onboarding profile:", err);
        res.status(500).send({ message: getErrorMessage(err) });
    }
};

/**
 * Save user password change, consent flag, and signature drawing (first-time login verification flow)
 * POST /api/onboarding/employee/complete-declaration
 */
exports.completeEmployeeDeclaration = async (req, res) => {
    const { password, signature_name, onboarding_place, signature_data, consent_given } = req.body;
    const userId = req.userId; // Decrypted from JWT token

    const transaction = await db.sequelize.transaction();

    try {
        const user = await User.findByPk(userId, { transaction });
        if (!user) {
            await transaction.rollback();
            return res.status(404).send({ message: "Employee not found." });
        }

        let profile = await EmployeeProfile.findOne({ where: { staff_id: userId }, transaction });
        const hasExistingDeclaration = profile && profile.consent_given && profile.signature_path;

        // If no existing declaration, consent and signature are strictly required!
        if (!hasExistingDeclaration) {
            if (!consent_given || consent_given === 'false') {
                await transaction.rollback();
                return res.status(400).send({ message: "Declaration and consent must be accepted." });
            }

            if (!signature_name || !onboarding_place || !signature_data) {
                await transaction.rollback();
                return res.status(400).send({ message: "Signature name, onboarding place, and drawing are required." });
            }
        }

        // 1. Password change handling (optional - e.g. for existing users)
        if (password) {
            if (password.length < 6) {
                await transaction.rollback();
                return res.status(400).send({ message: "Password must be at least 6 characters long." });
            }
            const hashedPassword = bcrypt.hashSync(password, 8);
            await user.update({ password: hashedPassword, last_login: new Date() }, { transaction });
        } else {
            await user.update({ last_login: new Date() }, { transaction });
        }

        // 2. Decode and save canvas drawing signature (ONLY if provided)
        if (signature_data) {
            const dir = "uploads/signatures";
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const base64Data = signature_data.replace(/^data:image\/png;base64,/, "");
            const signaturePath = `${dir}/sig-${userId}-${Date.now()}.png`;
            fs.writeFileSync(signaturePath, base64Data, "base64");

            // 3. Create or update profile signature settings
            const profileData = {
                consent_given: true,
                signature_name,
                signature_path: signaturePath,
                signature_date: new Date(),
                onboarding_place
            };

            if (profile) {
                await profile.update(profileData, { transaction });
            } else {
                await EmployeeProfile.create({
                    staff_id: userId,
                    ...profileData
                }, { transaction });
            }
        }

        await transaction.commit();

        // Log completion activity
        await logActivity({
            admin_id: userId,
            action: "UPDATE",
            entity: "UserDeclaration",
            entity_id: userId,
            affected_user_id: userId,
            description: `${user.firstname} ${user.lastname} completed profile audit and signed onboarding declaration.`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({
            message: "Declaration and profile verification successfully completed!"
        });

    } catch (err) {
        console.error("Error completing profile declaration:", err);
        await transaction.rollback();
        res.status(500).send({ message: getErrorMessage(err) });
    }
};
