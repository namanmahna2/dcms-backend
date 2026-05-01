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

        if (!user_db_details) {
            return cb(responseStruct.merge({
                signature: "sign11",
                status: 404,
                message: "user not registered"
            }).toJS())
        }

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

const perform_v3 = async (data, response, cb) => {
    if (!cb) cb = response;

    // if (!data.req.auth.company_id || !data.req.auth.id || !data.timezone) {
    //     return cb(
    //         responseStruct.merge({
    //             signature: data?.req?.signature,
    //             action: "perform auto_scheduling",
    //             status: 401,
    //             success: false,
    //             message: "Unauthorized Access!",
    //         }).toJS()
    //     );
    // }

    if (!data.shift_count || Object.keys(data.shift_count).length < 1) {
        return cb(
            responseStruct.merge({
                signature: data?.req?.signature,
                action: "perform auto_scheduling",
                status: 400,
                success: false,
                message: "param missing",
            }).toJS()
        );
    }

    if (moment(data.schedule_end_date).isBefore(moment(data.schedule_start_date))) {
        return cb(
            responseStruct.merge({
                signature: data?.req?.signature,
                action: "perform auto_scheduling",
                status: 400,
                success: false,
                message: "schedule_end_date should be greater than schedule_start_date",
            }).toJS()
        );
    }

    try {
        // await company_preferences.updateCompanyPreference({
        //     company_id: data.req.auth.company_id,
        //     auto_scheduling_features: data.auto_scheduling_features,
        //     added_by: data.req.auth.id,
        // });

        const dates = getAllDates([
            moment(data.schedule_start_date).format("YYYY-MM-DD"),
            moment(data.schedule_end_date).format("YYYY-MM-DD"),
        ]);

        const dayAndDates = fetchDaysFromDates(dates);

        // let uniqueSchedules = await schedule_rule.uniqueSchedules({
        //     company_id: data.req.auth.company_id,
        // });

        let sch_rule_data = [
            {
                id: 369,
                name: 'STEP VANS',
                type: 'lmd',
                color: '#2a7a8b',
                set_break: false,
                break_time: null,
                created_at: '2024-01-18',
                reminder_time: '{"value":"10","duration":"minutes"}',
                working_hours: [
                    {
                        "title": "All",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Sunday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Monday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Tuesday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Wednesday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Thursday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Friday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Saturday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    }
                ],
                preferred_driver: '6458,2967,6469,6492,7393,2980,6465',
                break_duration_start: null
            },
            {
                id: 1044,
                name: 'MMDD',
                type: 'mmd',
                color: '#b8e986',
                set_break: false,
                break_time: null,
                created_at: '2024-06-07',
                reminder_time: '{"value":"1","duration":"days"}',
                working_hours: [
                    {
                        "title": "All",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Sunday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Monday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Tuesday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Wednesday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Thursday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Friday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Saturday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    }
                ],
                preferred_driver: '6469,7393',
                break_duration_start: null
            },
            {
                id: 1524,
                name: 'auto schedule',
                type: 'lmd',
                color: 'black',
                set_break: false,
                break_time: null,
                created_at: '2024-12-16',
                reminder_time: '{"value":"5","duration":"minutes"}',
                working_hours: [
                    {
                        "title": "All",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Sunday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Monday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Tuesday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Wednesday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Thursday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Friday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Saturday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    }
                ],
                preferred_driver: '2967',
                break_duration_start: null
            },
            {
                id: 1871,
                name: 'Argonn',
                type: 'lmd',
                color: '#7030af',
                set_break: false,
                break_time: null,
                created_at: '2025-10-16',
                reminder_time: '{"value":"2","duration":"minutes"}',
                working_hours: [
                    {
                        "title": "All",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Sunday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Monday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Tuesday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Wednesday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Thursday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Friday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Saturday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    }
                ],
                preferred_driver: '15992,15971,6558',
                break_duration_start: null
            },
            {
                id: 1874,
                name: 'Xenon',
                type: 'lmd',
                color: '#56adf5',
                set_break: false,
                break_time: null,
                created_at: '2025-10-17',
                reminder_time: '{"value":"18","duration":"hours"}',
                working_hours: [
                    {
                        "title": "All",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Sunday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Monday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Tuesday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Wednesday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Thursday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Friday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    },
                    {
                        "title": "Saturday",
                        "startTime": "10:00 AM",
                        "endTime": "06:00 PM",
                        "isSelected": true,
                        "totalHours": ""
                    }
                ],
                preferred_driver: '',
                break_duration_start: null
            },
        ]

        const formattedData = {};
        sch_rule_data.forEach((item) => {
            const { id, ...rest } = item;
            formattedData[id] = { id, ...rest };
        });

        let contextObj = {
            startDate: data.schedule_start_date,
            company_id: data.req.auth.company_id,
            company_type: data.req.auth.company_type,
            shift_count: data.shift_count,
            dayAndDates,
            formattedData,
        };

        let shiftHistoryData = {};
        let preferredDriversData = {
            sunday: {
                '369': { '2967': 1, '6458': 1, '6465': 1, '6469': 1, '6492': 1 },
                '1044': { '6469': 1 },
                '1524': { '2967': 1 },
                '1871': { '6558': 1, '15971': 1, '15992': 1 },
                '1874': {},
                '1876': {},
                '1877': { '2967': 1, '2985': 1 },
                '1878': {}
            },
            monday: {
                '369': {},
                '1044': {},
                '1524': { '2967': 1 },
                '1871': { '6558': 1, '15971': 1, '15992': 1 },
                '1874': {},
                '1876': {},
                '1877': { '2967': 1, '2985': 1 },
                '1878': {}
            },
            tuesday: {
                '369': { '6469': 1 },
                '1044': { '6469': 1 },
                '1524': {},
                '1871': { '6558': 1, '15971': 1, '15992': 1 },
                '1874': {},
                '1876': {},
                '1877': { '2985': 2 },
                '1878': {}
            },
            wednesday: {
                '369': { '2967': 2, '6458': 1, '6469': 1, '6492': 1 },
                '1044': { '6469': 1 },
                '1524': { '2967': 1 },
                '1871': { '15971': 2, '15992': 1 },
                '1874': {},
                '1876': {},
                '1877': { '2967': 2 },
                '1878': {}
            },
            thursday: {
                '369': {},
                '1044': {},
                '1524': {},
                '1871': { '15971': 2, '15992': 1 },
                '1874': {},
                '1876': {},
                '1877': {},
                '1878': {}
            },
            friday: {
                '369': {},
                '1044': {},
                '1524': {},
                '1871': { '15971': 2, '15992': 1 },
                '1874': {},
                '1876': {},
                '1877': { '2967': 2 },
                '1878': {}
            },
            saturday: {
                '369': { '2967': 1, '6469': 1, '6492': 1 },
                '1044': { '6469': 1 },
                '1524': { '2967': 1 },
                '1871': { '15992': 3 },
                '1874': {},
                '1876': {},
                '1877': { '2967': 2 },
                '1878': {}
            }
        };
        let ratingData = {
            sunday: {
                '369': { '6463': 1, '6560': 1 },
                '1044': { '2982': 1, '13760': 1 },
                '1524': { '2985': 1, '6460': 1 },
                '1871': { '14071': 1, '14367': 1 },
                '1874': { '6508': 1 },
                '1876': { '2967': 1 },
                '1877': { '2984': 1 },
                '1878': { '6469': 1 }
            },
            monday: {
                '369': { '6458': 1 },
                '1044': { '6558': 1 },
                '1524': { '6463': 1 },
                '1871': { '6560': 1 },
                '1874': { '13760': 1 },
                '1876': { '2982': 1 }
            },
            tuesday: {
                '369': { '6460': 1 },
                '1044': { '2985': 1 },
                '1524': { '14367': 1 },
                '1871': { '14071': 1 },
                '1874': { '6508': 1 },
                '1876': { '2967': 1 },
                '1877': { '2984': 1 },
                '1878': { '6469': 1 }
            },
            wednesday: {
                '369': { '6458': 1, '6463': 1, '6558': 1 },
                '1044': { '6560': 1, '13760': 1 },
                '1524': { '2982': 1, '6460': 1 },
                '1871': { '2985': 1, '14367': 1 },
                '1874': { '6508': 1, '14071': 1 },
                '1876': { '2967': 1, '2984': 1 },
                '1877': { '6458': 1, '6469': 1 },
                '1878': { '6463': 1, '6558': 1 }
            },
            thursday: {
                '369': { '6560': 1 },
                '1044': { '13760': 1 },
                '1524': { '2982': 1 },
                '1871': { '6460': 1 },
                '1874': { '2985': 1 },
                '1876': { '14367': 1 }
            },
            friday: {
                '369': { '14071': 1 },
                '1044': { '6508': 1 },
                '1524': { '2967': 1 },
                '1871': { '2984': 1 },
                '1874': { '6469': 1 }
            },
            saturday: {
                '369': { '6458': 1, '6558': 1 },
                '1044': { '6463': 1, '6560': 1 },
                '1524': { '13760': 1 },
                '1871': { '2982': 1 },
                '1874': { '6460': 1 },
                '1876': { '2985': 1 },
                '1877': { '14367': 1 },
                '1878': { '14071': 1 }
            }
        };

        let filterHistory = data.auto_scheduling_features?.driver_shift_history;
        let preferredDrivers = data.auto_scheduling_features?.preferred_drivers;
        let driverRating = data.auto_scheduling_features?.driver_rating_and_scorecard_metrics;

        const getEligibleDrivers = async (contextObj) => {
            if (filterHistory && preferredDrivers && driverRating) {
                // shiftHistoryData = await getDriversByShiftHistory(contextObj);
                shiftHistoryData = {
                    saturday: { '1871': { '6558': 1 } },
                    monday: {
                        '1871': { '15971': 1, '15973': 2 },
                        '1878': { '6460': 1, '6558': 1, '15971': 1 }
                    },
                    friday: { '1871': { '6558': 1, '15973': 4 } },
                    sunday: { '1871': { '15971': 1 }, '1878': { '15971': 1 } },
                    wednesday: { '1871': { '15973': 2 }, '1877': { '15973': 2 } },
                    tuesday: { '1871': { '15973': 1 } }
                };

                // preferredDriversData = await getPreferredDrivers(contextObj);
                // ratingData = await getDriversByRating(contextObj);

            } else if (filterHistory && preferredDrivers) {
                // shiftHistoryData = await getDriversByShiftHistory(contextObj);
                shiftHistoryData = {
                    saturday: { '1871': { '6558': 1 } },
                    monday: {
                        '1871': { '15971': 1, '15973': 2 },
                        '1878': { '6460': 1, '6558': 1, '15971': 1 }
                    },
                    friday: { '1871': { '6558': 1, '15973': 4 } },
                    sunday: { '1871': { '15971': 1 }, '1878': { '15971': 1 } },
                    wednesday: { '1871': { '15973': 2 }, '1877': { '15973': 2 } },
                    tuesday: { '1871': { '15973': 1 } }
                }
                // preferredDriversData = await getPreferredDrivers(contextObj);

            } else if (filterHistory && driverRating) {
                // shiftHistoryData = await getDriversByShiftHistory(contextObj);
                shiftHistoryData = {
                    saturday: { '1871': { '6558': 1 } },
                    monday: {
                        '1871': { '15971': 1, '15973': 2 },
                        '1878': { '6460': 1, '6558': 1, '15971': 1 }
                    },
                    friday: { '1871': { '6558': 1, '15973': 4 } },
                    sunday: { '1871': { '15971': 1 }, '1878': { '15971': 1 } },
                    wednesday: { '1871': { '15973': 2 }, '1877': { '15973': 2 } },
                    tuesday: { '1871': { '15973': 1 } }
                }
                // ratingData = await getDriversByRating(contextObj);

            } else if (preferredDrivers && driverRating) {
                // preferredDriversData = await getPreferredDrivers(contextObj);
                // ratingData = await getDriversByRating(contextObj);

            } else if (filterHistory) {
                // shiftHistoryData = await getDriversByShiftHistory(contextObj);
                shiftHistoryData = {
                    saturday: { '1871': { '6558': 1 } },
                    monday: {
                        '1871': { '15971': 1, '15973': 2 },
                        '1878': { '6460': 1, '6558': 1, '15971': 1 }
                    },
                    friday: { '1871': { '6558': 1, '15973': 4 } },
                    sunday: { '1871': { '15971': 1 }, '1878': { '15971': 1 } },
                    wednesday: { '1871': { '15973': 2 }, '1877': { '15973': 2 } },
                    tuesday: { '1871': { '15973': 1 } }
                }

            } else if (preferredDrivers) {
                // preferredDriversData = await getPreferredDrivers(contextObj);

            } else if (driverRating) {
                // ratingData = await getDriversByRating(contextObj);

            } else {
                console.log("No specific auto scheduling feature enabled, fetching all data as default");
            }
        };

        await getEligibleDrivers(contextObj);

        console.log("shiftHistoryData", shiftHistoryData);

        const createShiftsInput = {
            data,
            dayAndDates,
            shiftHistoryData,
            preferredDriversData,
            ratingData,
            company_id: data.req.auth.company_id,
            company_type: data.req.auth.company_type,
            added_by: data.req.auth.id,
            timezone: data.timezone,
            formattedData,
        };

        const finalShiftsData = await createShiftsforAutoSch(createShiftsInput);

        let totalShiftCount = 0;
        for (const day in data.shift_count) {
            totalShiftCount += data.shift_count[day];
        }

        if (finalShiftsData.length === 0) {
            return cb(
                responseStruct.merge({
                    signature: data?.req?.signature,
                    action: "perform auto_scheduling",
                    status: 404,
                    success: false,
                    message: "No data found for auto scheduling",
                }).toJS()
            );
        }

        return cb(
            responseStruct.merge({
                signature: data?.req?.signature,
                action: "perform auto_scheduling",
                status: 201,
                success: true,
                message: "auto scheduling shifts created successfully",
                // data: {
                //     shifts: finalShiftsData.shiftIds,
                //     expected_count: +totalShiftCount,
                // },
            }).toJS()
        );

    } catch (err) {
        return cb(
            responseStruct.merge({
                signature: data?.req?.signature,
                action: "perform auto_scheduling",
                status: 500,
                success: false,
                message: err.message || "something went wrong!",
            }).toJS()
        );
    }
};

const getDriversByShiftHistory = async (context) => {
    const res = await ind_schedule_v2.filterByShiftHistory(context);
    const result = {};
    res.forEach((row) => {
        const { schedule_rule_id, driver_id, schedule_date } = row;
        const day = String(moment(schedule_date).format("dddd")).toLowerCase();
        if (!result[day]) { result[day] = {}; } // init schedule_rule_id 
        if (!result[day][schedule_rule_id]) {
            result[day][schedule_rule_id] = {};
        } // init driver_id
        if (!result[day][schedule_rule_id][driver_id]) { result[day][schedule_rule_id][driver_id] = 0; } // increment count 
        result[day][schedule_rule_id][driver_id] += 1;
    }); return result;
};

const getPreferredDrivers = async (context) => {
    const res = await schedule_rule.filterPreferredDrivers(context);

    const finalResult = {};

    // Collect all unique driver IDs
    const allDriverIds = new Set();

    res.rows.forEach((rule) => {
        (rule.preferred_driver || []).forEach((id) => {
            allDriverIds.add(String(id));
        });
    });

    // 🔹 Fetch availability once
    const availabilityMap = await getAllDriversAvailability(
        Array.from(allDriverIds),
        context.company_type
    );

    Object.keys(context.shift_count).forEach((day) => {
        const distributed = calculate_shifts(res.rows, {
            [day]: context.shift_count[day],
        });

        const dayResult = {};

        distributed.forEach((obj) => {
            const key = Object.keys(obj)[0];
            dayResult[key] = obj[key];
        });

        finalResult[day] = dayResult;
    });

    // APPLY AVAILABILITY LOGIC
    const finalAdjusted = adjustWithAvailability(finalResult, availabilityMap);

    return finalAdjusted;
};

const calculate_shifts = (schedule_data, shift_count) => {
    // console.log("Shift counts", shift_count);

    const total_shifts = Object.values(shift_count)[0] || 0;
    // console.log("Total shifts to distribute", total_shifts);

    let shifts_per_sch = Math.floor(total_shifts / schedule_data.length);
    let extra_shifts = total_shifts % schedule_data.length;

    let final_data = [];

    for (let obj of schedule_data) {
        let allocated = shifts_per_sch;

        // adjust based on preferred drivers count
        if (obj.preferred_driver.length < shifts_per_sch) {
            extra_shifts += (shifts_per_sch - obj.preferred_driver.length);
            allocated = obj.preferred_driver.length;

        } else if (extra_shifts > 0) {
            let possible = shifts_per_sch + extra_shifts;

            if (possible <= obj.preferred_driver.length) {
                allocated = possible;
                extra_shifts = 0;
            } else {
                allocated = obj.preferred_driver.length;
                extra_shifts = possible - obj.preferred_driver.length;
            }
        }

        // driver-wise distribute
        let driverMap = {};

        if (obj.preferred_driver.length > 0 && allocated > 0) {
            let perDriver = Math.floor(allocated / obj.preferred_driver.length);
            let remainder = allocated % obj.preferred_driver.length;

            obj.preferred_driver.forEach((driverId) => {
                let count = perDriver;

                // remainder distribute
                if (remainder > 0) {
                    count += 1;
                    remainder--;
                }

                if (count > 0) {
                    driverMap[driverId] = count;
                }
            });
        }

        final_data.push({ [obj.id]: driverMap });
    }

    // console.log("Final shift distribution", final_data);

    return final_data;
};

const getDriversByRating = async (context) => {
    const drivers = new Drivers(context.company_type);
    const res = await drivers.filterDriversByRating(context);

    console.log("Drivers sorted by rating", res);

    // res already sorted high → low rating
    const finalResult = distributeDrivers(context, res);

    return finalResult;
};

const distributeDrivers = (context, driversList) => {
    const result = {};
    const shiftCount = context.shift_count;
    const ruleIds = Object.keys(context.formattedData);

    console.log("Distributing drivers based on rating", ruleIds);

    let driverIndex = 0;

    for (const day in shiftCount) {
        const totalShifts = shiftCount[day];
        const ruleCount = ruleIds.length;

        const base = Math.floor(totalShifts / ruleCount);
        let extra = totalShifts % ruleCount;

        result[day] = {};

        for (const ruleId of ruleIds) {
            let shiftsForRule = base;

            if (extra > 0) {
                shiftsForRule += 1;
                extra--;
            }

            if (shiftsForRule === 0) continue;

            result[day][ruleId] = {};

            for (let i = 0; i < shiftsForRule; i++) {
                const driver =
                    driversList[driverIndex % driversList.length];
                const driverId = driver.driver_id;

                if (!result[day][ruleId][driverId]) {
                    result[day][ruleId][driverId] = 0;
                }

                result[day][ruleId][driverId] += 1;
                driverIndex++;
            }
        }
    }

    console.log("Driver distribution based on rating", result);

    return result;
};


const getAllDriversAvailability = async (driverIds, company_type) => {
    const result = {};
    let schedulerDriverDetails = new SchedulerDriverDetails(company_type);

    await Promise.all(
        driverIds.map((id) => {
            return new Promise((resolve, reject) => {
                schedulerDriverDetails.get_availability_auto_scheduling(
                    id,
                    (err, data) => {
                        if (err) return reject(err);

                        result[id] = data;
                        resolve();
                    }
                );
            });
        })
    );

    return result;
};

const adjustWithAvailability = (finalResult, availabilityMap) => {
    Object.keys(finalResult).forEach((day) => {
        const schedules = finalResult[day];

        Object.keys(schedules).forEach((scheduleId) => {
            const driverMap = schedules[scheduleId];
            const driverIds = Object.keys(driverMap);

            let extraCount = 0;

            // Step 1: remove unavailable drivers
            driverIds.forEach((driverId) => {
                if (!availabilityMap[driverId]?.[day]) {
                    extraCount += driverMap[driverId];
                    delete driverMap[driverId];
                }
            });

            // Step 2: redistribute
            const availableDrivers = Object.keys(driverMap);
            let i = 0;

            while (extraCount > 0 && availableDrivers.length > 0) {
                const driverId =
                    availableDrivers[i % availableDrivers.length];

                driverMap[driverId] += 1;
                extraCount--;
                i++;
            }
        });
    });

    return finalResult;
};

const trimShiftsDayWise = (shifts, shiftCount) => {
    const dayMap = {};

    for (const shift of shifts) {
        const day = moment(shift.schedule_date)
            .format("dddd")
            .toLowerCase();

        if (!dayMap[day]) dayMap[day] = [];
        dayMap[day].push(shift);
    }

    let result = [];

    for (const day in dayMap) {
        const allowed = shiftCount[day] || 0;
        result.push(...dayMap[day].slice(0, allowed));
    }

    return result;
};

const checkUnaviableDrivers = async (
    dayAndDates,
    company_id,
    company_type
) => {
    const dates = Object.values(dayAndDates);

    const isOnLeave = await time_off.fetchAllTimeOff({
        company_id,
        dates,
        company_type,
    });

    const leaveMap = {};

    isOnLeave.forEach((item) => {
        const date = moment(item.start_date).format("YYYY-MM-DD");

        if (!leaveMap[date]) {
            leaveMap[date] = new Set();
        }

        leaveMap[date].add(item.driver_id);
    });

    const VTOData = await vto.fetchVTOforDrivers({
        company_id,
        dates,
    });

    const finalMap = { ...leaveMap };

    Object.keys(VTOData).forEach((date) => {
        if (!finalMap[date]) {
            finalMap[date] = new Set(VTOData[date]);
        } else {
            VTOData[date].forEach((driverId) => {
                finalMap[date].add(driverId);
            });
        }
    });

    const callOutData = await call_out.getCalloutForAutoSch({
        company_id,
        dates,
    });

    Object.keys(callOutData).forEach((date) => {
        if (!finalMap[date]) {
            finalMap[date] = new Set(callOutData[date]);
        } else {
            callOutData[date].forEach((driverId) => {
                finalMap[date].add(driverId);
            });
        }
    });

    return finalMap;
};

const handleWHCRules = async (finalShiftsData, data) => {
    if (!data.whc) {
        const isMMD = data.req.auth.company_type === "mmd";

        const lmdShifts = finalShiftsData.filter((shift) => {
            const assignId = isMMD
                ? shift.assign_to_mmd
                : shift.assign_to;

            return shift.type === "lmd" && assignId !== null;
        });

        for (const schedule of lmdShifts) {
            const driverId = isMMD
                ? schedule.assign_to_mmd
                : schedule.assign_to;

            const whcResult = await checkWHCRules({
                driver_id: driverId,
                schedule_date: schedule.schedule_date,
                company_type: data.req.auth.company_type,
                start_time: schedule.shift_duration_start,
                end_time: schedule.shift_duration_end,
            });

            if (!whcResult.isValid) {
                throw {
                    status: 400,
                    message: "WHC Rules Violated",
                    data: whcResult.violations,
                };
            }
        }
    }

    return true;
};

const getAllDates = (dates) => {
    if (Array.isArray(dates) && dates.length > 1) {
        let finalDates = [];
        let startDate = moment(dates[0], "YYYY-MM-DD");
        let endDate = moment(dates[1], "YYYY-MM-DD");

        while (startDate.isSameOrBefore(endDate)) {
            finalDates.push(startDate.format("YYYY-MM-DD"));
            startDate.add(1, "days");
        }

        return finalDates;
    } else if (Array.isArray(dates) && dates.length === 1) {
        return dates;
    } else {
        throw new Error(`dates must be an array, received ${typeof dates}`);
    }
};

const fetchDaysFromDates = (dates) =>
    dates.reduce((acc, date) => {
        const day = moment(date, "YYYY-MM-DD")
            .format("dddd")
            .toLowerCase();

        (acc[day] ||= []).push(date);
        return acc;
    }, {});


const prepareShiftInsertionData = async ({
    shiftHistoryData,
    dayAndDates,
    formattedData,
    company_id,
    company_type,
    added_by,
    timezone,
}) => {
    let shiftInsertion = [];

    const unavailableDriverMap = await checkUnaviableDrivers(
        dayAndDates,
        company_id,
        company_type
    );
    let xx = {
        "monday": {
            "s1": [d1, d3]
        }
    }

    // console.log("Unavailable driver IDs", unavailableDriverMap);

    for (let key in shiftHistoryData) {
        let value = shiftHistoryData[key];


        let schedule_date = dayAndDates[key];

        // get drivers on leave for this date
        let leaveDriversSet =
            unavailableDriverMap[schedule_date] || new Set();

        // console.log(`Drivers unavailable on ${schedule_date}:`, leaveDriversSet);

        for (let key_ in value) {
            let value_ = value[key_];
            let schedule_rule_id = key_;

            let scheduleDetails =
                formattedData[String(schedule_rule_id)] || {};

            for (let driver_id in value_) {
                let value__ = value_[driver_id];

                if (leaveDriversSet.has(driver_id)) {
                    continue;
                }

                if (scheduleDetails.type === "mmd") {
                    shiftInsertion.push(
                        ...createMMDShift(
                            {
                                day: key,
                                date: schedule_date,
                                driverId: driver_id,
                            },
                            {
                                ...scheduleDetails,
                            },
                            company_type,
                            added_by,
                            timezone,
                            company_id,
                            "auto_scheduling"
                        )
                    );
                } else {
                    shiftInsertion.push(
                        ...createNormalShift(
                            {
                                day: key,
                                date: schedule_date,
                                driverId: driver_id,
                            },
                            {
                                ...scheduleDetails,
                            },
                            company_type,
                            added_by,
                            timezone,
                            company_id,
                            "auto_scheduling"
                        )
                    );
                }
            }
        }
    }

    return { shifts: shiftInsertion, driverPointer: xx };
};

const createShiftsforAutoSch = async ({
    data,
    dayAndDates,
    shiftHistoryData = {},
    preferredDriversData = {},
    ratingData = {},
    company_id,
    company_type,
    added_by,
    timezone,
    formattedData,
}) => {
    console.log(
        "Creating shifts for auto scheduling with data",
        data.shift_count
    );

    if (
        !data ||
        !dayAndDates ||
        !company_id ||
        !company_type ||
        !added_by ||
        !timezone ||
        !formattedData
    ) {
        throw new Error("Missing required parameters for auto scheduling");
    }

    // const txn = await db.transaction();

    try {
        let shiftInsertion = {};
        let preferredShiftInsertion = [];
        let ratingShiftInsertion = [];

        if (Object.keys(shiftHistoryData).length > 0) {
            shiftInsertion = await prepareShiftInsertionData({
                shiftHistoryData,
                dayAndDates,
                formattedData,
                company_id,
                company_type,
                added_by,
                timezone,
            });
        }

        if (Object.keys(preferredDriversData).length > 0) {
            preferredShiftInsertion = await preferredShiftInsertionData({
                preferredDriversData,
                dayAndDates,
                formattedData,
                company_id,
                company_type,
                added_by,
                timezone,
            });
        }

        if (Object.keys(ratingData).length > 0) {
            ratingShiftInsertion = await ratingShiftInsertionData({
                ratingData,
                dayAndDates,
                formattedData,
                company_id,
                company_type,
                added_by,
                timezone,
            });
        }

        let finalShiftData = [
            ...preferredShiftInsertion,
            ...shiftInsertion,
            ...ratingShiftInsertion,
        ];

        const driverIds = [
            ...new Set(finalShiftData.map((s) => s.assign_to)),
        ];

        const sdd = new SchedulerDriverDetails(company_type);
        const availabilityMap =
            await sdd.getAllDriversAvailability(driverIds);

        finalShiftData = finalShiftData.filter((shift) => {
            const day = moment(shift.schedule_date)
                .format("dddd")
                .toLowerCase();

            const availability = availabilityMap[shift.assign_to];
            return !availability || availability[day] === true;
        });

        const totalRequiredShifts = Object.values(data.shift_count).reduce(
            (sum, val) => sum + val,
            0
        );

        if (finalShiftData.length > totalRequiredShifts) {
            finalShiftData = trimShiftsDayWise(
                finalShiftData,
                data.shift_count
            );
        }

        if (!finalShiftData.length) {
            throw new Error("No eligible drivers were found");
        }

        await handleWHCRules(finalShiftData, data);

        // const insertedRes = await new Promise((resolve, reject) => {
        //     ind_schedule.insert_many_schedule_V2(
        //         finalShiftData,
        //         txn,
        //         (err, res) => {
        //             if (err) return reject(err);
        //             resolve(res);
        //         }
        //     );
        // });

        // const shiftIds = insertedRes.map((obj) => +obj.id);

        // await txn.commit();

        return {
            // shiftIds,
            // inserted: finalShiftData.length,
        };
    } catch (error) {
        // await txn.rollback();
        console.error("Auto schedule error:", error);
        throw error;
    }
};

const preferredShiftInsertionData = async ({
    preferredDriversData,
    dayAndDates,
    formattedData,
    company_id,
    company_type,
    added_by,
    timezone,
    xx = {}
}) => {
    let shiftInsertion = [];

    const unavailableDriverMap = await checkUnaviableDrivers(dayAndDates, company_id, company_type);
    // console.log("Unavailable driver IDs", unavailableDriverMap);

    for (let key in preferredDriversData) {
        let value = preferredDriversData[key];

        let schedule_date = dayAndDates[key];

        let leaveDriversSet = unavailableDriverMap[schedule_date] || new Set();

        for (let key_ in value) {
            let value_ = value[key_];
            let schedule_rule_id = key_;

            // Skip empty objects
            if (!value_ || Object.keys(value_).length === 0) {
                continue;
            }

            let scheduleDetails = formattedData[String(schedule_rule_id)] || {};

            for (let driver_id in value_) {
                let value__ = value_[driver_id];

                if (leaveDriversSet.has(driver_id)) {
                    continue;
                }
                if (!Object.keys(mm)) {
                    if (scheduleDetails.type === "mmd") {
                        shiftInsertion.push(
                            ...createMMDShift(
                                {
                                    day: key,
                                    date: schedule_date,
                                    driverId: driver_id,
                                },
                                {
                                    ...scheduleDetails,
                                },
                                company_type,
                                added_by,
                                timezone,
                                company_id,
                                "auto_scheduling",
                            ),
                        );
                    } else {
                        shiftInsertion.push(
                            ...createNormalShift(
                                {
                                    day: key,
                                    date: schedule_date,
                                    driverId: driver_id,
                                },
                                {
                                    ...scheduleDetails,
                                },
                                company_type,
                                added_by,
                                timezone,
                                company_id,
                                "auto_scheduling",
                            ),
                        );
                    }
                } else {

                }

            }
        }
    }

    return shiftInsertion;
};

const ratingShiftInsertionData = async ({
    ratingData,
    dayAndDates,
    formattedData,
    company_id,
    company_type,
    added_by,
    timezone,
}) => {
    let shiftInsertion = [];

    const unavailableDriverMap = await checkUnaviableDrivers(dayAndDates, company_id, company_type);
    console.log("Unavailable driver IDs", unavailableDriverMap);

    for (let key in ratingData) {
        let value = ratingData[key];

        let schedule_date = dayAndDates[key];

        let leaveDriversSet = unavailableDriverMap[schedule_date] || new Set();

        for (let key_ in value) {
            let value_ = value[key_];
            let schedule_rule_id = key_;

            let scheduleDetails = formattedData[String(schedule_rule_id)] || {};

            for (let driver_id in value_) {
                let value__ = value_[driver_id];

                if (leaveDriversSet.has(driver_id)) {
                    continue;
                }

                if (scheduleDetails.type === "mmd") {
                    shiftInsertion.push(
                        ...createMMDShift(
                            {
                                day: key,
                                date: schedule_date,
                                driverId: driver_id,
                            },
                            {
                                ...scheduleDetails,
                            },
                            company_type,
                            added_by,
                            timezone,
                            company_id,
                            "auto_scheduling",
                        ),
                    );
                } else {
                    shiftInsertion.push(
                        ...createNormalShift(
                            {
                                day: key,
                                date: schedule_date,
                                driverId: driver_id,
                            },
                            {
                                ...scheduleDetails,
                            },
                            company_type,
                            added_by,
                            timezone,
                            company_id,
                            "auto_scheduling",
                        ),
                    );
                }
            }
        }
    }

    return shiftInsertion;
};



module.exports = {
    signup,
    login,
    profile,
    dashboard_card,
    signout,
    refresh,
    isAdmin,
    updateProfile,
    perform_v3
}