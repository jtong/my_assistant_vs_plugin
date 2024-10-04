const vscode = require('vscode');
const AgentMarketplace = require('./agentMarketplace');
const AgentMarketplaceViewProvider = require('./agentMarketplaceViewProvider');

class AgentMarketplaceExtension {
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
            vscode.commands.registerCommand('myAssistant.installAgent', async (agentName, agentType) => {
                const agents = await agentMarketplace.getAgentList();
                const agent = agents[agentType].find(p => p.name === agentName);
                if (agent) {
                    const success = await agentMarketplace.installAgent(agent);
                    if (success) {
                        vscode.window.showInformationMessage(`Agent ${agent.name} (${agentType}) installed successfully! Please reload the window to activate the agent.`);
                        agentMarketplaceViewProvider.refresh();
                    } else {
                        vscode.window.showErrorMessage(`Failed to install agent ${agent.name} (${agentType}).`);
                    }
                }
            })
        );

        // 监听设置变化
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('myAssistant.agentRepositoryUrl')) {
                this.agentMarketplace.updateAgentListUrls();
                this.agentMarketplaceViewProvider.refresh();
            }
        });
    }
}

module.exports = AgentMarketplaceExtension;