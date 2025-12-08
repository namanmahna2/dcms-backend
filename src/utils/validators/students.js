const joi = require("joi")


const insertStudent = joi.object({
    first_name: joi.string().required(),
    last_name: joi.string().required(),
    email: joi.string().required(),
    course: joi.string().required(),
    department: joi.number().required(),
    walletAddress: joi.string().optional(),
    phone: joi.string().required(),
    // wallet_provider: joi.string().required,
    wallet_type: joi.string().required()
})


module.exports = {
    insertStudent
}