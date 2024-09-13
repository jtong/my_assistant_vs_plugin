// extension.js
const vscode = require('vscode');
const path = require('path');

const AgentLoader = require('./agentLoader');
const AgentViewProvider = require('./agentViewProvider');
const activateChatExtension = require('./chat/chatExtension');
const activateJobExtension = require('./job/jobExtension');

function activate(context) {
    // 获取当前打开的工作区文件夹路径
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const projectRoot = workspaceFolders[0].uri.fsPath;
    context.workspaceState.update('projectRoot', projectRoot);

    const agentLoader = new AgentLoader(path.join(projectRoot, 'ai_helper', 'agent', 'agents.json'));
    const agentViewProvider = new AgentViewProvider(agentLoader);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('agentList', agentViewProvider)
    );

    const chatExtension = activateChatExtension(context, agentLoader);
    const jobExtension = activateJobExtension(context, agentLoader);
}


function deactivate() { }

module.exports = {
    activate,
    deactivate
};