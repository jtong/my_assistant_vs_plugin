// chat/hostUtils.js
const vscode = require('vscode');
const path = require('path');

function createHostUtils(panel, threadRepository) {
    return {
        getConfig: () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const projectRoot = workspaceFolder ? workspaceFolder.uri.fsPath : '';
            const projectName = workspaceFolder ? workspaceFolder.name : '';

            // 假设 .ai_helper 文件夹在项目根目录下
            const aiHelperRoot = path.join(projectRoot, '.ai_helper');
            const chatWorkingSpaceRoot = path.join(aiHelperRoot, 'agent', 'memory_repo', 'chat_working_space');

            return {
                projectRoot: projectRoot,
                projectName: projectName,
                aiHelperRoot: aiHelperRoot,
                chatWorkingSpaceRoot: chatWorkingSpaceRoot,
            };
        },
        convertToWebviewUri: (absolutePath) => {
            const uri = vscode.Uri.file(absolutePath);
            return panel.webview.asWebviewUri(uri).toString();
        },
        getImageUri: (threadId, imagePath) => {
            const absolutePath = path.join(threadRepository.storagePath, threadId, imagePath);
            const uri = vscode.Uri.file(absolutePath);
            return panel.webview.asWebviewUri(uri).toString();
        },
        threadRepository: threadRepository,
        postMessage: (message) => {
            panel.webview.postMessage(message);
        }
    };
}

function createBackgroundHostUtils(threadRepository) {
    return {
        getConfig: () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const projectRoot = workspaceFolder ? workspaceFolder.uri.fsPath : '';
            const projectName = workspaceFolder ? workspaceFolder.name : '';

            const aiHelperRoot = path.join(projectRoot, '.ai_helper');
            const chatWorkingSpaceRoot = path.join(aiHelperRoot, 'agent', 'memory_repo', 'chat_working_space');

            return {
                projectRoot: projectRoot,
                projectName: projectName,
                aiHelperRoot: aiHelperRoot,
                chatWorkingSpaceRoot: chatWorkingSpaceRoot,
            };
        },
        convertToWebviewUri: (absolutePath) => {
            throw new Error('convertToWebviewUri is not available in background mode. This function requires a webview panel.');
        },
        getImageUri: (threadId, imagePath) => {
            throw new Error('getImageUri is not available in background mode. This function requires a webview panel.');
        },
        threadRepository: threadRepository,
        postMessage: (message) => {
            // do nothing
        }
    };
}

module.exports = {
    createHostUtils,
    createBackgroundHostUtils
};