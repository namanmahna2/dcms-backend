const mqtt = require("mqtt");
const { getIO } = require("../../../services/sockets")

const client = mqtt.connect("mqtt://localhost:1883");
const security_alerts_model = require("../../../models/pgsql/security_alerts");

client.on("connect", () => {
    console.log("⚡ MQTT connected (Node.js)");

    client.subscribe("anomaly_result", (err) => {
        if (err) {
            console.error("Subscription error:", err);
        } else {
            console.log("Listening on topic: anomaly_result");
        }
    });
});

client.on("message", async (topic, message) => {
    if (topic !== "anomaly_result") return;

    try {
        console.log("Received ML result from Python");

        const result = JSON.parse(message.toString());
        console.log("➡ Parsed result:", result);

        if (result.is_anomaly) {
            const dbResponse = await security_alerts_model.insert(result);

            const io = getIO()

            console.log("Emitting new anomaly:", dbResponse)
            io.emit("new anomaly", dbResponse)
        }

    } catch (error) {
        console.error("Error handling anomaly_result:", error);
    }
});

module.exports = client;
