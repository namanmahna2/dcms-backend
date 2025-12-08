const express = require("express");
const router = express.Router();
const multer = require("multer");
const authenticator = require("../middleware/authenticator");
const isAdmin = require("../middleware/isAdmin");

const logs_cont = require("../controllers/logs");
const isStudent = require("../middleware/isStudent");

router.post("/v1/insert", [authenticator, isAdmin], async (req, res) => {
    let data = { ...req.body }
    data.req = req.data

    logs_cont.insert_view_log(data, (error, result) => {
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
router.get("/v1/logs", [authenticator, isAdmin], async (req, res) => {
    let data = { ...req.query }
    data.req = req.data

    logs_cont.get_logs(data, (error, result) => {
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
router.get("/v1/dashboard/risk", [authenticator, isAdmin], async (req, res) => {
    let data = { ...req.query }
    data.req = req.data

    logs_cont.risk_dashboard(data, (error, result) => {
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

router.get("/v1/student/:id", [authenticator, isAdmin], async (req, res) => {
    let data = { ...req.params }
    data.req = req.data

    logs_cont.audit_logs_students(data, (error, result) => {
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

router.patch("/v1/block/ip/:security_alert_id", [authenticator, isAdmin], async (req, res) => {
    let data = { ...req.params }
    data.req = req.data

    logs_cont.block_ip(data, (error, result) => {
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

// student login

router.get("/v1/alerts", [authenticator, isStudent], async (req, res) => {
    let data = { ...req.params }
    data.req = req.data

    logs_cont.student_alerts(data, (error, result) => {
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



module.exports = router;
