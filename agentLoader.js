// agentLoader.js
const fs = require('fs');
const path = require('path');

class AgentLoader {
    constructor(configPath, settings) {
        this.configPath = configPath;
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.loadedAgents = {};
        this.settings = settings;
        this.threadAgents = {};
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
        const agent = new AgentClass(agentConfig.metadata, this.settings);
        this.loadedAgents[name] = agent;
        return agent;
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
        this.settings = newSettings;
        this.loadedAgents = {};
        this.clearThreadAgents();
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
        const agentMetadata = { ...agentConfig.metadata, ...thread.meta };
        const agent = new AgentClass(agentMetadata, this.settings);
        
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