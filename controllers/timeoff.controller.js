const db = require("../models");
const TimeOffRequest = db.time_off_requests;
const Staff = db.user;
const Setting = db.settings;
const { Op } = require("sequelize");
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");
const emailService = require("../utils/email.service");

// Helper to calculate hours difference
const calculateHours = (start, end) => {
    const today = new Date().toISOString().slice(0, 10);
    const startDate = new Date(`${today}T${start}`);
    const endDate = new Date(`${today}T${end}`);
    return (endDate - startDate) / (1000 * 60 * 60);
};

// Apply for Time Off
exports.applyTimeOff = async (req, res) => {
    try {
        const { date, start_time, end_time, reason } = req.body;

        if (!date || !start_time || !end_time || !reason) {
            return res.status(400).send({ message: "Date, start time, end time, and reason are required!" });
        }

        // Validate time format (HH:MM or HH:MM:SS)
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        const timeRegexWithSeconds = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

        const isStartValid = timeRegex.test(start_time) || timeRegexWithSeconds.test(start_time);
        const isEndValid = timeRegex.test(end_time) || timeRegexWithSeconds.test(end_time);

        if (!isStartValid || !isEndValid) {
            return res.status(400).send({ message: "Invalid time format. Use HH:MM or HH:MM:SS." });
        }

        // Validate duration against system setting
        const maxTimeOffSetting = await Setting.findOne({ where: { key: 'max_time_off_hours' } });
        const maxHours = maxTimeOffSetting ? parseFloat(maxTimeOffSetting.value) : 4; // Default to 4 hours

        // Add today's date prefix to properly calculate time difference
        // Handle cases where time string is HH:MM or HH:MM:SS
        const formatTime = (t) => t.length === 5 ? `${t}:00` : t;
        const sTime = new Date(`1970-01-01T${formatTime(start_time)}`);
        const eTime = new Date(`1970-01-01T${formatTime(end_time)}`);

        const durationHours = (eTime - sTime) / (1000 * 60 * 60);

        if (durationHours <= 0) {
            return res.status(400).send({ message: "End time must be after start time." });
        }

        if (durationHours > maxHours) {
            return res.status(400).send({
                message: `Time-off request exceeds the maximum allowance of ${maxHours} hours per day.`
            });
        }

        // Check total time-off hours for the day (including existing requests)
        const existingRequests = await TimeOffRequest.findAll({
            where: {
                staff_id: req.userId,
                date: date,
                status: { [Op.in]: ['Pending', 'Approved'] }
            }
        });

        // Calculate total hours already requested for this day
        let totalExistingHours = 0;
        for (const request of existingRequests) {
            const reqStartTime = new Date(`1970-01-01T${formatTime(request.start_time)}`);
            const reqEndTime = new Date(`1970-01-01T${formatTime(request.end_time)}`);
            const reqHours = (reqEndTime - reqStartTime) / (1000 * 60 * 60);
            totalExistingHours += reqHours;
        }

        // Check if adding this new request would exceed the daily limit
        const totalHoursWithNewRequest = totalExistingHours + durationHours;
        if (totalHoursWithNewRequest > maxHours) {
            return res.status(400).send({
                message: `This request would exceed the daily limit of ${maxHours} hours. You have already requested ${totalExistingHours} hours for ${date}. Adding ${durationHours} hours would total ${totalHoursWithNewRequest} hours.`
            });
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
        console.error('[TimeOff Controller] Error applying for time-off:', err.message);
        res.status(500).send({ message: "An error occurred while applying for time-off." });
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
