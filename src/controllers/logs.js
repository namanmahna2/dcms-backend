const mute = require("immutable")
const async = require("async")
const validator = require("validator")
const moment = require("moment")

const bl_tx_model = require("../models/pgsql/blockchain_txn")
const security_alerts = require("../models/pgsql/security_alerts")
const students_model = require("../models/pgsql/students")
const blocked_ips_model = require("../models/pgsql/blocked_ips")

const responseStruct = new mute.Map({
    signature: "",
    status: null,
    message: "",
    data: null,
    success: false
})

const anomalyCategories = {
    replay_attack: "Suspicious",
    rapid_minting: "Suspicious",
    suspicious_wallet_pattern: "Suspicious",

    wallet_impersonation: "Anomaly",
    metadata_tampering: "Anomaly",
    ipfs_abuse: "Anomaly",
    unusual_gas_usage: "Anomaly",
};


const get_logs = async (data, response, cb) => {
    if (!cb) cb = response

    try {
        let fetch_data = {}
        if (data.hasOwnProperty("id")) {
            fetch_data["id"] = data.id
        }

        const db_result = await security_alerts.fetch_alerts(fetch_data)

        const columns = Array.isArray(db_result) && db_result.length > 0
            ? Object.keys(db_result[0])
                .filter(ele => ele != "id")
                .map(key => {
                    let spiltKey = key.split("_")
                    if (spiltKey.length > 1) {
                        spiltKey = spiltKey.map(_key => _key.charAt(0).toUpperCase() + _key.slice(1))
                        let joinKey = spiltKey.join(" ")
                        return joinKey
                    } else {
                        return key.charAt(0).toUpperCase() + key.slice(1)
                    }
                })
            : [
                'Created At',
                'Type',
                'IP',
                'Issuer Id',
                'Student Id',
                'Wallet Address',
                'Anomaly Score',
                'Details',
                'Handled'
            ]

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 200,
                message: "ok",
                data: db_result,
                columns
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

const risk_dashboard = async (data, response, cb) => {
    if (!cb) cb = response
    try {
        const db_result = await security_alerts.risk_type()

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

const audit_logs_students = async (data, response, cb) => {
    if (!cb) cb = response

    try {
        console.log("incoming controllr data", data)
        let fetch_data = {
            student_id: data.id,
        }

        let stu_details = await students_model.get_by_id({ id: fetch_data.student_id })
        stu_details = stu_details.rows

        if (Array.isArray(stu_details) && stu_details.length > 0) {
            stu_details = stu_details[0]

            fetch_data["degree_token_id"] = stu_details.degree_token_id

            const student_logs = await bl_tx_model.fetch_logs_for_student_view(fetch_data)

            console.log("sudent specific logs", student_logs)

            return cb(null,
                responseStruct.merge({
                    signature: "sign11",
                    status: 200,
                    message: "ok",
                    data: student_logs
                }).toJS()
            );


        } else {
            return cb(
                responseStruct.merge({
                    signature: "sign11",
                    status: 400,
                    message: "student details not found",
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
}

const insert_view_log = async (data, response, cb) => {
    if (!cb) cb = response

    try {
        await bl_tx_model.insert(data)

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 200,
                message: "view log saved successfully!!!",
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

const block_ip = async (data, response, cb) => {
    if (typeof cb !== "function") cb = response;

    try {
        let security_data = await security_alerts.find_by_id({ id: data.security_alert_id });
        console.log("security alerts", security_data);

        if (!Array.isArray(security_data) || security_data.length === 0) {
            return cb(
                responseStruct.merge({
                    signature: "sign11",
                    status: 400,
                    message: "no security alerts found",
                }).toJS()
            );
        }

        security_data = security_data[0];
        const ip_to_block = security_data.client_ip;

        let similar_ip_data = await security_alerts.find_by_ip({ client_ip: ip_to_block });

        let ids_set = new Set();
        ids_set.add(security_data.id);

        if (Array.isArray(similar_ip_data) && similar_ip_data.length > 0) {
            similar_ip_data.forEach(obj => ids_set.add(Number(obj.id)));
        }

        const final_security_alert_ids = [...ids_set];

        const ip_already_blocked = await blocked_ips_model.find_by_ip({ ip_address: ip_to_block });


        if (Array.isArray(ip_already_blocked) && ip_already_blocked.length > 0) {
            let merged_ids = new Set();

            ip_already_blocked[0].alert_ids.forEach(id => merged_ids.add(Number(id)));

            final_security_alert_ids.forEach(id => merged_ids.add(Number(id)));

            const updated_alert_ids = [...merged_ids];
            console.log("merged updated IDs:", updated_alert_ids);

            await blocked_ips_model.update({
                alert_ids: updated_alert_ids,
                ip_address: ip_to_block,
            });

            return cb(
                responseStruct.merge({
                    signature: "sign11",
                    status: 200,
                    message: "block_ids row updated",
                }).toJS()
            );
        }

        await blocked_ips_model.insert({
            alert_ids: final_security_alert_ids,
            ip_address: ip_to_block,
            reason: security_data.type,
        });

        await security_alerts.update({
            ids: final_security_alert_ids,
            ip: ip_to_block,
        });

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 200,
                message: "ip is blocked successfully",
            }).toJS()
        );

    } catch (error) {
        console.error("Block IP Error:", error);
        return cb(
            responseStruct.merge({
                signature: "sign11",
                status: 500,
                message: "Something went wrong!",
            }).toJS()
        );
    }
};

const student_alerts = async (data, response, cb) => {
    if (typeof cb !== "function") cb = response
    try {
        const db_result = await bl_tx_model.fetch_log_related_to_student({ user_id: data.req.user_id })

        let final_data = []
        for (let obj of db_result.rows) {
            let temp = {}
            if (obj.function === "safeMint") {
                temp.message = "Your official transcript is available for download"
            }
            temp = {
                ...temp,
                ...obj
            }

            delete temp.function

            final_data.push(temp)
        }

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 200,
                message: "ok",
                data:final_data
            }).toJS()
        );
    } catch (error) {
        console.error("Block IP Error:", error);
        return cb(
            responseStruct.merge({
                signature: "sign11",
                status: 500,
                message: "Something went wrong!",
            }).toJS()
        );
    }
}

module.exports = {
    get_logs,
    risk_dashboard,
    audit_logs_students,
    insert_view_log,
    block_ip,
    student_alerts
}