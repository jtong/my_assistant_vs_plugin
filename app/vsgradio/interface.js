class Interface {
    constructor(config) {
        this.fn = config.fn;
        this.inputs = config.inputs;
        this.outputs = config.outputs;
        this.title = config.title;
    }

    getConfig() {
        return {
            title: this.title,
            inputs: this.inputs,
            outputs: this.outputs
        };
    }

    execute(inputs) {
        return this.fn(...inputs);
    }
}

module.exports = function(config) {
    return new Interface(config);
};