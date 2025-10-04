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
// const users = require()

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
// app.use()



// ---------------- Disable caching ---------------- //
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

const allowedOrigins = [
    "http://localhost:300"
]

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin) return callback(null, true)
            if (allowedOrigins.includes(origin)) return callback(null, true)
            else return callback(new Error("Not allowed by CORS"))
        },
        credentials: true
    })
)

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
