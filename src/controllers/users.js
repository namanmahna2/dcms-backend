const mute = require("immutable")
const async = require("async")
const validator = require("validator")
const moment = require("moment")
const jwt = require("jsonwebtoken")

const responseStruct = new mute.Map({
    signature: "",
    status: null,
    message: "",
    data: null,
    success: false
})

// Models
const users_model = require("../models/pgsql/users")


const signup = async (data, response, cb) => {
    try {
        const insertData = {
            first_name: data.firstName,
            last_name: data.lastName || "",
            email: data.email,
            wallet_address: data.walletAddress || "",
            password: data.password
        }

        const userData = await users_model.insertUser(insertData)

        
    } catch (error) {
        console.log(error)
        return cb(
            responseStruct.merge({
                signature: "sign11",
                status: 500,
                message: "something went wrong!"
            }).toJS()
        );
    }
}


module.exports = {
    signup
}