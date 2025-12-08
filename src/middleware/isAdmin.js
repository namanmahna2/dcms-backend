const jwt = require("jsonwebtoken")
const essential = require("../utils/helper");


module.exports = (req, res, next) => {
    if (req.data.role === "admin") {
        next()
    } else {
        return res.status(500).json({
            message: "Authorised only for admins",
            success: false,
            error: error.message || error
        });
    }
}