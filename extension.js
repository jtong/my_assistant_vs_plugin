// extension.js
const vscode = require('vscode');
const path = require('path');

const activateChatExtension = require('./chat/chatExtension');
const activateJobExtension = require('./job/jobExtension');
const AgentMarketplaceExtension = require('./agent_marketplace/agentMarketplaceExtension');
const activeAppExtention = require("./app/appExtension");

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

    // 注册剪贴板反转义命令
    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.unescapeClipboard', async () => {
            try {
                // 读取剪贴板内容
                const text = await vscode.env.clipboard.readText();

                // 如果剪贴板为空，显示提示
                if (!text) {
                    vscode.window.showInformationMessage('剪贴板内容为空');
                    return;
                }

                // 反转义处理
                const unescapedText = unescapeString(text);

                // 写回剪贴板
                await vscode.env.clipboard.writeText(unescapedText);

                // 显示成功提示
                vscode.window.showInformationMessage('剪贴板内容已反转义');
            } catch (error) {
                vscode.window.showErrorMessage(`反转义失败: ${error.message}`);
            }
        })
    );


}

function deactivate() { }


/**
 * 将包含转义序列的文本转换为实际字符
 * @param {string} text 包含转义序列的文本
 * @returns {string} 转换后的文本
 */
function unescapeString(text) {
    return text
        .replace(/\\n/g, '\n')     // 换行符
        .replace(/\\r/g, '\r')     // 回车符
        .replace(/\\t/g, '\t')     // 制表符
        .replace(/\\b/g, '\b')     // 退格符
        .replace(/\\f/g, '\f')     // 换页符
        .replace(/\\\\/g, '\\')    // 反斜杠
        .replace(/\\'/g, '\'')     // 单引号
        .replace(/\\"/g, '\"')     // 双引号
        .replace(/\\`/g, '\`')     // 反引号
        .replace(/\\0/g, '\0')     // NUL字符
        .replace(/\\v/g, '\v');    // 垂直制表符
}

module.exports = {
    activate,
    deactivate
};
