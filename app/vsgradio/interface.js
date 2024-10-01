class Interface {
    constructor(config) {
        this.fn = config.fn;
        this.inputs = config.inputs;
        this.outputs = config.outputs;
        this.title = config.title;
        this.events = {}; // 存储所有事件处理器
    }

    getConfig() {
        return {
            title: this.title,
            inputs: this.inputs.map(input => ({
                ...input,
                events: Object.keys(input.events || {})
            })),
            outputs: this.outputs
        };
    }

    execute(inputs) {
        return this.fn(...inputs);
    }

    // 新方法：注册事件处理器
    registerEventHandlers() {
        this.inputs.forEach((input, index) => {
            if (input.events) {
                Object.entries(input.events).forEach(([eventName, handler]) => {
                    const key = `input_${index}_${eventName}`;
                    this.events[key] = handler;
                });
            }
        });
    }

    handleEvent(inputIndex, eventName, value, allInputs) {
        const key = `input_${inputIndex}_${eventName}`;
        if (this.events[key]) {
            return this.events[key](value, allInputs);
        }
    }
}

module.exports = function(config) {
    return new Interface(config);
};