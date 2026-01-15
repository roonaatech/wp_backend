const db = require("../models");
const AttendanceLog = db.attendance_logs;
const OnDutyLog = db.on_duty_logs;
const Approval = db.approvals;
const TblStaff = db.tblstaff;

exports.checkIn = (req, res) => {
    // Validate request
    if (!req.body.latitude || !req.body.longitude) {
        res.status(400).send({
            message: "Location is required!"
        });
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDateOnly = today.toISOString().split('T')[0];

    const attendance = {
        staff_id: req.userId,
        check_in_time: new Date(),
        date: todayDateOnly,
        phone_model: req.body.phone_model,
        ip_address: req.body.ip_address,
        latitude: req.body.latitude,
        longitude: req.body.longitude
    };

    AttendanceLog.create(attendance)
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while creating the Attendance Log."
            });
        });
};

exports.checkOut = (req, res) => {
    // Find today's attendance log for the user
    // Assuming one check-in per day for simplicity, or find the latest one without check-out
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDateOnly = today.toISOString().split('T')[0];

    AttendanceLog.findOne({
        where: {
            staff_id: req.userId,
            date: todayDateOnly,
            check_out_time: null
        },
        order: [['check_in_time', 'DESC']]
    })
        .then(log => {
            if (!log) {
                return res.status(404).send({
                    message: "No active check-in found for today."
                });
            }

            log.update({
                check_out_time: new Date(),
                // Optionally update location/device info for checkout if needed
            })
                .then(async (updatedLog) => {
                    try {
                        console.log('\n=== CheckOut - Creating Approval ===');
                        console.log('Staff ID:', req.userId);
                        console.log('Attendance Log ID:', updatedLog.id);
                        
                        // Get the staff member's approving_manager_id
                        const staff = await TblStaff.findByPk(req.userId);
                        
                        console.log('Staff found:', !!staff);
                        console.log('Staff name:', staff?.firstname, staff?.lastname);
                        console.log('Staff role:', staff?.role);
                        console.log('Approving Manager ID:', staff?.approving_manager_id);
                        
                        if (staff && staff.approving_manager_id) {
                            // Create approval record
                            const approval = await Approval.create({
                                attendance_log_id: updatedLog.id,
                                manager_id: staff.approving_manager_id,
                                status: 'pending'
                            });
                            console.log('✅ Approval created successfully');
                            console.log('   Approval ID:', approval.id);
                            console.log('   Attendance Log ID:', approval.attendance_log_id);
                            console.log('   Manager ID:', approval.manager_id);
                            console.log('   Status:', approval.status);
                        } else {
                            console.log('⚠️  Staff has no approving_manager_id - approval NOT created');
                        }
                        
                        console.log('=== CheckOut Complete ===\n');
                        
                        res.send({ message: "Checked out successfully!" });
                    } catch (err) {
                        console.error('❌ Error creating approval:', err.message);
                        console.error(err.stack);
                        // Still send success response even if approval creation fails
                        res.send({ message: "Checked out successfully!" });
                    }
                })
                .catch(err => {
                    res.status(500).send({
                        message: "Error updating Attendance Log with id=" + log.id
                    });
                });
        })
        .catch(err => {
            res.status(500).send({
                message: "Error retrieving Attendance Log."
            });
        });
};
