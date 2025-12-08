const { Server } = require("socket.io");

let io = null;

function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: ["http://localhost:3000", "http://localhost:5173"],
            methods: ["GET", "POST"],
        }
    });

    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        socket.on("new anomaly", (data) => {
            console.log("Message received:", data);
            io.emit("receive_message", data);
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });

    return io;
}

function getIO() {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
}

module.exports = {
    initSocket,
    getIO
};
