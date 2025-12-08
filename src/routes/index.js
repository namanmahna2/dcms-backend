const express = require("express")
const router = express.Router();



router.get("/",(req, res, next) => {
    return res.status(200).send({
        message: "server is up",
        success: true
    })

})






module.exports = router