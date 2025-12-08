require("dotenv").config()
const db = require("./index")

const table = "dcms_students"
const table_2 = "dcms_users"
const table_3 = "dcms_wallets"
const table_4 = "dcms_courses"
const table_5 = "dcms_departments"


const moment = require("moment")

const insert = async (data) => {
    try {
        const result = await db(table)
            .insert({
                student_id: data.student_id,
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email,
                course_name: data.course_name,
                department: data.department,
                university_name: "Coventry University",
                wallet_address: data.walletAddress,
            }).returning("id")

        if (result.length === 0) throw new Error("Insert failed: No rows affected")

        return result[0]
    } catch (error) {
        throw error;
    }
}

const get_all = async (data) => {
    try {
        console.log("incoming data", data);

        let query = db.select([
            `${table}.id`,
            db.raw(`CONCAT(${table}.first_name, ' ', ${table}.last_name) as name`),
            `${table}.email`,
            `${table}.wallet_address`,
            `${table}.is_revoked`,
            `${table}.revocation_reason`,
            `${table}.tx_hash`,
        ]).from(table).orderBy("created_at", "desc");

        if (data.tx_hash === "null") {
            query = query.whereNull(`${table}.tx_hash`);
        }

        let results = await query;

        results = results.map(item => ({ ...item, role: "Student" }));

        return results;

    } catch (error) {
        throw error;
    }
}


const get_by_id = async (data) => {
    try {
        let query = db.raw(`
            SELECT 
            ds.id,
            ds.first_name,
            ds.last_name,
            ds.wallet_address,
            ds.degree_token_id,
            ds.tx_hash,
            ds.university_name as uni,
            ds.email,
            dd.id as department_id,
            dd.name as department_name,
            du.phone as phone,
            ds.course_name as course_code,
            dw.custody as wallet_type,
            dc.name as course_name,
            (select concat(du.first_name, ' ', du.last_name) as owner_name from dcms_users as du where du.role = 'admin')
            from dcms_students as ds

            left join dcms_departments as dd on dd.id = ds.department :: int
            left join dcms_users as du on du.student_id = ds.id
            left join dcms_courses as dc on ds.course_name = dc.code
            left join dcms_wallets as dw on dw.user_id = du.id

            where ds.id = ${data.id}`)


        return await query
    } catch (error) {
        throw error
    }
}

const viewCertificate = async (data) => {
    try {
        const query = db.raw(`
                    select 
                        ds.id,
                        ds.issued_at,
                        CONCAT(ds.first_name, ' ', ds.last_name) as student,
                        ds.tx_hash,
                        ds.degree_token_id,
                        dc.name as degree,
                        ds.is_revoked
                    from dcms_students as ds
                    left join dcms_courses as dc on dc.code = ds.course_name     
                    order by ds.created_at desc             
                `)
        return await query
    } catch (error) {
        throw error
    }
}

// Update student by user_id
const update_by_id = async (update_data, where_data) => {
    try {
        console.log("where_data:", where_data);
        console.log("update_data:", update_data);

        const queryTransaction = await db.transaction(async (trx) => {
            const [userRow] = await trx(table_2)
                .select("id")
                .where("student_id", +where_data.id)
                .limit(1);

            const user_id = userRow?.id;

            let updates = {
                student: 0,
                user: 0,
                wallet: 0,
            };

            if (update_data.student && Object.keys(update_data.student).length > 0) {
                updates.student = await trx(table)
                    .where(where_data)
                    .update(update_data.student);
                console.log("student query result", updates.student);
            }

            if (update_data.hasOwnProperty("phone") && user_id) {
                updates.user = await trx(table_2)
                    .where("student_id", where_data.id)
                    .update({ phone: update_data.phone });
                console.log("users query result", updates.user);
            }

            if (update_data.hasOwnProperty("custody") && user_id) {
                updates.wallet = await trx(table_3)
                    .where("user_id", user_id)
                    .update({ custody: update_data.custody });
                console.log("wallet query result", updates.wallet);
            }

            return {
                success: true,
                affected: updates,
                user_id,
            };
        });

        return queryTransaction;
    } catch (error) {
        throw error;
    }
};


const update_by_stuID = async (update_data, where_data) => {
    try {
        console.log("where data", where_data, "update", update_data)
        const query = await db(table).where(where_data).update(update_data.student)

        return query.rows
    } catch (error) {
        throw error;
    }
}

const delete_by_id = async (data) => {
    try {
        const query = await db(table).where(data).del()
        return query
    } catch (error) {
        throw error;
    }
}

const is_degree_issued = async (data) => {
    try {
        const query = await db.select([
            `${table}.tx_hash`,
        ]).from(table).where({
            id: data.id
        })

        return query
    } catch (error) {
        throw error;
    }
}

const total_degree_by_month = async (data) => {
    try {
        const query = await db.raw(`
                    SELECT
                        to_char("issued_at", 'MON') as month,
                        count (*) as degrees
                    FROM ${table}
                    WHERE issued_at is not null
                    GROUP BY to_char("issued_at", 'MON')
                    ORDER by MIN(issued_at)
                `)

        return query
    } catch (error) {
        throw error
    }
}

const dashboard_cards = async (data) => {
    try {
        const query = db.raw(`
                WITH stats AS (
                    SELECT
                        COUNT(*) AS total_students,
                        COUNT(tx_hash) AS total_degrees
                    FROM dcms_students
                ), state_1 AS (
                    select count(*) as activeSessions from dcms_sessions where logout_time is null
                ), state_2 as (
                    select count(*) as anomalies from security_alerts
                )
                SELECT
                    total_students AS students,
                    total_degrees AS degrees,
                    state_1.activeSessions,
                    state_2.anomalies
                FROM stats, state_1, state_2
            `)

        return query
    } catch (error) {
        throw error
    }
}

const is_revoked = async (data) => {
    const { id } = data
    if (!id) throw "student id is required"

    try {
        let query = db.select([
            `${table}.is_revoked`
        ])
            .from(table)
            .where("id", data.id)

        return query
    } catch (error) {
        throw error
    }
}

const revoked_students = async (data) => {
    try {
        const query = db.select([
            `${table}.id`,
            db.raw(`CONCAT(${table}.first_name, ' ', ${table}.last_name) as name`),
            `${table}.wallet_address as wallet`,
            `${table}.issued_at as timestamp`,
            `${table}.revocation_reason as revoke_reason`,
        ]).from(table).where({
            is_revoked: true
        })

        return query
    } catch (error) {
        throw error
    }
}

const find_degree_info = async (data) => {
    try {
        let query = db.select([
            `${table_2}.id as user_id`,
            `${table}.id as student_id`,
            db.raw(`CONCAT(${table}.first_name ,' ', ${table}.last_name) as student`),
            `${table}.email`,
            db.raw(`CONCAT(${table_4}.name, ' in ', ${table_5}.name) as degree`),
            `${table}.issued_at`,
            `${table}.is_revoked`,
            `${table}.revocation_reason`,
            `${table}.degree_token_id`,
            `${table}.tx_hash`
        ]).from(table_2)

        query = query.leftJoin(`${table}`, `${table}.id`, `${table_2}.student_id`)
        query = query.leftJoin(`${table_4}`, `${table_4}.code`, `${table}.course_name`)
        query = query.leftJoin(`${table_5}`, `${table_5}.id`, db.raw(`CAST( ?? as INTEGER)`, [`${table}.department`]))
        query = query.where(`${table_2}.id`, data.user_id)

        return await query
    } catch (error) {
        throw error
    }
}


module.exports = {
    insert,
    get_all,
    get_by_id,
    update_by_id,
    delete_by_id,
    update_by_stuID,
    is_degree_issued,
    viewCertificate,
    total_degree_by_month,
    dashboard_cards,
    is_revoked,
    revoked_students,
    find_degree_info
}