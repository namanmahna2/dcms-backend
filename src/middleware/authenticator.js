const jwt = require('jsonwebtoken');
const essential = require("../utils/helper");
// const session_controller = require("../controller/sessions");

// models
const users_model = require("../models/pgsql/users");
const { findByRefreshToken, findSessionByID } = require('../models/pgsql/sessions');

module.exports = async (req, res, next) => {
    try {
        const refreshToken = req.cookies?.["refresh-token"] && req.cookies["refresh-token"] !== 'undefined'
            ? req.cookies["refresh-token"]
            : req.body?.token;


        const token = req?.headers?.["x-access-token"];

        if (!token) {
            return res.status(401).json({ message: "Access token missing", success: false });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                // Access token expired
                if (!refreshToken) {
                    return res.status(401).json({ message: "Access token expired and no refresh token", success: false });
                }

                try {
                    jwt.verify(refreshToken, process.env.JWT_SECRET);
                    return res.status(401).json({ message: "Access token expired, refresh token valid", success: false });
                } catch (refreshErr) {
                    return res.status(401).json({ message: "Refresh token expired", success: false });
                }
            } else {
                return res.status(401).json({ message: "Token invalid", success: false });
            }
        }

        const decryptedData = await essential.decryptForAccessToken(decoded.encryptedData);

        const is_valid_session = await findSessionByID({ "id": +decryptedData.session_id })

        if (Array.isArray(is_valid_session) && is_valid_session.length > 0) {
            const user_data_ = await users_model.fetchSingleUser({ user_id: decryptedData.user_id })

            const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                req.socket.remoteAddress ||
                req.connection?.remoteAddress;

            // const sessionIsActive = await new Promise((resolve, reject) => {
            //     session_controller.fetchSession({ session_id: decryptedData.session_id, refreshToken }, (result) => {
            //         if (!result || result.success === false) {
            //             reject(new Error(result?.message || "Session not active"));
            //         } else {
            //             resolve(result);
            //         }
            //     });
            // });

            req.data = {
                ...decryptedData,
                "refresh-token": refreshToken,
                client_ip: ip
            };

            next();
        } else {
            return res.status(401).json({
                message: "Session is logout out",
                success: false,
                forceLogout: true
            });
        }

    } catch (error) {
        console.error("Authentication error:", error);
        return res.status(500).json({
            message: "Authentication failed",
            success: false,
            error: error.message || error
        });
    }
};
