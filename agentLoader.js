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
        this.config = this.loadConfig();

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

    getAgentConfig(name){
        return this.config.agents.find(a => a.name === name);
    }
    
    loadAgent(name) {
        if (this.loadedAgents[name]) {
            return this.loadedAgents[name];
        }

        const agentConfig = this.config.agents.find(a => a.name === name);
        if (!agentConfig) {
            throw new Error(`Agent "${name}" not found in configuration`);
        }

        const AgentClass = require(path.resolve(path.dirname(this.configPath), agentConfig.path));
        const agent = new AgentClass(agentConfig.metadata, this.mergeSettings(agentConfig.settings, this.globalSettings));
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

    filterAgents(filterFn) {
        const filteredAgents = this.config.agents.filter(filterFn);
        return filteredAgents.map(agent => this.loadAgent(agent.name));
    }

    updateSettings(newSettings) {
        this.globalSettings = newSettings;
        this.clearLoadedAgents();
    }

    loadAgentForThread(thread) {
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
        
        const agent = new AgentClass(agentConfig.metadata, finalSettings);
        
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