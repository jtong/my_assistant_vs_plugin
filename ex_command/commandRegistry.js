// ex_command/commandRegistry.js
const vscode = require('vscode');
const path = require('path');
const unescapeClipboardCommand = require('./unescapeClipboardCommand');
const parseClipboardFilesCommand = require('./parseClipboardFilesCommand');
const parseClipboardFilePatchCommand = require('./parseClipboardFilePatchCommand');

function registerExtendedCommands(context) {
    // 注册剪贴板反转义命令
    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.unescapeClipboard', unescapeClipboardCommand)
    );

    // 注册剪贴板文件解析命令
    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.applyAIGenFilesFromClipboard', parseClipboardFilesCommand)
    );

    // 注册剪贴板文件补丁解析命令
    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.applyAIGenFilePatchesFromClipboard', parseClipboardFilePatchCommand)
    );
    
}

module.exports = registerExtendedCommands;