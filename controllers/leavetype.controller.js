const db = require("../models");
const LeaveType = db.leave_types;

// Get leave types filtered by user's gender and assigned in user_leave_types
exports.findByUserGender = async (req, res) => {
    try {
        const User = db.user;
        const UserLeaveType = db.user_leave_types;

        // Get user's gender
        const user = await User.findByPk(req.userId);

        if (!user) {
            return res.status(404).send({
                message: "User not found."
            });
        }

        // Get only leave types assigned to user in user_leave_types
        const assignedLeaveTypes = await UserLeaveType.findAll({
            where: { user_id: req.userId },
            include: [{
                model: LeaveType,
                as: 'leave_type',
                where: { status: true }
            }]
        });

        // Filter by gender restriction and map to leave type objects
        const filteredLeaveTypes = assignedLeaveTypes
            .map(ult => ult.leave_type)
            .filter(leaveType => {
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

    let finalGenderRestriction = null;
    if (gender_restriction) {
        if (Array.isArray(gender_restriction)) {
            finalGenderRestriction = gender_restriction.length > 0 ? gender_restriction : null;
        } else if (typeof gender_restriction === 'string' && gender_restriction.trim().length > 0) {
            finalGenderRestriction = [gender_restriction];
        }
    }

    LeaveType.create({
        name: name,
        description: description || null,
        days_allowed: days_allowed || 0,
        gender_restriction: finalGenderRestriction,
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
exports.update = async (req, res) => {
    const id = req.params.id;
    const { name, description, status, days_allowed, gender_restriction } = req.body;

    try {
        const leaveType = await LeaveType.findByPk(id);

        if (!leaveType) {
            return res.status(404).send({ message: "Leave type not found!" });
        }

        // Check if trying to deactivate (change status from true to false)
        if (status !== undefined && status === false && leaveType.status === true) {
            const UserLeaveType = db.user_leave_types;
            const User = db.user;

            // Check if this leave type is assigned to any users
            const assignedUsers = await UserLeaveType.findAll({
                where: { leave_type_id: id },
                include: [{
                    model: User,
                    attributes: ['staffid', 'firstname', 'lastname', 'email', 'userid'],
                    required: true
                }],
                attributes: ['id', 'user_id', 'days_allowed', 'days_used']
            });

            if (assignedUsers.length > 0) {
                // Leave type is assigned to users, cannot deactivate
                const employeeList = assignedUsers.map(assignment => ({
                    id: assignment.user.staffid,
                    name: `${assignment.user.firstname} ${assignment.user.lastname}`,
                    email: assignment.user.email,
                    employee_id: assignment.user.userid,
                    days_allowed: assignment.days_allowed,
                    days_used: assignment.days_used
                }));

                const message = assignedUsers.length === 1
                    ? `Cannot deactivate leave type. It is currently assigned to 1 employee. Please remove this leave type from the following employee before deactivating it.`
                    : `Cannot deactivate leave type. It is currently assigned to ${assignedUsers.length} employees. Please remove this leave type from the following employees before deactivating it.`;

                return res.status(400).send({
                    message: message,
                    canDeactivate: false,
                    assignedEmployees: employeeList,
                    assignedCount: assignedUsers.length,
                    instruction: ""
                });
            }
        }

        // Proceed with update if validation passed
        const updatedLeaveType = await leaveType.update({
            name: name !== undefined ? name : leaveType.name,
            description: description !== undefined ? description : leaveType.description,
            days_allowed: days_allowed !== undefined ? days_allowed : leaveType.days_allowed,
            gender_restriction: gender_restriction !== undefined
                ? (Array.isArray(gender_restriction)
                    ? (gender_restriction.length > 0 ? gender_restriction : null)
                    : (typeof gender_restriction === 'string' && gender_restriction.trim().length > 0 ? [gender_restriction] : null))
                : leaveType.gender_restriction,
            status: status !== undefined ? status : leaveType.status
        });

        res.send({
            message: "Leave type updated successfully!",
            data: updatedLeaveType
        });

    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while updating leave type."
        });
    }
};

// Delete leave type
exports.delete = async (req, res) => {
    const id = req.params.id;

    try {
        const leaveType = await LeaveType.findByPk(id);

        if (!leaveType) {
            return res.status(404).send({ message: "Leave type not found!" });
        }

        const UserLeaveType = db.user_leave_types;
        const User = db.user;

        // Check if this leave type is assigned to any users
        const assignedUsers = await UserLeaveType.findAll({
            where: { leave_type_id: id },
            include: [{
                model: User,
                attributes: ['staffid', 'firstname', 'lastname', 'email', 'userid'],
                required: true
            }],
            attributes: ['id', 'user_id', 'days_allowed', 'days_used']
        });

        if (assignedUsers.length > 0) {
            // Leave type is assigned to users, cannot delete
            const employeeList = assignedUsers.map(assignment => ({
                id: assignment.user.staffid,
                name: `${assignment.user.firstname} ${assignment.user.lastname}`,
                email: assignment.user.email,
                employee_id: assignment.user.userid,
                days_allowed: assignment.days_allowed,
                days_used: assignment.days_used
            }));

            const message = assignedUsers.length === 1
                ? `Cannot delete leave type. It is currently assigned to 1 employee. Please remove this leave type from the following employee before deleting it.`
                : `Cannot delete leave type. It is currently assigned to ${assignedUsers.length} employees. Please remove this leave type from the following employees before deleting it.`;

            return res.status(400).send({
                message: message,
                canDelete: false,
                assignedEmployees: employeeList,
                assignedCount: assignedUsers.length,
                instruction: ""
            });
        }

        // Proceed with deletion if validation passed
        await leaveType.destroy();

        res.send({
            message: "Leave type deleted successfully!"
        });

    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while deleting leave type."
        });
    }
};
