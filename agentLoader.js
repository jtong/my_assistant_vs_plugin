// agentLoader.js
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

class AgentLoader {
    constructor(configPath, globalSettings) {
        this.configPath = configPath;
        this.loadedAgents = {};
        this.globalSettings = globalSettings;
        this.threadAgents = {};
        this.ensureConfigFile();
        this.config = this.loadConfig();
    }

    ensureConfigFile() {
        const dirPath = path.dirname(this.configPath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        if (!fs.existsSync(this.configPath)) {
            const defaultConfig = {
                agents: []
            };
            fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
            console.log(`Initialized default config at ${this.configPath}`);
        }
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            } else {
                vscode.window.showErrorMessage(`Configuration file not found: ${this.configPath}`);
                return { agents: [] };
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error loading configuration: ${error.message}`);
            return { agents: [] };
        }
    }

    reloadConfig() {
        this.config = this.loadConfig();
    }

    clearLoadedAgents() {
        this.loadedAgents = {};
        this.threadAgents = {};
    }

    getAgentConfig(name) {
        return this.config.agents.find(a => a.name === name);
    }

    async loadAgent(name) {
        if (this.loadedAgents[name]) {
            return this.loadedAgents[name];
        }

        const agentConfig = this.config.agents.find(a => a.name === name);
        if (!agentConfig) {
            throw new Error(`Agent "${name}" not found in configuration`);
        }

        const AgentClass = require(path.resolve(path.dirname(this.configPath), agentConfig.path));
        
        // 检查是否有 create 静态方法
        let agent;
        if (typeof AgentClass.create === 'function') {
            // 如果有 create 静态方法，使用 await 调用
            agent = await AgentClass.create(agentConfig.metadata, this.mergeSettings(agentConfig.settings, this.globalSettings));
        } else {
            // 否则使用构造函数
            agent = new AgentClass(agentConfig.metadata, this.mergeSettings(agentConfig.settings, this.globalSettings));
        }
        
        this.loadedAgents[name] = agent;
        return agent;
    }

    mergeSettings(agentSettings, globalSettings) {
        return { ...agentSettings, ...globalSettings };
    }

    getAgentsList() {
        return this.config.agents.map(agent => ({
            name: agent.name,
            path: agent.path,
            metadata: agent.metadata
        }));
    }

    // 除了market好像没地方用
    async filterAgents(filterFn) {
        const filteredAgents = this.config.agents.filter(filterFn);
        // 使用 Promise.all 处理多个异步操作
        return Promise.all(filteredAgents.map(agent => this.loadAgent(agent.name)));
    }

    updateSettings(newSettings) {
        this.globalSettings = newSettings;
        this.clearLoadedAgents();
    }

    async loadAgentForThread(thread) {
        const key = `${thread.id}:${thread.agent}`;

        if (this.threadAgents[key]) {
            return this.threadAgents[key];
        }

        const agentConfig = this.config.agents.find(a => a.name === thread.agent);
        if (!agentConfig) {
            throw new Error(`Agent "${thread.agent}" not found in configuration`);
        }

        const AgentClass = require(path.resolve(path.dirname(this.configPath), agentConfig.path));
        const mergedSettings = this.mergeSettings(agentConfig.settings, this.globalSettings);

        // 只有当 thread 有 settings 时才合并
        const finalSettings = thread.settings ? { ...mergedSettings, ...thread.settings } : mergedSettings;

        // 检查是否有 create 静态方法
        let agent;
        if (typeof AgentClass.create === 'function') {
            // 如果有 create 静态方法，使用 await 调用
            agent = await AgentClass.create(agentConfig.metadata, finalSettings);
        } else {
            // 否则使用构造函数
            agent = new AgentClass(agentConfig.metadata, finalSettings);
        }

        this.threadAgents[key] = agent;
        return agent;
    }

    clearThreadAgents() {
        this.threadAgents = {};
    }

    updateAgentForThread(thread) {
        const key = `${thread.id}:${thread.agent}`;
        if (this.threadAgents[key]) {
            // 删除现有的代理实例
            delete this.threadAgents[key]; //这样避免有些开发人员有不良习惯，持有了取出来的agent实例，导致逻辑错误。
        }
        // 注意：这里不需要立即创建新的代理实例
        // 新的代理实例将在下次调用 loadAgentForThread 时创建
    }
}

module.exports = AgentLoader;