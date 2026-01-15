const jwt = require("jsonwebtoken");
const config = process.env;

verifyToken = (req, res, next) => {
    let token = req.headers["x-access-token"];

    if (!token) {
        return res.status(403).send({
            message: "No token provided!"
        });
    }

    jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({
                message: "Unauthorized!"
            });
        }
        req.userId = decoded.id;
        next();
    });
};

const db = require("../models");
const User = db.tblstaff;

isManagerOrAdmin = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (user.admin === 1 || user.role === 2 || user.role === 3 || user.role === "manager" || user.role === "admin") {
            next();
            return;
        }

        res.status(403).send({
            message: "Require Manager or Admin Role!"
        });
    } catch (error) {
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

isAdmin = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (user && (user.admin === 1 || user.role === 1)) {
            next();
            return;
        }

        res.status(403).send({
            message: "Require Admin Role!"
        });
    } catch (error) {
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

const authJwt = {
    verifyToken: verifyToken,
    isManagerOrAdmin: isManagerOrAdmin,
    isAdmin: isAdmin
};
module.exports = authJwt;
