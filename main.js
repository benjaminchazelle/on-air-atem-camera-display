const express = require("express");
const app = express();
const http = require("http").createServer(app);
const ATEM = require('applest-atem');
const io = require("socket.io")(http, {
    cors: {
        origin: "*"
    }
});

const EventEmitter = require('events');


const atemAddress = "192.168.1.240";
const serverPort = 7000;

let atem = new ATEM();
atem.connect(atemAddress);

app.use(express.static("public"));

let sockets = [];

function broadcast(eventName, eventPayload = undefined, ack = () => {
}) {

    for (let socket of sockets) {
        socket.emit(eventName, eventPayload, ack);
    }
}

let programBus, lightBus, previewBus;

atem.on('stateChanged', function(err, state) {

    programBus = state.tallys.findIndex(tally => [1,3].includes(tally)) + 1
    previewBus = state.tallys.findIndex(tally => [2,3].includes(tally)) + 1

    broadcast("programChanged", programBus);
    broadcast("previewChanged", previewBus);

    if(!lightBus) {
        lightBus = programBus;
        broadcast("lightChanged", lightBus);
    }
});


let cameraStatuses = {
    1: "OK",
    2: "OK",
    3: "OK",
}

function changePreview(previewBus) {
    atem.changePreviewInput(previewBus);
}

function changeProgram(programBus) {
    atem.changeProgramInput(programBus);
}

function changeLight(_lightBus) {
    lightBus = _lightBus
    broadcast("lightChanged", lightBus);
}

let cutTimeout = null;

io.on("connection", socket => {
    sockets.push(socket);

    socket.on("changePreview", (previewBus) => {
        changePreview(previewBus)
    });

    socket.on("changeLight", (lightBus) => {
        changeLight(lightBus)
    });

    socket.on("cut", () => {
        const nextProgramBus = previewBus;
        const nextPreviewBus = programBus;
        changeLight(previewBus)
        clearTimeout(cutTimeout)
        cutTimeout = setTimeout(() => {
            changeProgram(nextProgramBus)
            changePreview(nextPreviewBus)
        }, 0);
    });

    socket.on("delayedCut", () => {
        const oldPreviewBus = previewBus;
        changeLight(previewBus)
        clearTimeout(cutTimeout)
        cutTimeout = setTimeout(() => {
            const nextPreviewBus = previewBus === oldPreviewBus ? programBus : previewBus;
            changeProgram(oldPreviewBus)
            changePreview(nextPreviewBus)
        }, 1500);
    });

    socket.on("blindCut", () => {
        const nextProgramBus = previewBus;
        const nextPreviewBus = programBus;
        clearTimeout(cutTimeout)
        cutTimeout = setTimeout(() => {
            changeProgram(nextProgramBus)
            changePreview(nextPreviewBus)
        }, 0);
    });

    socket.on("updateCameraStatus", ({camera, status}) => {
        if(camera in cameraStatuses) {

            let oldStatus = cameraStatuses[camera];

            let statusIsUpdatable = [
                status === "ISSUE" && oldStatus === "OK",
                status === "WIP" && ["ISSUE", "OK"].includes(oldStatus),
                status === "OK",
                status === "PING" && ["WIP", "PING"].includes(oldStatus)
            ].some(condition => condition)

            if(statusIsUpdatable) {
                cameraStatuses[camera] = status
                broadcast("cameraStatusChanged", {camera, status});
            }

        }
    });

    socket.emit("programChanged", programBus);
    socket.emit("lightChanged", lightBus);
    socket.emit("previewChanged", previewBus);
    for(let camera of Object.keys(cameraStatuses)) {
        socket.emit("cameraStatusChanged", {camera, status: cameraStatuses[camera] });
    }

});

http.listen(serverPort, () => {
    console.log(`Server port : ${serverPort}`);
    console.log(`ATEM IP : ${atemAddress}`);
});

