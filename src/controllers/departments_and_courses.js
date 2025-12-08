const mute = require("immutable")
const async = require("async")
const validator = require("validator")
const moment = require("moment")

const c_and_d_model = require("../models/pgsql/c_and_d")

const responseStruct = new mute.Map({
    signature: "",
    status: null,
    message: "",
    data: null,
    success: false
})

const get_all_courses_and_departments = async (data, response, cb) => {
    if (!cb) cb = response

    try {
        const db_result = await c_and_d_model.get_c_and_d_all()

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 200,
                message: "ok",
                data: db_result.rows
            }).toJS()
        );
    } catch (error) {
        console.error("Signup Error:", error);
        return cb(
            responseStruct.merge({
                signature: "sign11",
                status: 500,
                message: error.code === '23505'
                    ? "Email already exists"
                    : "Something went wrong!",
            }).toJS()
        );
    }
}

module.exports = {
    get_all_courses_and_departments
}