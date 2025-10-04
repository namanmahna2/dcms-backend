const express = require("express")
const router = express.Router();

const validate = require("../middleware/joiValidator");
const { signupJoi } = require("../utils/validators/users");


const users = require("../controllers/users")



router.post("/v1/signup", validate(signupJoi), (req, res, next) => {
    let data = { ...req.body }
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






module.exports = router