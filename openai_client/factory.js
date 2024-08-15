const OpenAIProcessor = require('./index');
const SimulatedOpenAIProcessorDecorator = require('./simulator');

class OpenAIProcessorInstance {
    constructor() {
        this.openAIProcessors = {};
        this.simulatedOpenAIProcessors = {};
    }

    getOpenAIProcessor(apiKey, model) {
        const key = `${apiKey}-${model}`;
        if (!this.openAIProcessors[key]) {
            this.openAIProcessors[key] = new OpenAIProcessor(apiKey, model);
        }
        return this.openAIProcessors[key];
    }

    getSimulatedOpenAIProcessor(apiKey, model) {
        const simulatorPath = process.env.OPENAI_SIMULATOR_PATH;
        const key = `${apiKey}-${model}-${simulatorPath}`;
        if (!this.simulatedOpenAIProcessors[key]) {
            const openAIProcessor = this.getOpenAIProcessor(apiKey, model);
            this.simulatedOpenAIProcessors[key] = new SimulatedOpenAIProcessorDecorator(openAIProcessor, simulatorPath);
        }
        return this.simulatedOpenAIProcessors[key];
    }

    reset() {
        Object.keys(this.openAIProcessors).forEach(key => delete this.openAIProcessors[key]);
        Object.keys(this.simulatedOpenAIProcessors).forEach(key => delete this.simulatedOpenAIProcessors[key]);
    }
}

const instance = new OpenAIProcessorInstance();
Object.freeze(instance);

module.exports = instance;