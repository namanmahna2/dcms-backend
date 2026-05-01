const express = require("express")
const router = express.Router();
const pg = require("../models/pgsql/index")
const redis = require("../models/redis/db")

// readiness check
router.get("/ready", async (req, res) => {
    try {
        await pg.raw('SELECT 1');
        const redisRes = await redis.ping();

        if (redisRes !== "PONG") {
            throw new Error("Redis not responding");
        }

        return res.status(200).json({
            message: "server is ready",
            success: true
        });

    } catch (error) {
        console.error("Readiness FAILED:", error);

        return res.status(500).json({
            message: "NOT READY",
            error: error.message,
            success: false
        });
    }
});

// health check
router.get("/health", (req, res, next) => {
    return res.status(200).send({
        message: "ok",
        success: true
    })

})





module.exports = router