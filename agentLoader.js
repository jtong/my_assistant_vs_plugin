// agentLoader.js
const fs = require('fs');
const path = require('path');

class AgentLoader {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.loadedAgents = {};
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
        const agent = new AgentClass(agentConfig.metadata);
        this.loadedAgents[name] = agent;
        return agent;
    }

    getAgentsList() {
        return this.config.agents.map(agent => ({
            name: agent.name,
            path: agent.path
        }));
    }

    filterAgents(filterFn) {
        const filteredAgents = this.config.agents.filter(filterFn);
        return filteredAgents.map(agent => this.loadAgent(agent.name));
    }
}

module.exports = AgentLoader;