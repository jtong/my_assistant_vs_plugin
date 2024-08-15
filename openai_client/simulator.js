const fs = require('fs');
const path = require('path');

function readRecordings(recordPath) {
    const recordings = [];
    const files = fs.readdirSync(recordPath);

    files.forEach(file => {
        if (file.startsWith('recording_') && file.endsWith('.json')) {
            const filePath = path.join(recordPath, file);
            const recording = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            recordings.push(recording);
        }
    });

    return recordings;
}

function getSimulatedResponse(recordings, messages) {
    const inputString = JSON.stringify(messages);

    const match = recordings.find(recording => recording.input === inputString);
    if (match) {
        return match.output;
    }

    // 如果没有找到匹配的录制数据,可以返回一个默认值或抛出错误
    return 'No matching recording found.';
}

class SimulatedOpenAIProcessorDecorator {
    constructor(openAIProcessor, recordPath) {
        this.openAIProcessor = openAIProcessor;
        this.recordPath = recordPath;
        this.recordings = readRecordings(recordPath);
    }

    async processPrompt(prompt) {
        const simulateOnly = process.env.OPENAI_SIMULATE_ONLY === 'true';
        const isRecording = process.env.IS_RECORDING_OPENAI === 'true';
        let response;

        // 如果配置了记录，记录下请求和响应
        const existingRecording = this.recordings.find(recording => recording.input === prompt);

        if (simulateOnly && existingRecording) {
            // 如果已经有匹配的录制数据,则返回录制数据的输出
            return existingRecording.output;
        } else {
            // 如果没有匹配的录制数据,则访问 OpenAI 并获取响应
            response = await this.openAIProcessor.processPrompt(prompt);

            // 根据 isRecording 决定是否记录请求和响应
            if (isRecording) {
                this.recordings.push({ input: prompt, output: response });
            }

            return response;
        }

    }

    async processMessages(messages) {
        const inputString = JSON.stringify(messages);
        const simulateOnly = process.env.OPENAI_SIMULATE_ONLY === 'true';
        const isRecording = process.env.IS_RECORDING_OPENAI === 'true';
        let response;

        // 如果配置了记录，记录下请求和响应
        const existingRecording = this.recordings.find(recording => recording.input === inputString);

        if (simulateOnly && existingRecording) {
            // 如果已经有匹配的录制数据,则返回录制数据的输出
            return existingRecording.output;
        } else {
            // 如果没有匹配的录制数据,则访问 OpenAI 并获取响应
            const outputString = await this.openAIProcessor.processMessages(messages);

            // 根据 isRecording 决定是否记录请求和响应
            if (isRecording) {
                this.recordings.push({ input: inputString, output: outputString });
            }

            return outputString;
        }
    }

    clearRecordings() {
        this.recordings = []; // 重置录制列表，清空内存中的记录
    }

    saveRecordings() {
        if (!this.recordPath) {
            console.warn('No record path specified, recordings will not be saved.');
            return;
        }

        if (!fs.existsSync(this.recordPath)) {
            fs.mkdirSync(this.recordPath, { recursive: true });
        }

        this.recordings.forEach((recording, index) => {
            const filePath = path.join(this.recordPath, `recording_${index}.json`);
            fs.writeFileSync(filePath, JSON.stringify(recording));
        });
    }
}

module.exports = SimulatedOpenAIProcessorDecorator;
