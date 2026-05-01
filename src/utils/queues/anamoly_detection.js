const Bull = require('bull');
const mqtt = require("../../utils/queues/mqtt/index")

const blockchain_txn_model = require("../../models/pgsql/blockchain_txn")

const ano_detection_queue = new Bull(`logs_${process.env.DB_ENV}`, {
    redis: {
        // host: "redis-19514.c11.us-east-1-2.ec2.cloud.redislabs.com",
        // port: 19514,
        // username: "naman",
        // password: "Naman@1234",
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        username: process.env.REDIS_USER,
        password: process.env.REDIS_PASS,
    },
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true
    },
    settings: {
        lockDuration: 30000,
        stalledInterval: 30000,
        maxStalledCount: 1,
        guardInterval: 5000,
        retryProcessDelay: 5000
    }
});

// const ano_detection_queue = new Bull(`logs_${process.env.DB_ENV}`, {
//   redis: {
//     sentinels: [
//       {
//         host: process.env.REDIS_SENTINEL_HOST,
//         port: process.env.REDIS_SENTINEL_PORT,
//       }
//     ],
//     name: process.env.REDIS_MASTER_NAME,
//     password: process.env.REDIS_PASS,
//     db: Number(process.env.REDIS_DB_NAME)
//   },
//   defaultJobOptions: {
//     removeOnComplete: true,
//     removeOnFail: true
//   },
//   settings: {
//     lockDuration: 30000,
//     stalledInterval: 30000,
//     maxStalledCount: 1,
//     guardInterval: 5000,
//     retryProcessDelay: 5000
//   }
// });


ano_detection_queue.process(async (job, done) => {
    try {
        try {
            console.log("incoming data redis", job.data)

            let insertResult = await blockchain_txn_model.insert(JSON.parse(job.data.info))

            await mqtt.publish("anomaly", JSON.stringify({
                ...JSON.parse(job.data.info),
                ml_transaction_id: insertResult[0].id
            }))
            console.log("mqtt data publich topic: anomaly")
            done(null, true)
        } catch (error) {
            console.error(`Error in log_alerts queue ${error}`)
            done(error)
        }
    } catch (error) {
        console.error("Error while job log_alerts: ", error)
        done(error)
    }
})

ano_detection_queue.on("failed", (job, result) => {
    console.log(`Job Failed with result:  ${result}`)
})

ano_detection_queue.on("stalled", (job, result) => {
    console.log(`Job Stalled with result:  ${result}`)
})

ano_detection_queue.on("completed", (job, result) => {
    console.log(`Job completed with result:  ${result}`)

})



module.exports = { ano_detection_queue }