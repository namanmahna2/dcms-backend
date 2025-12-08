const express = require("express")
const router = express.Router();

const authenticator = require("../middleware/authenticator")
const isAdmin = require("../middleware/isAdmin")

const validate = require("../middleware/joiValidator");


const students = require("../controllers/students");
const { insertStudent } = require("../utils/validators/students");
const isStudent = require("../middleware/isStudent");


router.post("/v1/in", [authenticator, isAdmin, validate(insertStudent)], (req, res, next) => {
    let data = { ...req.body, ...req.headers }
    data.req = req.data

    students.insert(data, (error, result) => {
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

router.get("/v1/all", [authenticator, isAdmin], (req, res, next) => {
    let data = { ...req.query }
    data.req = req.data

    students.get(data, (error, result) => {
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

router.get('/v1/info/:id', [authenticator, isAdmin], (req, res, next) => {
    let data = { ...req.params }
    data.req = req.data

    students.get_by_id(data, (error, result) => {
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

router.patch('/v1/update/:id', [authenticator, isAdmin], (req, res, next) => {
    let data = { ...req.params, ...req.body }
    data.req = req.data

    students.update_by_id(data, (error, result) => {
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

router.delete('/v1/del/:id', [authenticator, isAdmin], (req, res, next) => {
    let data = { ...req.params }
    data.req = req.data

    students.delete_by_id(data, (error, result) => {
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

router.get("/v1/trend/degree", [authenticator, isAdmin], async (req, res) => {
    let data = { ...req.query }
    data.req = req.data

    students.get_details_for_dashboard(data, (error, result) => {
        let status = 0

        if (error) {
            status = error.status
            return res.status(status).send(error)
        } else {
            status = result.status
            return res.status(status).send(result)
        }
    })
});

router.get("/v1/revoked", [authenticator, isAdmin], async (req, res) => {
    let data = {}
    data.req = req.data

    students.get_revoked_students(data, (error, result) => {
        let status = 0

        if (error) {
            status = error.status
            return res.status(status).send(error)
        } else {
            status = result.status
            return res.status(status).send(result)
        }
    })
});

router.get("/v1/degree/info", [authenticator, isStudent], async (req, res) => {
    let data = {}
    data.req = req.data

    students.degree_of_student(data, (error, result) => {
        let status = 0

        if (error) {
            status = error.status
            return res.status(status).send(error)
        } else {
            status = result.status
            return res.status(status).send(result)
        }
    })
});



module.exports = router