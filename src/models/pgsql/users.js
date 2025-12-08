require("dotenv").config()
const db = require("./index")

const table = "dcms_users"
const table_students = "dcms_students"
const table_courses = "dcms_courses"
const table_departments = "dcms_departments"

const moment = require("moment")

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

const insertUser = async (data, keyInfo = {}) => {
    try {
        if (keyInfo.hasOwnProperty("ownTrx")) {
            console.log("data for insertion", data)
            const result = await keyInfo.trx(table)
                .insert(data)
                .returning(["id"])
            return result[0]
        } else {
            const result = await db(table)
                .insert({
                    first_name: data.first_name,
                    last_name: data.last_name,
                    email: data.email,
                    phone: data.phone,
                    password: data.password,
                    wallet_address: data.wallet_address,
                    ...(data.role && { role: data.role }),
                })
                .returning('*');

            if (result.length === 0) {
                throw new Error("Insert failed: No rows affected");
            }

            return result[0];
        }
    } catch (error) {
        throw error;
    }
};

const fetchSingleUser = async (data = {}) => {
    try {
        const isLogin = !!data?.login;
        const isStudentProfile = !!data?.profile && !!data?.student;
        const isProfile = !!data?.profile;

        let select_columns;

        if (isLogin) {
            select_columns = [
                `${table}.id`,
                `${table}.first_name`,
                `${table}.last_name`,
                `${table}.password as password_hash`,
                `${table}.role`,
                `${table}.email`,
            ];
        } else if (isStudentProfile) {
            select_columns = [
                `${table}.id`,
                db.raw(`CONCAT(${table}.first_name, ' ', ${table}.last_name) as name`),
                `${table_students}.student_id`,
                `${table}.email`,
                `${table_courses}.name as program`,
                `${table_departments}.name as department`,
                `${table}.created_at as enrollment_year`,
            ];
        } else if (isProfile) {
            select_columns = [
                `${table}.id`,
                `${table}.first_name`,
                `${table}.last_name`,
                `${table}.role`,
                `${table}.email`,
            ];
        } else {
            select_columns = [
                `${table}.id`,
                `${table}.first_name`,
                `${table}.last_name`,
            ];
        }

        let query = db(table);

        if (isStudentProfile) {
            query = query
                .leftJoin(
                    `${table_students}`,
                    `${table_students}.id`,
                    `${table}.student_id`
                )
                .leftJoin(
                    `${table_courses}`,
                    `${table_courses}.code`,
                    `${table_students}.course_name`
                )
                .leftJoin(
                    `${table_departments}`,
                    // departments.id (int) = students.department_id::int (varchar → int)
                    db.raw('??', [`${table_departments}.id`]),
                    db.raw('CAST(?? AS INTEGER)', [`${table_students}.department`])
                );
        }

        query = query.select(select_columns);

        if (data.phone && data.email) {
            query = query.where(function () {
                this.where({ [`${table}.phone`]: data.phone })
                    .orWhere({ [`${table}.email`]: data.email });
            });
        } else if (data.profile && data.id && data.email) {
            query = query.where(function () {
                this.where({ [`${table}.id`]: data.id })
                    .andWhere({ [`${table}.email`]: data.email });
            });
        } else if (data.phone) {
            query = query.where({ [`${table}.phone`]: data.phone });
        } else if (data.email) {
            query = query.where({ [`${table}.email`]: data.email });
        } else if (data.user_id) {
            query = query.where({ [`${table}.id`]: data.user_id });
        } else {
            throw new Error("Either phone, email, or id is required");
        }

        const result = await query.first();
        return result;
    } catch (error) {
        throw error;
    }
};

const update_user = async (update_data, where_data) => {
    try {
        if (where_data.role === "admin") {

        } else {
            const query = await db(table)
                .update(update_data)
                .where({
                    id: where_data.id
                })
                .returning(["student_id"])

            const student_id = query[0].student_id

            if (update_data.hasOwnProperty("phone")) delete update_data
            ["phone"]


            await db(table_students)
                .update(update_data)
                .where({
                    "id": student_id
                })

            return "update successfull"
        }
    } catch (error) {
        throw error
    }
}



module.exports = {
    fetchUserDetails,
    insertUser,
    fetchSingleUser,
    update_user
}