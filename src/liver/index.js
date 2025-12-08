const app = require("../app")

const http = require("http")
const { initSocket } = require("../services/sockets")

const PORT = process.env.PORT || 3011;

app.set("port", PORT)

const server = http.createServer(app)
initSocket(server)

server.listen(PORT)
server.on("error", onError)
server.on("listening", onListening)
console.log(`DCMS REST server started at port: ${PORT}`)


function onError(error) {
    if (error.sysCall !== "listen") {
        throw error
    }
}

function onListening(){
    let address=  server.address()
    let bind = typeof address === "string" ? "pipe " + address : "port " + address.port;
}