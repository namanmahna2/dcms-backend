const Redis = require("ioredis");

const redisClient = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASS
});

module.exports = redisClient;
