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


module.exports = router