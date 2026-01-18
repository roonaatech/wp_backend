const db = require("../models");
const config = process.env;
const TblStaff = db.tblstaff;

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");

exports.signup = (req, res) => {
    // Save User to Database
    TblStaff.create({
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: req.body.email,
        password: bcrypt.hashSync(req.body.password, 8),
        datecreated: new Date(),
        role: req.body.role ? req.body.role : 1, // Default role 1 (employee)
        active: 1
    })
        .then(user => {
            res.send({ message: "User was registered successfully!" });
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

exports.signin = async (req, res) => {
    console.log("Signin request received.");
    console.log("DB Host of TblStaff model:", TblStaff.sequelize.config.host);
    console.log("DB Host of TblStaff connection manager:", TblStaff.sequelize.connectionManager.config.host);

    try {
        const user = await TblStaff.findOne({
            where: {
                email: req.body.email
            }
        });

        if (!user) {
            return res.status(404).send({ message: "User Not found." });
        }

        if (user.active === 0 || user.active === false) {
            return res.status(403).send({ message: "Your account is inactive. Please contact your administrator." });
        }

        var passwordIsValid = bcrypt.compareSync(
            req.body.password,
            user.password
        );

        if (!passwordIsValid) {
            return res.status(401).send({
                accessToken: null,
                message: "Invalid Password!"
            });
        }

        var token = jwt.sign({ id: user.staffid }, config.JWT_SECRET, {
            expiresIn: 86400 // 24 hours
        });

        // Log activity
        await logActivity({
            admin_id: user.staffid,
            action: 'LOGIN',
            entity: 'User',
            entity_id: user.staffid,
            affected_user_id: user.staffid,
            description: `${user.firstname} ${user.lastname} logged in`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({
            id: user.staffid,
            staffid: user.staffid,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            role: user.role,
            accessToken: token
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

exports.logout = async (req, res) => {
    try {
        const userId = req.userId; // From authJwt middleware
        const user = await TblStaff.findOne({
            where: {
                staffid: userId
            }
        });

        if (!user) {
            return res.status(404).send({ message: "User Not found." });
        }

        // Log activity
        await logActivity({
            admin_id: userId,
            action: 'LOGOUT',
            entity: 'User',
            entity_id: userId,
            affected_user_id: userId,
            description: `${user.firstname} ${user.lastname} logged out`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({
            success: true,
            message: "User logged out successfully"
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};
