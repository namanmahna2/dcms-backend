const db = require("./index")

const table = "ml_transactions"

const insert = async (data) => {
    try {
        const query = await db(table).insert({
            degree_token_id: data.degree_token_id || 0,
            wallet: data.wallet,
            tx_hash: data.tx_hash,
            timestamp: data.timestamp,
            gas_price: data.gas_price,
            gas_used: data.gas_used,
            block_number: data.block_number || 1000,
            block_time_diff: data.block_time_diff || 0,
            nonce: data.nonce || 100,
            function: data.function || "",
            metadata_cid: data.metadata_cid || 1000,
            is_anomaly: data.anomaly,
            ...(data.ml_score && { ml_score: data.ml_score })
        }).returning(["id"])

        return query
    } catch (error) {
        throw error
    }
}

const fetch_logs = async (data) => {
    try {
        let query = db
            .select("*")
            .from(table)

        if (data.hasOwnProperty("id") && !data.hasOwnProperty("wallet")) {
            query = query.where("id", data.id)
        }
        else if (data.hasOwnProperty("wallet")) {
            query = query.where({
                wallet: data.wallet,
                tx_hash: data.tx_hash,
            })
        }

        return await query

    } catch (error) {
        throw error
    }
}

const fetch_logs_for_student_view = async (data) => {
    try {
        console.log("incoming data", data)
        let query = db.select([
            `${table}.id`,
            db.raw(`
                    CASE
                        WHEN ${table}.function = 'safeMint' THEN 'cert_issue'
                        WHEN ${table}.function = 'tokenUri' THEN 'cert_view'
                        ELSE ${table}.function
                    END AS function
                `),
            `${table}.wallet`,
            `${table}.metadata_cid`,
            `${table}.timestamp`
        ]).from(table)

        query = query.where({
            degree_token_id: data.degree_token_id
        })

        query = query.orderBy("created_at", "desc")

        return await query
    } catch (error) {
        throw error
    }
}

const fetch_log_related_to_student = async (data) => {
    try {
        const query = db.raw(`
        SELECT 
            mlt.id,
            CASE
               WHEN mlt.function IN ('safeMint', 'LOAD_TOKEN_URI') THEN 'info'
            ELSE 'security'
           END AS type,
    mlt.function,
    mlt.created_at
FROM dcms_users AS u
LEFT JOIN dcms_students AS s 
    ON s.id = u.student_id
LEFT JOIN ml_transactions AS mlt 
    ON mlt.wallet = s.wallet_address
WHERE u.id = ${data.user_id}
  AND mlt.function = 'safeMint'
ORDER BY mlt.timestamp DESC
LIMIT 1;


        `)

        return await query
    } catch (error) {
        throw error
    }
}

module.exports = {
    insert,
    fetch_logs,
    fetch_logs_for_student_view,
    fetch_log_related_to_student
}