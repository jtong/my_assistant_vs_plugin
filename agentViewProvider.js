// agentViewProvider.js
const vscode = require('vscode');

class AgentViewProvider {
    constructor(agentLoader) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.agentLoader = agentLoader;
    }

    getTreeItem(element) {
        return {
            label: element.name,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command: {
                command: 'myAssistant.selectAgent',
                title: 'Select Agent',
                arguments: [element.name]
            }
        };
    }

    getChildren() {
        return this.agentLoader.getAgentsList();
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

module.exports = AgentViewProvider;