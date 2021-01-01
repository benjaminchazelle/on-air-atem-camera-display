const express = require("express");
const app = express();
const http = require("http").createServer(app);
const Atem = require('atem');
const io = require("socket.io")(http, {
    cors: {
        origin: "*"
    }
});

const atemAddress = "192.162.1.140";
const serverPort = 8080;

const atemDevice = new Atem(atemAddress)

app.use(express.static("public"));

let sockets = [];

function broadcast(eventName, eventPayload = undefined, ack = () => {
}) {

    for (let socket of sockets) {
        socket.emit(eventName, eventPayload, ack);
    }

}

const events = [
    // 'previewBus',
    'programBus',
    // 'inputTally',
    // 'sourceTally',
    // 'sourceConfiguration',
    // 'auxiliaryOutput',
    // 'connectionStateChange',
    // 'connectionLost'
];

for (let event of events) {
    atemDevice.on(event, function (payload) {
        broadcast(event, payload);
    });
}


io.on("connection", socket => {
    sockets.push(socket);
});

http.listen(serverPort, () => {
    console.log(`Server port : ${serverPort}`);
    console.log(`ATEM IP : ${atemAddress}`);
});

