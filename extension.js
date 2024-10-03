// extension.js
const vscode = require('vscode');
const path = require('path');

const activateChatExtension = require('./chat/chatExtension');
const activateJobExtension = require('./job/jobExtension');
const AgentMarketplaceExtension = require('./agent_marketplace/agentMarketplaceExtension');
const activeAppExtention =  require("./app/appExtension");
function activate(context) {
    // 获取当前打开的工作区文件夹路径
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const projectRoot = workspaceFolders[0].uri.fsPath;
    context.workspaceState.update('projectRoot', projectRoot);

    const chatExtension = activateChatExtension(context);
    const jobExtension = activateJobExtension(context);

    const agentMarketplaceExtension = new AgentMarketplaceExtension(context);
    agentMarketplaceExtension.activate();

    activeAppExtention(context);
}


function deactivate() { }

module.exports = {
    activate,
    deactivate
};