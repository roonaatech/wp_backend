const db = require("../models");
const LeaveType = db.leave_types;

// Get leave types filtered by user's gender
exports.findByUserGender = async (req, res) => {
    try {
        const User = db.user;

        // Get user's gender
        const user = await User.findByPk(req.userId);
        
        if (!user) {
            return res.status(404).send({
                message: "User not found."
            });
        }

        // Get all active leave types
        const leaveTypes = await LeaveType.findAll({
            where: { status: true }
        });

        // Filter leave types based on gender restriction
        const filteredLeaveTypes = leaveTypes.filter(leaveType => {
            // If no gender restriction is set, leave type is available for all
            if (!leaveType.gender_restriction || leaveType.gender_restriction.length === 0) {
                return true;
            }
            // If gender restriction exists, check if user's gender is in the list
            return leaveType.gender_restriction.includes(user.gender);
        });

        res.send(filteredLeaveTypes);
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving leave types."
        });
    }
};

// Get all active leave types
exports.findAll = (req, res) => {
    LeaveType.findAll({
        where: { status: true }
    })
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            res.status(500).send({
                message: err.message || "Some error occurred while retrieving leave types."
            });
        });
};

// Get all leave types (including inactive) - for admin
exports.findAllAdmin = (req, res) => {
    LeaveType.findAll()
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            res.status(500).send({
                message: err.message || "Some error occurred while retrieving leave types."
            });
        });
};

// Create new leave type
exports.create = (req, res) => {
    const { name, description, days_allowed, gender_restriction } = req.body;

    if (!name) {
        return res.status(400).send({ message: "Leave type name is required!" });
    }

    LeaveType.create({
        name: name,
        description: description || null,
        days_allowed: days_allowed || 0,
        gender_restriction: gender_restriction && gender_restriction.length > 0 ? gender_restriction : null,
        status: true
    })
        .then(data => {
            res.status(201).send({
                message: "Leave type created successfully!",
                data: data
            });
        })
        .catch(err => {
            res.status(500).send({
                message: err.message || "Some error occurred while creating leave type."
            });
        });
};

// Update leave type
exports.update = (req, res) => {
    const id = req.params.id;
    const { name, description, status, days_allowed, gender_restriction } = req.body;

    LeaveType.findByPk(id)
        .then(leaveType => {
            if (!leaveType) {
                return res.status(404).send({ message: "Leave type not found!" });
            }

            return leaveType.update({
                name: name !== undefined ? name : leaveType.name,
                description: description !== undefined ? description : leaveType.description,
                days_allowed: days_allowed !== undefined ? days_allowed : leaveType.days_allowed,
                gender_restriction: gender_restriction !== undefined ? (gender_restriction && gender_restriction.length > 0 ? gender_restriction : null) : leaveType.gender_restriction,
                status: status !== undefined ? status : leaveType.status
            });
        })
        .then(updatedLeaveType => {
            res.send({
                message: "Leave type updated successfully!",
                data: updatedLeaveType
            });
        })
        .catch(err => {
            res.status(500).send({
                message: err.message || "Some error occurred while updating leave type."
            });
        });
};

// Delete leave type
exports.delete = (req, res) => {
    const id = req.params.id;

    LeaveType.findByPk(id)
        .then(leaveType => {
            if (!leaveType) {
                return res.status(404).send({ message: "Leave type not found!" });
            }

            return leaveType.destroy();
        })
        .then(() => {
            res.send({
                message: "Leave type deleted successfully!"
            });
        })
        .catch(err => {
            res.status(500).send({
                message: err.message || "Some error occurred while deleting leave type."
            });
        });
};
