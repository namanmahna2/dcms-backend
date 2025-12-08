const db = require("./index")

const table = "blocked_ips"

const insert = async (data) => {
    try {
        console.log("incoming data for insertion in blocked_ips", data)
        let insert_obj = {
            ip_address: data.ip_address,
            reason: data.reason,
            ...(data.expires_at && { expires_at: data.expires_at })
        }

        // const alert_ids = Array.isArray(data.alert_id) && data.alert_id.length > 0
        //     ? data.alert_id.map(ele => Number(ele))
        //     : [data.alert_id]

        insert_obj["alert_ids"] = data.alert_ids

        const query = db(table).insert(insert_obj).returning(["id"])

        return query
    } catch (error) {
        throw error
    }
}

const update = async (data) => {
    try {
        console.log("data for update", data)
        const query = await db(table).update({
            "alert_ids": data.alert_ids
        }).where("ip_address", data.ip_address).andWhere("active", "!=", true)

        return query
    } catch (error) {
        throw error
    }
}

const find_by_ip = async (data) => {
    try {
        const query = db.select([
            "id",
            "alert_ids"
        ]).from(table).where("ip_address", data.ip_address)

        return query
    } catch (error) {
        throw error
    }
}

const get_all_ips = async (data) => {
    try {
        const query = db.select([
            `${table}.id`,
            `${table}.ip_address as ip`
        ]).from(table)

        return query
    } catch (error) {
        throw error
    }
}

const blocked_ips = async (data) => {
    try {
        const query = db.select([
            `${table}.id`,
            `${table}.alert_ids`,
            `${table}.ip_address`,
        ])
            .from(table)
            .where("ip_address", data.ip)
            .where("active", true)

        return await query
    } catch (error) {
        throw error
    }
}


module.exports = {
    insert,
    find_by_ip,
    get_all_ips,
    update,
    blocked_ips
}