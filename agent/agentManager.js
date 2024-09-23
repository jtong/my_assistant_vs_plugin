// agent/agentManager.js
const vscode = require('vscode');
const AgentMarketplace = require('./agentMarketplace');
const AgentMarketplaceViewProvider = require('./agentMarketplaceViewProvider');

class AgentManager {
    constructor(context) {
        this.context = context;
        this.agentMarketplace = new AgentMarketplace(context);
        this.agentMarketplaceViewProvider = new AgentMarketplaceViewProvider(this.agentMarketplace);
    }

    activate() {
        // 注册 WebView Provider
        this.context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('agentMarketplace', this.agentMarketplaceViewProvider)
        );

        // 注册命令
        this.context.subscriptions.push(
            vscode.commands.registerCommand('myAssistant.refreshAgentMarketplace', () => {
                this.agentMarketplaceViewProvider.refresh();
            })
        );

        this.context.subscriptions.push(
            vscode.commands.registerCommand('myAssistant.installAgent', async (agentName) => {
                const agents = await this.agentMarketplace.getAgentList();
                const agent = agents.find(p => p.name === agentName);
                if (agent) {
                    const success = await this.agentMarketplace.installAgent(agent);
                    if (success) {
                        vscode.window.showInformationMessage(`Agent ${agent.name} installed successfully! Please reload the window to activate the agent.`);
                        this.agentMarketplaceViewProvider.refresh();
                    } else {
                        vscode.window.showErrorMessage(`Failed to install agent ${agent.name}.`);
                    }
                }
            })
        );

        // 监听设置变化
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('myAssistant.agentRepositoryUrl')) {
                this.agentMarketplace.updateAgentListUrl();
                this.agentMarketplaceViewProvider.refresh();
            }
        });
    }
}

module.exports = AgentManager;