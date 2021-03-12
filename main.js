const express = require("express");
const app = express();
const http = require("http").createServer(app);
const ATEM = require('applest-atem');
// const ATEM = require('./atemMocker');
const io = require("socket.io")(http, {
    cors: {
        origin: "*"
    }
});

const atemAddress = "192.168.1.240";
const serverPort = 7000;

let atem = new ATEM();

atem.on('connect', function() {
	atem.changePreviewInput(1)
	atem.changeProgramInput(1)
	 atem.changeUpstreamKeyState(0, true);
});

atem.connect(atemAddress);


app.use(express.static("public"));

let sockets = [];

function broadcast(eventName, eventPayload = undefined, ack = () => {
}) {

    for (let socket of sockets) {
        socket.emit(eventName, eventPayload, ack);
    }
}

let programBus, futurProgramBus, lightBus, previewBus;

atem.on('stateChanged', function(err, state) {

    programBus = state.tallys.findIndex(tally => [1,3].includes(tally)) + 1
    previewBus = state.tallys.findIndex(tally => [2,3].includes(tally)) + 1

    broadcast("programChanged", futurProgramBus || programBus);
    broadcast("previewChanged", previewBus);
    broadcast("videoOverrided", programBus === 4);

    if(!lightBus) {
        lightBus = futurProgramBus || programBus;
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

function changeProgram(_programBus, force) {
    if(force || programBus !== 4) {
        atem.changeProgramInput(_programBus);
    } else {
        futurProgramBus = _programBus
    }
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
        const nextPreviewBus = futurProgramBus || programBus;
        changeLight(previewBus)
        clearTimeout(cutTimeout)
        cutTimeout = setTimeout(() => {
            changeProgram(nextProgramBus, false)
            changePreview(nextPreviewBus)
        }, 0);
    });

    socket.on("delayedCut", () => {
        const oldPreviewBus = previewBus;
        changeLight(previewBus)
        clearTimeout(cutTimeout)
        cutTimeout = setTimeout(() => {
            const nextPreviewBus = previewBus === oldPreviewBus ? (futurProgramBus || programBus) : previewBus;
            changeProgram(oldPreviewBus, false)
            changePreview(nextPreviewBus)
        }, 500);
    });

    socket.on("blindCut", () => {
        const nextProgramBus = previewBus;
        const nextPreviewBus = futurProgramBus || programBus;
        clearTimeout(cutTimeout)
        cutTimeout = setTimeout(() => {
            changeProgram(nextProgramBus, false)
            changePreview(nextPreviewBus)
        }, 0);
    });

    socket.on("toggleVideoOverriding", () => {
        videoOverridding = programBus === 4

        if(videoOverridding) {
            clearTimeout(cutTimeout)
            cutTimeout = setTimeout(() => {
                atem.changeUpstreamKeyState(0, true)
                changeProgram(futurProgramBus, true)
                futurProgramBus = null;
            }, 0);

        } else {
            futurProgramBus = programBus;
            clearTimeout(cutTimeout)
            cutTimeout = setTimeout(() => {
                changeProgram(4, true)
                atem.changeUpstreamKeyState(0, false)
            }, 0);
        }
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

    socket.emit("programChanged", futurProgramBus || programBus);
    socket.emit("lightChanged", lightBus);
    socket.emit("previewChanged", previewBus);
    socket.emit("videoOverrided", programBus === 4);
    for(let camera of Object.keys(cameraStatuses)) {
        socket.emit("cameraStatusChanged", {camera, status: cameraStatuses[camera] });
    }

});

http.listen(serverPort, () => {

    console.info(`Server port : ${serverPort}`);
    console.info(`ATEM IP : ${atemAddress}`);
});
