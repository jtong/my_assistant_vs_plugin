// ex_command/commandRegistry.js
const vscode = require('vscode');
const path = require('path');

function registerExtendedCommands(context) {
    // 注册剪贴板反转义命令
    const unescapeClipboardCommand = require('./unescapeClipboardCommand');
    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.unescapeClipboard', unescapeClipboardCommand)
    );

    // 注册剪贴板文件解析命令
    const parseClipboardFilesCommand = require('./parseClipboardFilesCommand');
    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.applyAIGenFilesFromClipboard', parseClipboardFilesCommand)
    );
    
}

module.exports = registerExtendedCommands;