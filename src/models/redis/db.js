const Redis = require("ioredis");


const redisClient = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASS,
    username: process.env.REDIS_USER
});


// const redisClient = new Redis({
//   sentinels: [
//     {
//       host: process.env.REDIS_SENTINEL_HOST || "redis-sentinel",
//       port: Number(process.env.REDIS_SENTINEL_PORT) || 26379,
//     },
//     // (optional) add more sentinels for HA
//     // { host: "redis-sentinel-2", port: 26379 },
//     // { host: "redis-sentinel-3", port: 26379 },
//   ],

//   name: process.env.REDIS_MASTER_NAME,
//   password: process.env.REDIS_PASS,
// //   sentinelPassword: process.env.REDIS_SENTINEL_PASS,
//   db: Number(process.env.REDIS_DB_NAME),

//   retryStrategy: (times) => {
//     console.log(`Retrying Redis (sentinel)... attempt ${times}`);
//     return Math.min(times * 100, 3000);
//   },

//   reconnectOnError: (err) => {
//     console.error("Redis reconnect error:", err);
//     return true;
//   },
// });

module.exports = redisClient;