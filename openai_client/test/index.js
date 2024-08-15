const { expect } = require('chai');
const OpenAIProcessorInstance = require('../factory');
const fs = require("fs");
const path = require("path");
const casesDirectory = "openai_client/test/cases";


function clearDirectory(directoryPath, excludedFiles = []) {
    if (fs.existsSync(directoryPath)) {
        const files = fs.readdirSync(directoryPath);
        for (const file of files) {
            if (!excludedFiles.includes(file)) {
                fs.unlinkSync(path.join(directoryPath, file));
            }
        }
    }
}
describe('OpenAI Simulated Response Test', function() {
    it('should return the simulated response from the specified json recording when simulation is enabled', async function() {
        // 模拟环境变量设置
        this.timeout(10000);

        const simulatedAPIKey = process.env.OPENAI_API_KEY;
        const simulatedModel = 'gpt-3.5-turbo';
        const simulateOnly = "true"; // 打开模拟开关
        const simulatorPath = path.join(__dirname, 'cases/case1/simulator'); // 指定模拟器记录的路径

        // 设置环境变量
        process.env.OPENAI_SIMULATE_ONLY = simulateOnly;
        process.env.OPENAI_API_KEY = simulatedAPIKey;
        process.env.OPENAI_SIMULATOR_PATH = simulatorPath;

        // 创建模拟的 OpenAI 处理器实例
        const openAIProcessor = OpenAIProcessorInstance.getSimulatedOpenAIProcessor(simulatedAPIKey, simulatedModel);
        // 模拟消息处理
        expect(await openAIProcessor.processMessages([{role: "user", content: "这是测试提示"}]))
            .to.equal('这是预期响应');

        expect(await openAIProcessor.processMessages([{role: "user", content: "这是测试提示2"}]))
            .to.equal('这是预期响应2');
    });
});

describe('OpenAI Response Recording Test', function() {
    const simulatorPath = path.join(__dirname, 'cases/case2/simulator');

    beforeEach(function() {
        OpenAIProcessorInstance.reset();

        // 确保模拟器路径存在
        if (!fs.existsSync(simulatorPath)) {
            fs.mkdirSync(simulatorPath, { recursive: true });
        }
        // 清除模拟器路径中的记录文件
        clearDirectory(simulatorPath);
    });

    it('should record OpenAI responses to a file if IS_RECORDING_OPENAI is true', async function() {
        // 模拟环境变量设置
        this.timeout(10000);

        const simulatedAPIKey = process.env.OPENAI_API_KEY;
        const simulatedModel = 'gpt-3.5-turbo';
        const simulateOnly = "false";
        const isRecording = "true";

        // 设置环境变量
        process.env.OPENAI_SIMULATE_ONLY = simulateOnly;
        process.env.IS_RECORDING_OPENAI = isRecording;
        process.env.OPENAI_SIMULATOR_PATH = simulatorPath;

        // 创建模拟的 OpenAI 处理器实例
        const openAIProcessor = OpenAIProcessorInstance.getSimulatedOpenAIProcessor(simulatedAPIKey, simulatedModel);
        openAIProcessor.clearRecordings();
        // 模拟消息处理
        const messages = [
            { role: "user", content: "小明的爸爸只有三个儿子，老大叫大毛，老二叫二毛，老三叫什么？" }
        ];
        const response = await openAIProcessor.processMessages(messages);
        openAIProcessor.saveRecordings();

        // 验证是否有记录文件被创建
        const recordedFiles = fs.readdirSync(simulatorPath);
        expect(recordedFiles).to.have.lengthOf(1);

        // 验证记录文件内容
        recordedFiles.forEach(file => {
            const recordingData = JSON.parse(fs.readFileSync(path.join(simulatorPath, file), 'utf8'));
            expect(recordingData.input).to.equal(JSON.stringify(messages));
            expect(recordingData.output).to.equal(response);
        });
    });
    it('should record multiple OpenAI responses to multiple files if IS_RECORDING_OPENAI is true', async function() {
        // 模拟环境变量设置
        this.timeout(20000);

        const simulatedAPIKey = process.env.OPENAI_API_KEY;
        const simulatedModel = 'gpt-3.5-turbo';
        const simulateOnly = "false";
        const isRecording = "true";

        // 设置环境变量
        process.env.OPENAI_SIMULATE_ONLY = simulateOnly;
        process.env.IS_RECORDING_OPENAI = isRecording;
        process.env.OPENAI_SIMULATOR_PATH = simulatorPath;

        // 创建模拟的 OpenAI 处理器实例
        const openAIProcessor = OpenAIProcessorInstance.getSimulatedOpenAIProcessor(simulatedAPIKey, simulatedModel);
        openAIProcessor.clearRecordings();
        // 模拟多轮消息处理
        const messagesRound1 = [
            { role: "user", content: "这是第一轮测试提示" }
        ];
        const messagesRound2 = [
            { role: "user", content: "这是第二轮测试提示" }
        ];

        // 处理第一轮消息
        const responseRound1 = await openAIProcessor.processMessages(messagesRound1);
        // 处理第二轮消息
        const responseRound2 = await openAIProcessor.processMessages(messagesRound2);

        // 存储录制
        openAIProcessor.saveRecordings();

        // 验证是否有多个记录文件被创建
        const recordedFiles = fs.readdirSync(simulatorPath);
        expect(recordedFiles).to.have.lengthOf.at.least(2); // 至少有两个文件

        // 验证记录文件内容
        recordedFiles.forEach(file => {
            const recordingData = JSON.parse(fs.readFileSync(path.join(simulatorPath, file), 'utf8'));
            expect(recordingData.input).to.be.oneOf([JSON.stringify(messagesRound1), JSON.stringify(messagesRound2)]);
            expect(recordingData.output).to.be.oneOf([responseRound1, responseRound2]);
        });
    });
});

describe('OpenAI Response Recording Test with simulateOnly = false', function() {
    const simulatorPath = path.join(__dirname, 'cases/case3/simulator');

    beforeEach(function() {
        OpenAIProcessorInstance.reset();

        // 确保模拟器路径存在
        if (!fs.existsSync(simulatorPath)) {
            fs.mkdirSync(simulatorPath, { recursive: true });
        }
        // 清除模拟器路径中的记录文件,但保留recording_0.json
        clearDirectory(simulatorPath, ['recording_0.json']);
    });


    it('should record new OpenAI responses and not duplicate existing ones when simulateOnly is false', async function() {
        // 模拟环境变量设置
        this.timeout(10000);

        const simulatedAPIKey = process.env.OPENAI_API_KEY;
        const simulatedModel = 'gpt-3.5-turbo';
        const simulateOnly = "true";
        const isRecording = "true";

        // 设置环境变量
        process.env.OPENAI_SIMULATE_ONLY = simulateOnly;
        process.env.IS_RECORDING_OPENAI = isRecording;
        process.env.OPENAI_SIMULATOR_PATH = simulatorPath;

        // 创建模拟的 OpenAI 处理器实例
        const openAIProcessor = OpenAIProcessorInstance.getSimulatedOpenAIProcessor(simulatedAPIKey, simulatedModel);

        // 模拟消息处理
        const existingMessages = [{ role: "user", content: "这是一个已存在的测试提示" }];
        const newMessages = [{ role: "user", content: "这是一个新的测试提示" }];

        // 处理已存在的消息
        const existingResponse = await openAIProcessor.processMessages(existingMessages);
        // 处理新的消息
        const newResponse = await openAIProcessor.processMessages(newMessages);

        // 存储录制
        openAIProcessor.saveRecordings();

        // 验证是否只有一个记录文件被创建
        const recordedFiles = fs.readdirSync(simulatorPath)
        const jsonFiles = recordedFiles.filter(file => file.endsWith('.json'));
        expect(jsonFiles).to.have.lengthOf(2);

        // 验证记录文件内容
        recordedFiles.forEach(file => {
            const recordingData = JSON.parse(fs.readFileSync(path.join(simulatorPath, file), 'utf8'));
            if (file === 'recording_0.json') {
                expect(recordingData.input).to.equal(JSON.stringify(existingMessages));
                expect(existingResponse).to.equal("这是一个已存在的测试响应");
            } else {
                expect(recordingData.input).to.equal(JSON.stringify(newMessages));
                expect(recordingData.output).to.equal(newResponse);
            }
        });
    });
});

describe('OpenAI Prompt Recording Test', function() {
    const simulatorPath = path.join(__dirname, 'cases/case4/simulator');

    beforeEach(function() {
        OpenAIProcessorInstance.reset();
        // 确保模拟器路径存在
        if (!fs.existsSync(simulatorPath)) {
            fs.mkdirSync(simulatorPath, { recursive: true });
        }
        // 清除模拟器路径中的记录文件
        clearDirectory(simulatorPath, ['recording_0.json', '.gitignore']);
    });

    it('should record OpenAI prompt responses to a file if IS_RECORDING_OPENAI is true', async function() {
        // 模拟环境变量设置
        this.timeout(10000);

        const simulatedAPIKey = process.env.OPENAI_API_KEY;
        const simulatedModel = 'gpt-3.5-turbo';
        const simulateOnly = "false";
        const isRecording = "true";

        // 设置环境变量
        process.env.OPENAI_SIMULATE_ONLY = simulateOnly;
        process.env.IS_RECORDING_OPENAI = isRecording;
        process.env.OPENAI_SIMULATOR_PATH = simulatorPath;

        // 创建模拟的 OpenAI 处理器实例
        const openAIProcessor = OpenAIProcessorInstance.getSimulatedOpenAIProcessor(simulatedAPIKey, simulatedModel);
        openAIProcessor.clearRecordings();
        // 模拟消息处理
        const prompt = "这是一个测试提示" ;
        const response = await openAIProcessor.processPrompt(prompt);
        openAIProcessor.saveRecordings();

        // 验证是否有记录文件被创建
        const recordedFiles = fs.readdirSync(simulatorPath);
        const jsonFiles = recordedFiles.filter(file => file.endsWith('.json'));
        expect(jsonFiles).to.have.lengthOf(1);

        // 验证记录文件内容
        jsonFiles.forEach(file => {
            const recordingData = JSON.parse(fs.readFileSync(path.join(simulatorPath, file), 'utf8'));
            expect(recordingData.input).to.equal(prompt);
            expect(recordingData.output).to.equal(response);
        });
    });
});


describe('OpenAI Prompt Simulation Test', function() {
    const simulatorPath = path.join(__dirname, 'cases/case5/simulator');

    beforeEach(function() {
        OpenAIProcessorInstance.reset();
    });
    it('should return the simulated response from the specified json recording when simulation is enabled', async function() {
        this.timeout(10000);

        const simulatedAPIKey = process.env.OPENAI_API_KEY;
        const simulatedModel = 'gpt-3.5-turbo';
        const simulateOnly = "true";
        const simulatorPath = path.join(__dirname, 'cases/case5/simulator');

        process.env.OPENAI_SIMULATE_ONLY = simulateOnly;
        process.env.OPENAI_API_KEY = simulatedAPIKey;
        process.env.OPENAI_SIMULATOR_PATH = simulatorPath;

        const openAIProcessor = OpenAIProcessorInstance.getSimulatedOpenAIProcessor(simulatedAPIKey, simulatedModel);

        expect(await openAIProcessor.processPrompt("这是测试提示0")).to.equal('这是预期响应0');
        expect(await openAIProcessor.processPrompt("这是测试提示1")).to.equal('这是预期响应1');
    });
});

describe('OpenAI Prompt Recording Test with simulateOnly = false', function() {
    const simulatorPath = path.join(__dirname, 'cases/case6/simulator');

    beforeEach(function() {
        OpenAIProcessorInstance.reset();

        if (!fs.existsSync(simulatorPath)) {
            fs.mkdirSync(simulatorPath, { recursive: true });
        }
        clearDirectory(simulatorPath, ['recording_0.json', '.gitignore']);
    });

    it('should record new OpenAI prompt responses and not duplicate existing ones when simulateOnly is true', async function() {
        this.timeout(10000);

        const simulatedAPIKey = process.env.OPENAI_API_KEY;
        const simulatedModel = 'gpt-3.5-turbo';
        const simulateOnly = "true";
        const isRecording = "true";

        process.env.OPENAI_SIMULATE_ONLY = simulateOnly;
        process.env.IS_RECORDING_OPENAI = isRecording;
        process.env.OPENAI_SIMULATOR_PATH = simulatorPath;

        const openAIProcessor = OpenAIProcessorInstance.getSimulatedOpenAIProcessor(simulatedAPIKey, simulatedModel);

        const existingPrompt = "这是一个已存在的测试提示";
        const existingResponse = await openAIProcessor.processPrompt(existingPrompt);
        const newPrompt = "这是一个新的测试提示";
        const newResponse = await openAIProcessor.processPrompt(newPrompt);

        openAIProcessor.saveRecordings();

        const recordedFiles = fs.readdirSync(simulatorPath);
        const jsonFiles = recordedFiles.filter(file => file.endsWith('.json'));
        expect(jsonFiles).to.have.lengthOf(2);

        jsonFiles.forEach(file => {
            const recordingData = JSON.parse(fs.readFileSync(path.join(simulatorPath, file), 'utf8'));
            if (file === 'recording_0.json') {
                expect(recordingData.input).to.equal(existingPrompt);
                expect(existingResponse).to.equal("这是一个已存在的测试响应");
            } else {
                expect(recordingData.input).to.equal(newPrompt);
                expect(recordingData.output).to.equal(newResponse);
            }
        });
    });
});
