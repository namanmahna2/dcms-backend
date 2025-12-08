const joi = require("joi")

const forbidOperatorKey = joi.object().pattern(/^\$|\\./, joi.forbidden())


const signupJoi = joi.object({
    firstName: joi.string().required(),
    lastName: joi.string().required(),
    email: joi.string().required(),
    password: joi.string().required(),
    walletAddress: joi.string().optional(),
    phone: joi.string().optional(),
    role: joi.string().optional()
})
const signinJoi = joi.object({
    email: joi.string().required(),
    password: joi.string().required(),
})


module.exports = {
    signupJoi,
    signinJoi
}