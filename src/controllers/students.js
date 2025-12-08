const mute = require("immutable")
const async = require("async")
const validator = require("validator")
const moment = require("moment")
const jwt = require("jsonwebtoken")
const { ethers } = require("ethers")
const { encryptPrivateKey_wallet, getKeyFromEnv_wallet } = require("../utils/helper")
//Common
const common = require("../utils/helper")

const user_model = require("../models/pgsql/users")
const db = require("../models/pgsql/index")
const { build_password_hash_student } = require("./common")
const student_model = require("../models/pgsql/students")

const responseStruct = new mute.Map({
    signature: "",
    status: null,
    message: "",
    data: null,
    success: false
})


const insert = async (data, response, cb) => {
    if (!cb) cb = response;

    try {
        const student_uni_id = common.generateStudentId()
        let wallet;
        let walletTmp;

        if (data.wallet_type === "byo" && data.byo_address) {
            console.log("coming in future")
        } else {
            walletTmp = ethers.Wallet.createRandom();
        }

        const insert_data = {
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            course_name: data.course,
            department: data.department,
            student_id: student_uni_id,
            wallet_address: walletTmp.address
        }

        const result = await db.transaction(async (trx) => {
            const studentInsertion = await trx("dcms_students")
                .insert(insert_data)
                .returning(["id"])

            const student_id = studentInsertion[0].id

            if (data.wallet_mode === "byo" && data.byo_address) {
                return cb(null,
                    responseStruct.merge({
                        signature: "sign11",
                        status: 400,
                        message: "functionality underway",
                    }).toJS()
                );
            } else {

                const key = getKeyFromEnv_wallet()

                const enc = encryptPrivateKey_wallet(walletTmp.privateKey, key)

                // insert in users table
                const passwordHash = await build_password_hash_student()

                const insert_as_user = {
                    first_name: data.first_name,
                    last_name: data.last_name,
                    email: data.email,
                    phone: data.phone,
                    password: passwordHash,
                    wallet_address: walletTmp.address,
                    role: "student",
                    student_id: student_id
                }

                const { id: student_user_id } = await user_model.insertUser(insert_as_user, {
                    trx,
                    ownTrx: true
                })

                const [walletRow] = await trx("dcms_wallets")
                    .insert({
                        user_id: student_user_id,
                        address: walletTmp.address,
                        custody: "custodial",
                        pk_ciphertext: enc.ciphertext_b64,
                        pk_iv: enc.iv_b64,
                        pk_tag: enc.tag_b64
                    })
                    .returning(["id", "address"])

                wallet = walletRow
            }


            // update student table with wallet address
            await trx("dcms_students")
                .where({
                    id: student_id
                })
                .update({
                    wallet_address: wallet.address
                })

            return cb(null,
                responseStruct.merge({
                    signature: "sign11",
                    status: 201,
                    success: true,
                    message: "student inserted successfully",
                    data: {
                        student_id: student_id,
                        wallet_address: wallet.address
                    }
                }).toJS()
            );
        })
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

const get = async (data, response, cb) => {
    if (!cb) cb = response;
    try {
        const student_data = await student_model.get_all(
            {
                ...(data.unissued && { tx_hash: "null" })
            }
        )
        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 200,
                success: true,
                message: "ok",
                data: student_data
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

const get_by_id = async (data, response, cb) => {
    if (!cb) cb = response;

    try {
        const fetch_data = {
            id: data.id
        }

        const dbResult = await student_model.get_by_id(fetch_data)
        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 200,
                success: true,
                message: "ok",
                data: dbResult.rows
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

const update_by_id = async (data, response, cb) => {
    if (!cb) cb = response;
    try {
        if (!data.id) {
            return res.status(400).json({
                signature: "sign11",
                status: 400,
                success: false,
                message: "Student ID is required",
            });
        }

        const update_data = {
            student: {
                ...(data.first_name && { first_name: data.first_name }),
                ...(data.last_name && { last_name: data.last_name }),
                ...(data.email && { email: data.email }),
                ...(data.course_code && { course_code: data.course_code }),
                ...(data.department_id && { department_id: data.department_id }),
            },
            ...(data.phone && { phone: data.phone }),
            ...(data.wallet_type && { custody: data.wallet_type }),
        };

        const where_data = { id: data.id };

        const db_result = await student_model.update_by_id(update_data, where_data);

        if (!db_result || db_result?.success !== true) {
            return cb(
                responseStruct.merge({
                    signature: "sign11",
                    status: 304,
                    success: false,
                    message: "No changes made to student record",
                }).toJS()
            );
        }

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 200,
                success: true,
                message: "Student record updated successfully",
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
};

const delete_by_id = async (data, response, cb) => {
    if (!cb) cb = response;

    try {
        const where_data = {
            id: data.id
        }
        const db_result = await student_model.delete_by_id(where_data)

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 200,
                success: true,
                message: "delete successfully",
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

const get_details_for_dashboard = async (data, response, cb) => {
    if (!cb) cb = response;

    try {
        const db_result = await student_model.total_degree_by_month()

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 200,
                success: true,
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

const get_revoked_students = async (data, response, cb) => {
    if (!cb) cb = response;

    try {
        const db_result = await student_model.revoked_students()

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 200,
                success: true,
                message: "revoked students",
                data: db_result
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

const degree_of_student = async (data, response, cb) => {
    if (!cb) cb = response;

    try {
        const db_result = await student_model.find_degree_info({
            user_id: data.req.user_id
        })

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 200,
                success: true,
                message: "ok",
                data: db_result
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
    insert,
    get,
    get_by_id,
    update_by_id,
    delete_by_id,
    get_details_for_dashboard,
    get_revoked_students,
    degree_of_student
}