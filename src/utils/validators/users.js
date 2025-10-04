const joi = require("joi")

const forbidOperatorKey = joi.object().pattern(/^\$|\\./, Joi.forbidden())


const signupJoi = joi.object({
    firstName: joi.string().required(),
    lastName: joi.string().required(),
    email: joi.string().required(),
    password: joi.string().required(),
    walletAddress: joi.string().optional()
})


module.exports = {
    signupJoi
}