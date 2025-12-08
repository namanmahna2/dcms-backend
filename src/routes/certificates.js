const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { pinFile, pinJSON } = require("../services/ipfs");
const { contract } = require("../blockchain/certificates");

const upload = multer({ dest: path.join(__dirname, "../../../uploads") });

const certificate_controller = require("../controllers/certificates");
const attack_controller = require("../controllers/attacks");
const authenticator = require("../middleware/authenticator");
const isAdmin = require("../middleware/isAdmin");

router.post("/v1/issue", [authenticator, isAdmin, upload.single("file")], async (req, res) => {
    let data = { ...req.params, ...req.body }
    data.req = req.data

    certificate_controller.generate_degree(data, (error, result) => {
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

router.post("/v1/issue/attack", [authenticator, isAdmin, upload.single("file")], async (req, res) => {
    let data = { ...req.params, ...req.body }
    data.req = req.data

    certificate_controller.generate_fake_degree(data, (error, result) => {
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

router.get("/v1/view", [authenticator, isAdmin], async (req, res) => {
    let data = { ...req.params }
    data.req = req.data

    certificate_controller.get_certificate(data, (error, result) => {
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

router.patch("/v1/revoke/:id", [authenticator, isAdmin], async (req, res) => {
    let data = { ...req.params }
    data.req = req.data

    certificate_controller.revoke_degree(data, (error, result) => {
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

router.get("/v1/verify/:id", [authenticator, isAdmin], async (req, res) => {
    let data = { ...req.params, ...req.files }
    data.req = req.data

    certificate_controller.verify_degree(data, (error, result) => {
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

router.post("/v1/verify/token/:token_id", [authenticator, isAdmin], async (req, res) => {
    let data = { ...req.params, ...req.body }
    data.token = true
    data.req = req.data

    certificate_controller.verify_degree(data, (error, result) => {
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


router.post("/v1/issue/attack/:attack_type", [authenticator, isAdmin, upload.single("file")], async (req, res) => {
    let data = { ...req.params, ...req.body }
    data.req = req.data

    certificate_controller.generate_attack(data, (error, result) => {
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
router.post("/v1/issue/attack_/rapid_mint", [authenticator, isAdmin], async (req, res) => {
    let data = { ...req.params, ...req.body }
    data.req = req.data

    certificate_controller.rapid_mint_attack(data, (error, result) => {
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

router.post("/v1/issue/attack_/sybil", [authenticator, isAdmin], async (req, res) => {
    let data = { ...req.body }
    data.req = req.data

    attack_controller.simulateSybilAttack(data, (error, result) => {
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

router.post("/v1/issue/attack_/botscrappingURI", [authenticator, isAdmin], async (req, res) => {
    let data = { ...req.body }
    data.req = req.data

    attack_controller.simulateBotScraping(data, (error, result) => {
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
