const express = require("express")
const router = express.Router();

const authenticator = require("../middleware/authenticator")

const validate = require("../middleware/joiValidator");
const { signupJoi, signinJoi } = require("../utils/validators/users");


const users = require("../controllers/users")




router.post("/v1/signup", validate(signupJoi), (req, res, next) => {
    let data = { ...req.body, ...req.headers }
    // data.req = req.data

    users.signup(data, (error, result) => {
        let status = 0

        if (error) {
            status = error.status
            return res.status(status).send(error)
        } else {
            status = result.status
            return res.status(status).send(result)
        }
    })
})

router.post("/v1/login", validate(signinJoi), (req, res, next) => {
    let data = { ...req.body }


    users.login(data, (error, result) => {
        let status = 0

        if (error) {
            status = error.status
            return res.status(status).send(error)
        } else {
            status = result.status
            console.log("data before sendong", result)

            if (!result.cookiechecker) {
                res.cookie("refresh-token", result.data.token, {
                    httpOnly: false,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'Strict',
                    maxAge: 8 * 60 * 60 * 1000,
                    path: "/"
                })
            } else {
                res.cookie("refresh-token", result.data.token, {
                    httpOnly: false,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'Strict',
                    maxAge: 8 * 60 * 60 * 1000
                })

                res.cookie("x-access-token", result.data["accessToken"], {
                    httpOnly: false,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'Strict',
                    maxAge: 2 * 60 * 60 * 1000,
                    path: "/"
                })
            }
            delete result.data["token"]
            delete result["cookiechecker"]

            return res.status(status).send(result)
        }
    })
})

router.patch("/v1/signout", authenticator, (req, res, next) => {
    let data = { ...req.body };
    data.req = req.data

    users.signout(data, (error, result) => {
        let status = 0

        if (error) {
            status = error.status
            return res.status(status).send(error)
        } else {
            status = result.status

            res.clearCookie("refresh-token", {
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                path: '/'
            });

            res.clearCookie("x-access-token", {
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                path: '/'
            })

            return res.status(status).send(result)
        }
    })
});


router.get("/v1/profile", authenticator, (req, res, next) => {
    let data = { ...req.body }
    data.req = req.data
    users.profile(data, (error, result) => {
        let status = 0

        if (error) {
            status = error.status
            return res.status(status).send(error)
        } else {
            status = result.status
            return res.status(status).send(result)
        }
    })
})
router.get("/v1/cards", authenticator, (req, res, next) => {
    let data = { ...req.body }
    data.req = req.data
    users.dashboard_card(data, (error, result) => {
        let status = 0

        if (error) {
            status = error.status
            return res.status(status).send(error)
        } else {
            status = result.status
            return res.status(status).send(result)
        }
    })
})

router.get("/v1/admin/verify", authenticator, (req, res, next) => {
    let data = { ...req.body }
    data.req = req.data
    users.isAdmin(data, (error, result) => {
        let status = 0

        if (error) {
            status = error.status
            return res.status(status).send(error)
        } else {
            status = result.status
            return res.status(status).send(result)
        }
    })
})

router.patch("/v1/profile", authenticator, (req, res, next) => {
    let data = { ...req.body }
    data.req = req.data
    users.updateProfile(data, (error, result) => {
        let status = 0

        if (error) {
            status = error.status
            return res.status(status).send(error)
        } else {
            status = result.status
            return res.status(status).send(result)
        }
    })
})
router.post("/v1/demo", (req, res, next) => {

    const data = {
        auto_scheduling_features: {
            preferred_drivers: true,
            driver_rating_and_scorecard_metrics: true,
            driver_shift_history: true,
        },

        shift_count: {
            sunday: 12,
            monday: 6,
            tuesday: 8,
            wednesday: 17,
            thursday: 6,
            friday: 5,
            saturday: 10,
        },

        schedule_end_date: "2026-04-25",
        schedule_start_date: "2026-04-19",
        whc: true,

        req: {
            signature: "1776192397692.TZ5AN72UwOuCR",
            app_type: 8,
            client_timezone: "Asia/Kolkata",
            "x-request-id": "77a456b0-eb7c-4442-b4b9-130bce680a08",

            request: {
                method: "POST",
                baseUrl: "/auto_sch",
                cookies: {},
                signedCookies: {},
                fresh: false,
                ip: "::1",
                ips: [],
                secure: false,
                subdomains: [],
                xhr: false,
                hostname: "localhost",
                protocol: "http",
                originalUrl: "/auto_sch/v1/perform?whc=true",
                route: undefined,
                headers: {},
                browser: null,
                os: null,
                device_uid: "28734342d947863270a981006c1fed1d",
                timezone: "Asia/Kolkata",
            },

            auth: {
                payroll_twilio_number: null,
                name: "EMPTYacc neWw",
                account_id: "14412510",
                company_name: "Empty ACC LLC",
                zipcode: "12121",
                dsp_short_code: "bond0",
                phone: "9295331165",
                app_type_name: "scheduler",
                enabledRBAC: true,
                refresh_token: "v1.AQEQDJ00yPHP5HiG5mdlCGp7BvXvT62qT5apOLFEdI4pvBPC6yb_3-SsqYfL7SBcr_53PMoPtrZ0muTkfu29TaI1QnwXIcjhyIwALJQkRtR7XMt5iNtrmXZc-Uhq6_6Lt-w3d-_DhLyIPKZUcGx2d_YSckwdvnmYs45FqEzKL_jbHfNUGQXKdsym8yE3hB7caTqbhB4wTZiT32KQa3sq5FU5emlb6aIDfD3rz0SVMAO0IzEMRyAkpusqmWq5Rw9ZCNt95R67WWyM05WxJIjnMSlvx0zyMgJyat9jYesnWD8SRdxY0Shq_e8NInWcqZJz3ixZEXQMcBm07c4bXsCA_8C9MQ7eC9MEg5Ka43xHzbqN-I5unBkvwgH4db6q-uHYIPB9B1lKOb954G2IOt4ct9D2UudkP0AD6yJAEGHCRozyBpimO-f4m3UghYV2",
                role: "owner",
                timestamp: 1775203382002,
                dob: null,
                permission_json: {},
                station_code: "DYY6",
                timezone: "America/Chicago",
                id: "614",
                company_type: "lmd",
                email: "emptyacc@gmail.com",
                company_id: "168",
            },
        },

        timezone: "Asia/Kolkata",
    }

    users.perform_v3(data, (error, result) => {
        let status = 0

        if (error) {
            status = error.status
            return res.status(status).send(error)
        } else {
            status = result.status
            return res.status(status).send(result)
        }
    })
})


module.exports = router