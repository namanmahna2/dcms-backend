require("dotenv").config()
const db = require("./index")

const table = "dcms_sessions"

const moment = require("moment")

const insert = async (data) => {
    try {
        const insert_query = await db(table).insert(data).returning("id")

        if (insert_query.length === 0) {
            throw new Error("Insert failed: No rows affected");
        }

        return insert_query[0]
    } catch (error) {
        throw error
    }
}

const signout = async (data) => {
    try {
        const query = db(table).update({
            "logout_time": new Date()
        }).where({
            "session_token": data.refresh_token,
            "logout_time": null
        })

        return query
    } catch (error) {
        throw error
    }
}

const findByRefreshToken = async (data) => {
    try {
        console.log("modle inocming data for session check", data)
        const query = await db.select([
            "id"
        ]).from(table).where("session_token", data.refresh_token).andWhere("logout_time", null)

        return query
    } catch (error) {
        throw error
    }
}

const findSessionByID = async (data) => {
    try {
        const query =  db.select(["id"]).from(table).where({
            "id": data.id,
            "logout_time": null
        })

        return query
    } catch (error) {
        throw error
    }
}

module.exports = {
    insert,
    signout,
    findByRefreshToken,
    findSessionByID
}