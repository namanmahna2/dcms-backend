const db = require("./index")

const table = "security_alerts"
const table_bi = "blocked_ips"

const anomaly_types = [
    'mint_anomaly',
    'verify_anomaly',
    'replay_attack',
    'wallet_impersonation',
    'unusual_gas_usage',
    'rapid_minting',
    'metadata_tampering',
    'ipfs_abuse',
    'suspicious_wallet_pattern',
    'contract_call_anomaly'
]

const anomaly_map = {
    "Gas Price anomaly": "unusual_gas_usage",
    "gas_price_anomaly": "unusual_gas_usage",
    "unusual_gas_usage": "unusual_gas_usage",

    // fallbacks for future ML anomalies:
    "Mint anomaly": "mint_anomaly",
    "Metadata anomaly": "metadata_tampering",
    "replay_attack": "replay_attack"
}

const insert = async (data) => {
    try {
        const resolved_type = data.type || "contract_call_anomaly"

        if (!data.ip) throw ("ip is required")

        let query = db(table).insert({
            type: resolved_type,
            wallet_address: data?.tx?.wallet ?? data.details.wallet,
            tx_hash: data?.tx?.tx_hash ?? data.details.tx_hash,
            anomaly_score: data.score,
            details: JSON.stringify(data.tx) || null,
            handled: data.handled ?? false,
            client_ip: data.ip,
            ...(data.issuer_id && { issuer_id: data.issuer_id }),
            ...(data.student_id && { student_id: data.student_id }),
        }).returning(["id"])
        return await query
    } catch (error) {
        throw error
    }
}

const fetch_alerts = async (data) => {
    try {
        let query = db.select([
            `${table}.id`,
            `${table}.created_at`,
            `${table}.wallet_address`,
            `${table}.client_ip`,
            `${table}.issuer_id`,
            `${table}.student_id`,
            `${table}.tx_hash`,
            `${table}.handled`,
            `${table}.type`,
            db.raw(`CASE 
                        WHEN ${table_bi}.id is not null and ${table_bi}.active = true
                        THEN TRUE
                        ELSE FALSE
                    END AS is_ip_blocked
                `)
        ])
            .from(table)
            .leftJoin(`${table_bi}`, `${table_bi}.ip_address`, `${table}.client_ip`)
            .orderBy("created_at", "desc")
            .limit(data.limit)

        if (data.hasOwnProperty("id"))
            query = query.where(`${table}id`, data.id)

        console.log("final query", query.toString())
        return query
    } catch (error) {
        throw error
    }
}

const risk_type = async (data) => {
    try {
        const query = await db.raw(`
            SELECT
                COUNT(*) AS value,
                CASE
                    WHEN type IN ('replay_attack', 'rapid_minting', 'suspicious_wallet_pattern')
                    THEN 'Suspicious'
                    WHEN type IN ('wallet_impersonation', 'metadata_tampering', 'ipfs_abuse', 'unusual_gas_usage')
                    THEN 'Anomaly'
                    ELSE 'Normal'
                END AS name
            FROM security_alerts
            GROUP BY name;
        `)
        return query
    } catch (error) {
        throw error
    }
}

const find_by_id = async (data) => {
    try {
        const query = await db.select("*").from(table).where("id", +data.id)

        return query
    } catch (error) {
        throw error
    }
}

const find_by_ip = async (data) => {
    try {
        const query = await db.select(["id"]).from(table).where("client_ip", data.client_ip).andWhere("handled", false)

        return query
    } catch (error) {
        throw error
    }
}

const update = async (data) => {
    try {
        const query = db(table).update({
            handled: true
        }).whereIn("id", data.ids).andWhere("client_ip", data.ip)

        return query
    } catch (error) {
        throw error
    }
}



module.exports = {
    insert,
    fetch_alerts,
    risk_type,
    find_by_id,
    find_by_ip,
    update
}