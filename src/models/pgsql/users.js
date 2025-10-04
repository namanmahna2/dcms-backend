const db = require("./index")

const table = "users"

const moment = require("moment")
require("dotenv").config()



const fetchUserDetails = async (data) => {
    try {
        const query = db.select([
            `${table}.first_name`,
            `${table}.last_name`,
            `${table}.email`,
            `${table}.phone`,

        ]).from(table).where({
            email: data.email
        })

        return await query;
    } catch (error) {
        return error
    }
}

const insertUser = async (data) => {
    try {
        const query = db(table).insert([{
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            phone: data.phone,
            password: data.password,
            wallet_address: data.wallet_address
        }])

        return await query
    } catch (error) {
        return error
    }
}

module.exports = {
    fetchUserDetails,
    insertUser
}