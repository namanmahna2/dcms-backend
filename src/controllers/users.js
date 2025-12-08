const mute = require("immutable")
const async = require("async")
const validator = require("validator")
const moment = require("moment")
const jwt = require("jsonwebtoken")

//Common
const common = require("../utils/helper")

const responseStruct = new mute.Map({
    signature: "",
    status: null,
    message: "",
    data: null,
    success: false
})

// Models
const users_model = require("../models/pgsql/users")
const students_model = require("../models/pgsql/students")
const sessions_model = require("../models/pgsql/sessions")
const { is_already_user, inactive_session } = require("./common")


const signup = async (data, response, cb) => {
    if (!cb) cb = response;
    try {
        const insertData = {
            first_name: data.firstName,
            last_name: data.lastName || "",
            email: data.email,
            wallet_address: data.walletAddress || "ss",
            phone: data.phone,
            ...(data.role && { role: data.role })
        };

        const hashedPassword = await common.passworHash(data.password);
        insertData["password"] = hashedPassword;

        const alreadyPresent = await is_already_user({
            email: insertData.email,
            phone: insertData.phone
        })

        if (alreadyPresent) {
            return cb(responseStruct.merge({
                signature: "sign11",
                status: 400,
                message: "User with same email/phone is already present",
            }).toJS()
            );
        } else {
            const userData = await users_model.insertUser(insertData);

            if (!userData) {
                return cb(
                    responseStruct.merge({
                        signature: "sign11",
                        status: 400,
                        message: "User not created — possible duplicate or invalid data",
                        success: true
                    }).toJS()
                );
            }


            return cb(null,
                responseStruct.merge({
                    signature: "sign11",
                    status: 201,
                    message: "User inserted successfully",
                    // data: userData
                }).toJS()
            );
        }
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

const login = async (data, response, cb) => {
    if (!cb) cb = response

    try {
        if (!data.email || !data.password) {
            return cb(responseStruct.merge({
                signature: "sign11",
                status: 400,
                message: "email/password is required"
            }).toJS())
        }
        const plainTextPass = common.decryptedPassword(data.password)
        const login_data = {
            email: data.email,
            password: plainTextPass
        }

        let user_db_details = await users_model.fetchSingleUser({
            email: data.email,
            login: true
        })
        user_db_details = [user_db_details]

        const isValidPassword = await common.isValidPassword(plainTextPass, {
            hashPass: user_db_details[0].password_hash
        })

        if (isValidPassword) {

            const tokenData = {
                user_id: user_db_details[0].id,
                email: user_db_details[0].email,
                role: user_db_details[0].type,
                user_name: `${user_db_details[0].first_name} ${user_db_details[0].last_name}`,
                date: moment().format("YYYY-MM-DD HH:mm:ss")
            }

            const token = await common.refreshToken(tokenData)

            const ip = data.ip ? data.ip.split('.').slice(0, 3).join('.') + '.x' : "";
            const session_data = {
                session_token: token,
                user_id: user_db_details[0].id,
                role: user_db_details[0].role,
                ip_subnet: ip,
                device_type: data?.['user-agent']?.includes('Mobile') ? 'Mobile' : 'Desktop',
                browser_family: data['user-agent']?.split(' ')[0] || "",
                consent_granted: true,
                data_retention_until: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
            }

            const insertSession = await sessions_model.insert(session_data)

            console.log("insert session details", insertSession)

            const accessTokenData = {
                user_id: user_db_details[0].id,
                email: user_db_details[0].email,
                role: user_db_details[0].role,
                user_name: `${user_db_details[0].first_name} ${user_db_details[0].last_name}`,
                session_id: insertSession.id
            }

            const accessToken = await common.generateAccessToken(accessTokenData)
            let cookiechecker = !user_db_details[0]?.ga_enabled && !user_db_details[0]?.pin_enabled ? true : false
            return cb(null,
                responseStruct
                    .merge({
                        signature: "sign11",
                        status: 200,
                        message: "Login successfully",
                        success: true,
                        data: {
                            ...insertSession,
                            token,
                            accessToken,
                            user_id: accessTokenData.user_id,
                            user_name: accessTokenData.user_name,
                            user_role: accessTokenData.role,
                        },
                        cookiechecker
                    })
                    .toJS()
            )

        } else {
            return cb(responseStruct.merge({
                signature: "sign11",
                status: 400,
                message: "password is not correct"
            }).toJS())
        }
    } catch (error) {
        console.error("Login Error:", error);
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

const signout = async (data, response, cb) => {
    if (!cb) cb = response

    try {
        console.log("controller token", data)
        let refreshToken = data.req["refresh-token"] || data.token

        if (!refreshToken || refreshToken.length === 0) {
            return cb(
                responseStruct
                    .merge({
                        status: 400,
                        message: "Refresh token was not found",
                        success: false,
                    })
                    .toJS()
            );
        } else {
            const fetchSessions = await sessions_model.signout({ refresh_token: refreshToken })

            return cb(
                responseStruct
                    .merge({
                        signature: "sign11",
                        status: 200,
                        message: "signout successful",
                        success: true,
                    })
                    .toJS()
            );
        }
    } catch (error) {
        console.error("Unexpected server error:", error);
        return cb(
            responseStruct
                .merge({
                    signature: "sign11",
                    status: 500,
                    message: "Unexpected server error",
                    success: false,
                })
                .toJS()
        );
    }
}

const refresh = async (data, response, cb) => {
    if (!cb) cb = response;

    try {
        const refreshToken = data['refresh-token'] || data.token;  // use refresh token here
        if (!refreshToken) {
            return cb(
                responseStruct.merge({
                    signature: "sign11",
                    status: 401,
                    message: "Refresh token missing",
                    success: false,
                }).toJS()
            );
        }

        // Verify the refresh token JWT
        jwt.verify(refreshToken, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                if (err.name === "TokenExpiredError") {
                    console.log("Refresh token expired");

                    await inactive_session({ refresh: refreshToken })

                    return cb(
                        responseStruct.merge({
                            signature: "sign11",
                            status: 401,
                            message: "Refresh token expired",
                            success: false,
                        }).toJS()
                    );
                } else {
                    console.log("Refresh token invalid:", err.message);
                    return cb(
                        responseStruct.merge({
                            signature: "sign11",
                            status: 401,
                            message: "Refresh token invalid",
                            success: false,
                        }).toJS()
                    );
                }
            } else {
                const dec__ = await common.decryptForToken(decoded.encryptedData)

                const session = await sessions_model.findByRefreshToken({
                    refresh_token: refreshToken,
                });

                if (Array.isArray(session) && session.length === 0) {
                    return cb(
                        responseStruct.merge({
                            signature: "sign11",
                            status: 401,
                            message: "Session inactive or not found",
                            success: false,
                        }).toJS()
                    );
                }

                const newAccessToken = await common.generateAccessToken(dec__);

                return cb(
                    null,
                    responseStruct
                        .merge({
                            signature: "sign11",
                            status: 201,
                            message: "New access token generated",
                            success: true,
                            data: { accessToken: newAccessToken },
                        })
                        .toJS()
                );
            }
        });
    } catch (error) {
        console.error("Error during refresh token processing:", error);
        return cb(
            responseStruct
                .merge({
                    signature: "sign11",
                    status: 500,
                    message: "Something went wrong",
                    success: false,
                })
                .toJS()
        );
    }
};

const profile = async (data, response, cb) => {
    if (!cb) cb = response


    try {
        console.log("incoming controller data", data)
        const fetch_details = {
            email: data.req.email,
            id: data.req.user_id,
            profile: true,
            ...(data.req.role === "student" && { student: true })
        }

        const userData = await users_model.fetchSingleUser(fetch_details)

        console.log("user data", userData)
        if (!userData) {
            return cb(
                responseStruct.merge({
                    signature: "sign11",
                    status: 400,
                    message: "User not created — possible duplicate or invalid data",
                    success: true
                }).toJS()
            );
        }


        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 201,
                message: "user data",
                data: userData
            }).toJS()
        );
    } catch (error) {
        console.error("profile Error:", error);
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

const dashboard_card = async (data, response, cb) => {
    if (!cb) cb = response

    try {
        const db_result = await students_model.dashboard_cards()

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 201,
                message: "user data",
                data: db_result.rows
            }).toJS()
        );
    } catch (error) {
        console.error("Login Error:", error);
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

const isAdmin = async (data, response, cb) => {
    if (typeof cb !== "function") cb = response

    try {
        const isAdmin = data.req.role === "student" ? false : true

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                success: true,
                status: 201,
                message: "ok",
                data: { isAdmin }
            }).toJS()
        );
    } catch (error) {
        console.error("profile Error:", error);
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

const updateProfile = async (data, response, cb) => {
    if (typeof cb !== "function") cb = response

    try {
        const role = data.req.role
        const update_data = {
            ...(data.phone && data.phone.length > 0 && { phone: data.phone })
        }


        let first_name = ""
        let last_name = ""

        if (data.hasOwnProperty("name") && data.name.length > 0) {
            const split_name = data.name.split(" ")
            first_name = split_name[0].trim().toLowerCase()
            last_name = split_name.slice(1).join(" ").trim().toLowerCase()

            update_data["first_name"] = first_name
            update_data["last_name"] = last_name
        }

        if (Object.keys(update_data).length > 0) {
            const update_result = await users_model.update_user(update_data, {
                role,
                id: data.req.user_id
            })

            if (update_result === "update successfull") {
                return cb(null,
                    responseStruct.merge({
                        signature: "sign11",
                        status: 201,
                        message: "update successfully",
                        success: true,
                    }).toJS()
                );
            }
        } else {
            return cb(
                responseStruct.merge({
                    signature: "sign11",
                    status: 400,
                    message: "no data for update",
                    success: true,
                }).toJS()
            );
        }


    } catch (error) {
        console.error("profile Error:", error);
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
    signup,
    login,
    profile,
    dashboard_card,
    signout,
    refresh,
    isAdmin,
    updateProfile
}