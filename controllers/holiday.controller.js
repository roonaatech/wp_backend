const db = require("../models");
const Holiday = db.holidays;
const { Op } = require("sequelize");
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");

// Get all holidays (optionally filtered by year and/or status)
exports.findAll = async (req, res) => {
    try {
        const { year, status } = req.query;
        const whereClause = {};

        if (year) {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            whereClause.holiday_date = {
                [Op.between]: [startDate, endDate]
            };
        }

        if (status !== undefined && status !== '') {
            whereClause.status = parseInt(status);
        }

        const holidays = await Holiday.findAll({
            where: whereClause,
            order: [['holiday_date', 'ASC']],
            include: [
                {
                    model: db.user,
                    as: 'creator',
                    attributes: ['staffid', 'firstname', 'lastname'],
                    required: false
                },
                {
                    model: db.user,
                    as: 'updater',
                    attributes: ['staffid', 'firstname', 'lastname'],
                    required: false
                }
            ]
        });

        res.send(holidays);
    } catch (err) {
        console.error("Error retrieving holidays:", err);
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving holidays."
        });
    }
};

// Get available years that have holidays, plus current year +/- 2 years
exports.getYears = async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const defaultYears = [currentYear - 1, currentYear, currentYear + 1];

        // Fetch distinct dates to extract distinct years
        const holidays = await Holiday.findAll({
            attributes: ['holiday_date'],
            raw: true
        });

        const yearsSet = new Set(defaultYears);
        holidays.forEach(h => {
            if (h.holiday_date) {
                const y = parseInt(String(h.holiday_date).substring(0, 4));
                if (!isNaN(y)) yearsSet.add(y);
            }
        });

        const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
        res.send(sortedYears);
    } catch (err) {
        console.error("Error retrieving holiday years:", err);
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving holiday years."
        });
    }
};

// Get single holiday by date
exports.findOne = async (req, res) => {
    try {
        const { date } = req.params;
        const holiday = await Holiday.findByPk(date, {
            include: [
                {
                    model: db.user,
                    as: 'creator',
                    attributes: ['staffid', 'firstname', 'lastname'],
                    required: false
                },
                {
                    model: db.user,
                    as: 'updater',
                    attributes: ['staffid', 'firstname', 'lastname'],
                    required: false
                }
            ]
        });

        if (!holiday) {
            return res.status(404).send({ message: "Holiday not found." });
        }

        res.send(holiday);
    } catch (err) {
        console.error("Error retrieving holiday:", err);
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving holiday."
        });
    }
};

// Create a new holiday
exports.create = async (req, res) => {
    const { holiday_date, holiday_name, status } = req.body;

    if (!holiday_date || !holiday_name) {
        return res.status(400).send({
            message: "Holiday date and holiday name are required!"
        });
    }

    try {
        // Check if a holiday already exists for this date
        const existing = await Holiday.findByPk(holiday_date);
        if (existing) {
            return res.status(400).send({
                message: `A holiday is already configured for ${holiday_date} (${existing.holiday_name}).`
            });
        }

        const newHoliday = await Holiday.create({
            holiday_date: holiday_date,
            holiday_name: holiday_name.trim(),
            status: status !== undefined ? parseInt(status) : 1,
            user_added: req.userId,
            date_added: new Date(),
            user_updated: req.userId,
            date_updated: null
        });

        await logActivity({
            admin_id: req.userId,
            action: 'CREATE',
            entity: 'Holiday',
            entity_id: holiday_date,
            description: `Created holiday: ${holiday_name.trim()} on ${holiday_date}`,
            new_values: { holiday_date, holiday_name: holiday_name.trim(), status: newHoliday.status },
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(201).send({
            message: "Holiday created successfully!",
            data: newHoliday
        });
    } catch (err) {
        console.error("Error creating holiday:", err);
        res.status(500).send({
            message: err.message || "Some error occurred while creating the holiday."
        });
    }
};

// Update an existing holiday
exports.update = async (req, res) => {
    const { date } = req.params;
    const { holiday_name, status, holiday_date: new_date } = req.body;

    try {
        const holiday = await Holiday.findByPk(date);
        if (!holiday) {
            return res.status(404).send({ message: "Holiday not found!" });
        }

        const oldValues = {
            holiday_date: holiday.holiday_date,
            holiday_name: holiday.holiday_name,
            status: holiday.status
        };

        const updatedFields = {
            user_updated: req.userId,
            date_updated: new Date()
        };

        if (holiday_name !== undefined) {
            updatedFields.holiday_name = holiday_name.trim();
        }

        if (status !== undefined) {
            updatedFields.status = parseInt(status);
        }

        // If date is being changed
        if (new_date && new_date !== date) {
            const conflict = await Holiday.findByPk(new_date);
            if (conflict) {
                return res.status(400).send({
                    message: `A holiday is already configured for ${new_date} (${conflict.holiday_name}).`
                });
            }
            updatedFields.holiday_date = new_date;
        }

        await holiday.update(updatedFields);

        await logActivity({
            admin_id: req.userId,
            action: 'UPDATE',
            entity: 'Holiday',
            entity_id: updatedFields.holiday_date || date,
            description: `Updated holiday on ${date}: ${holiday.holiday_name}`,
            old_values: oldValues,
            new_values: updatedFields,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.send({
            message: "Holiday updated successfully!",
            data: holiday
        });
    } catch (err) {
        console.error("Error updating holiday:", err);
        res.status(500).send({
            message: err.message || "Some error occurred while updating the holiday."
        });
    }
};

// Delete a holiday
exports.delete = async (req, res) => {
    const { date } = req.params;

    try {
        const holiday = await Holiday.findByPk(date);
        if (!holiday) {
            return res.status(404).send({ message: "Holiday not found!" });
        }

        const holidayName = holiday.holiday_name;
        await holiday.destroy();

        await logActivity({
            admin_id: req.userId,
            action: 'DELETE',
            entity: 'Holiday',
            entity_id: date,
            description: `Deleted holiday: ${holidayName} on ${date}`,
            old_values: { holiday_date: date, holiday_name: holidayName },
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.send({
            message: "Holiday deleted successfully!"
        });
    } catch (err) {
        console.error("Error deleting holiday:", err);
        res.status(500).send({
            message: err.message || "Some error occurred while deleting the holiday."
        });
    }
};
