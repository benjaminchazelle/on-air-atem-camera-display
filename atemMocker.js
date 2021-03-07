module.exports = class ATEM {

    constructor() {
        this.programBus = 1;
        this.previewBus = 1;

        this.key = false;

        this.stateChangedCallback = () => {}
    }

    log() {
        let buttons = ["1", "2", "3", "4"]

        buttons[this.previewBus-1] = "G";
        buttons[this.programBus-1] = "R";

        let key = this.key ? "KEY" : "!KEY"

        console.log(buttons.join(" "), key)
    }

    connect() {

    }

    on(event, callback) {
        this.stateChangedCallback = () => {
            const state = {
                tallys: [0, 0, 0, 0],
                todoKey: this.key
            };
            state.tallys[this.programBus-1] += 1
            state.tallys[this.previewBus-1] += 2

            callback(null, state);
            this.log()
        }
        this.stateChangedCallback();
    }

    changePreviewInput(previewBus) {
        this.previewBus = previewBus;
        this.stateChangedCallback();
    }

    changeProgramInput(programBus) {
        this.programBus = programBus;
        this.stateChangedCallback();
    }

    changeTodoKey(status) {
        this.key = status;
        this.stateChangedCallback();
    }

}