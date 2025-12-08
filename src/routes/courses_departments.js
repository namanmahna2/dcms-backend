const express = require("express")
const router = express.Router();

const authenticator = require("../middleware/authenticator")
const isAdmin = require("../middleware/isAdmin")

const c_and_d_controller = require("../controllers/departments_and_courses")



router.get("/v1/departments/courses", [authenticator, isAdmin], (req, res, next) => {
    let data = {}
    data.req = req.data

    c_and_d_controller.get_all_courses_and_departments(data, (error, result) => {
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