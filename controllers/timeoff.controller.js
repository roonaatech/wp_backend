const db = require("../models");
const TimeOffRequest = db.time_off_requests;
const Staff = db.user;
const { Op } = require("sequelize");
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");
const emailService = require("../utils/email.service");

// Apply for Time Off
exports.applyTimeOff = async (req, res) => {
    try {
        const { date, start_time, end_time, reason } = req.body;

        if (!date || !start_time || !end_time || !reason) {
            return res.status(400).send({ message: "Date, start time, end time, and reason are required!" });
        }

        // Validate time format (HH:MM)
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
            // Try to handle seconds if passed (HH:MM:SS)
            const timeRegexWithSeconds = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
            if (!timeRegexWithSeconds.test(start_time) && !timeRegex.test(start_time)) {
                return res.status(400).send({ message: "Invalid time format. Use HH:MM or HH:MM:SS." });
            }
        }

        // Check for overlapping Time-Off requests
        const overlappingRequest = await TimeOffRequest.findOne({
            where: {
                staff_id: req.userId,
                date: date,
                status: { [Op.in]: ['Pending', 'Approved'] },
                [Op.or]: [
                    {
                        start_time: { [Op.lte]: start_time },
                        end_time: { [Op.gte]: start_time }
                    },
                    {
                        start_time: { [Op.lte]: end_time },
                        end_time: { [Op.gte]: end_time }
                    },
                    {
                        start_time: { [Op.gte]: start_time },
                        end_time: { [Op.lte]: end_time }
                    }
                ]
            }
        });

        if (overlappingRequest) {
            return res.status(409).send({
                message: `You already have a time-off request on ${date} from ${overlappingRequest.start_time} to ${overlappingRequest.end_time} that overlaps with the selected times.`,
            });
        }

        const timeOff = await TimeOffRequest.create({
            staff_id: req.userId,
            date,
            start_time,
            end_time,
            reason
        });

        // Log activity
        await logActivity({
            admin_id: req.userId,
            action: 'CREATE',
            entity: 'TimeOffRequest',
            entity_id: timeOff.id,
            affected_user_id: req.userId,
            description: `Applied for Time-Off on ${date} from ${start_time} to ${end_time}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        // Send Email Notifications
        try {
            const user = await Staff.findByPk(req.userId);
            let manager = null;

            if (user && user.approving_manager_id) {
                manager = await Staff.findByPk(user.approving_manager_id);
                if (manager && manager.email) {
                    await emailService.sendTemplateEmail(manager.email, "leave_applied", { // Reusing leave template or create a new one
                        user_name: `${user.firstname} ${user.lastname}`,
                        leave_type: "Time Off",
                        start_date: `${date} ${start_time}`,
                        end_date: `${date} ${end_time}`,
                        reason: reason
                    });
                }
            }
        } catch (emailErr) {
            console.error("Failed to send email:", emailErr);
        }

        res.status(201).send({ message: "Time-Off applied successfully!", timeOff });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Update Time-Off Details (by User)
exports.updateTimeOffDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, start_time, end_time, reason } = req.body;

        const timeOff = await TimeOffRequest.findByPk(id);

        if (!timeOff) {
            return res.status(404).send({ message: "Time-Off request not found." });
        }

        if (timeOff.staff_id !== req.userId) {
            return res.status(403).send({ message: "Unauthorized to update this request." });
        }

        if (timeOff.status !== 'Pending') {
            return res.status(400).send({ message: "Cannot update a request that has already been processed." });
        }

        // Validate time format (HH:MM)
        if (start_time || end_time) {
            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            const timeRegexWithSeconds = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

            if (start_time && !timeRegex.test(start_time) && !timeRegexWithSeconds.test(start_time)) {
                return res.status(400).send({ message: "Invalid start time format." });
            }
            if (end_time && !timeRegex.test(end_time) && !timeRegexWithSeconds.test(end_time)) {
                return res.status(400).send({ message: "Invalid end time format." });
            }
        }

        // Update fields if provided
        if (date) timeOff.date = date;
        if (start_time) timeOff.start_time = start_time;
        if (end_time) timeOff.end_time = end_time;
        if (reason) timeOff.reason = reason;

        await timeOff.save();

        await logActivity({
            admin_id: req.userId,
            action: 'UPDATE',
            entity: 'TimeOffRequest',
            entity_id: id,
            affected_user_id: req.userId,
            description: `Updated Time-Off request details for ${timeOff.date}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({ message: "Time-Off updated successfully!", timeOff });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};
exports.updateTimeOffStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejection_reason } = req.body;

        const timeOff = await TimeOffRequest.findByPk(id);
        if (!timeOff) {
            return res.status(404).send({ message: "Time-Off request not found." });
        }

        const oldStatus = timeOff.status;

        if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
            return res.status(400).send({ message: "Invalid status!" });
        }

        timeOff.status = status;
        if (status === 'Pending') {
            timeOff.manager_id = null;
            timeOff.rejection_reason = null;
        } else {
            timeOff.manager_id = req.userId;
            if (status === 'Rejected') {
                timeOff.rejection_reason = rejection_reason;
            } else {
                timeOff.rejection_reason = null;
            }
        }

        await timeOff.save();

        // Log activity
        await logActivity({
            admin_id: req.userId,
            action: status === 'Approved' ? 'APPROVE' : (status === 'Rejected' ? 'REJECT' : 'UPDATE'),
            entity: 'TimeOffRequest',
            entity_id: timeOff.id,
            affected_user_id: timeOff.staff_id,
            old_values: { status: oldStatus },
            new_values: { status: status, rejection_reason: rejection_reason || null },
            description: `${status} Time-Off request for ${timeOff.date}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({ message: `Time-Off ${status} successfully!`, timeOff });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Delete Time Off Request
exports.deleteTimeOff = async (req, res) => {
    try {
        const { id } = req.params;
        const timeOff = await TimeOffRequest.findByPk(id);

        if (!timeOff) {
            return res.status(404).send({ message: "Time-Off request not found." });
        }

        if (timeOff.staff_id !== req.userId) {
            return res.status(403).send({ message: "Unauthorized to delete this request." });
        }

        if (timeOff.status !== 'Pending') {
            return res.status(400).send({ message: "Cannot delete a processed request." });
        }

        await timeOff.destroy();

        await logActivity({
            admin_id: req.userId,
            action: 'DELETE',
            entity: 'TimeOffRequest',
            entity_id: id,
            affected_user_id: req.userId,
            description: `Deleted Time-Off request on ${timeOff.date}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({ message: "Time-Off request deleted successfully." });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Get My Time Off Requests
exports.getMyTimeOffRequests = async (req, res) => {
    try {
        const requests = await TimeOffRequest.findAll({
            where: { staff_id: req.userId },
            order: [['date', 'DESC'], ['start_time', 'DESC']]
        });
        res.status(200).send(requests);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};
