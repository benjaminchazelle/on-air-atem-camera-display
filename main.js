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

const fakeAtem = new EventEmitter(); // todo rm

const atemAddress = "192.168.1.140";
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
    console.log(state); // catch the ATEM state.

    // todo
    // broadcast("programChanged", programBus);
    // broadcast("previewChanged", programBus);
});

// todo: set initial state with "atem.state"
programBus = 1
lightBus = 1
previewBus = 2

let cameraStatuses = {
    1: "OK",
    2: "OK",
    3: "OK",
}

fakeAtem.on("programBus", function (_programBus) { // todo rm
    programBus = _programBus;
    broadcast("programChanged", _programBus);
});

fakeAtem.on("previewBus", function (_previewBus) { // todo rm
    previewBus = _previewBus
    broadcast("previewChanged", _previewBus);
});

function changePreview(previewBus) {
    // todo sth with atem
    // atem.changePreviewInput(previewBus);
    fakeAtem.emit('previewBus', previewBus) // todo: rm
}

function changeProgram(programBus) {
    // todo sth with atem
    // atem.changeProgramInput(programBus);
    fakeAtem.emit('programBus', programBus) //todo: rm
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

