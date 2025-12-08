const db = require("./index")

const table = "dcms_departments"
const table_2 = "dcms_courses"


const get_c_and_d_all = async (data) => {
    try {
        let query = db.raw(`
                SELECT 
                    dd.id,
                    dd.name,
                    COALESCE(
                        JSON_AGG(
                            JSON_BUILD_OBJECT(
                                'course_name', dc.name,
                                'course_code', dc.code
                            )
                        ) FILTER( WHERE dc.id IS NOT NULL),
                    '[]') as courses
                FROM ${table} as dd
                LEFT JOIN ${table_2} as dc ON
                    dd.id = dc.department_id
                GROUP BY dd.id, dd.name
                ORDER BY dd.id asc
            `)

        return await query;
    } catch (error) {
        throw error
    }
}


module.exports = {
    get_c_and_d_all
}