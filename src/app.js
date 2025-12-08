if (process.env.DB_ENV !== "production") {
    require("dotenv").config();
} else {
    console.log("production ENV")
}

const express = require("express")
const cors = require("cors");
const morgan = require("morgan")
const compression = require("compression")
const cookie_parser = require("cookie-parser")
const helmet = require("helmet")

const app = express();

// Routes
const index = require("./routes/index")
const users = require("./routes/users")
const students = require("./routes/students")
const courses_departments = require("./routes/courses_departments")
const certificates = require("./routes/certificates")
const logs = require("./routes/logs")

// models
const blocker_ips_model = require("./models/pgsql/blocked_ips")


const allowedOrigins = ["http://localhost:3000"];
app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            else return callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
    })
);

app.use(async (req, res, next) => {
    try {
        const getClientIp = (req) => {
            return (
                req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
                req.connection?.remoteAddress ||
                req.socket?.remoteAddress ||
                req.connection?.socket?.remoteAddress ||
                req.ip
            );
        };

        const ip = getClientIp(req);
        console.log("ip", ip)
        // Query DB for IP
        let record = await blocker_ips_model.blocked_ips({ ip })
        console.log("record", record)
        record = record[0]
        if (record) {
            console.log(`BLOCKED REQUEST from ${ip} (ID: ${record.id})`);

            return res.status(403).json({
                success: false,
                message: "Access denied. Your IP has been blocked.",
            });
        }

        next();
    } catch (err) {
        console.error("IP block check error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error during IP validation",
        });
    }
});

app.use(express.json())
app.use(compression())
app.use(express.urlencoded({ extended: true }))
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: [],
            }
        },
        frameguard: { action: 'deny' },          // X-Frame-Options
        hsts: { maxAge: 63072000, includeSubDomains: true, preload: true }, // Strict-Transport-Security
        noSniff: true,                            // X-Content-Type-Options
        xssFilter: true,                          // X-XSS-Protection
        referrerPolicy: { policy: 'no-referrer' },
        permissionsPolicy: {
            features: {
                camera: ["'none'"],
                microphone: ["'none'"],
                geolocation: ["'none'"]
            }
        }
    })
)

app.use(cookie_parser())

app.use(
    morgan(`
        :method :url :status :res[content-length] - :response-time ms :remote-addr :user-agent
        `)
)

// Routes
app.use("/index", index)
app.use("/users", users)
app.use("/students", students)
app.use("/dc", courses_departments)
app.use("/cr", certificates)
app.use("/bl_ch", logs)



// ---------------- Disable caching ---------------- //
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

app.use(function (req, res, next) {
    let err = new Error("Not Found");
    err.status = 404;
    next(err);
});

// ---------------- Error Handler ---------------- //
app.use(function (err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};

    res.status(err.status || 500);
    res.send({
        success: false,
        message: res.locals.message,
        error: res.locals.error
    });
});


module.exports = app;
