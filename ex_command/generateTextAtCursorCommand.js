// ex_command/generateTextAtCursorCommand.js
const vscode = require('vscode');
const path = require('path');

async function generateTextAtCursorCommand(context) {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('没有打开的编辑器');
            return;
        }

        // 记录当前光标位置和文档信息
        const cursorPosition = editor.selection.active;
        const documentUri = editor.document.uri.toString();

        // 获取工作区根路径
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('没有打开的工作区文件夹');
            return;
        }
        const projectRoot = workspaceFolders[0].uri.fsPath;

        // 让用户输入文本生成需求
        const userInput = await vscode.window.showInputBox({
            prompt: "描述你想要生成的文本内容",
            placeHolder: "例如：生成一个用户登录的函数注释",
            ignoreFocusOut: true
        });

        if (!userInput || userInput.trim() === '') {
            return;
        }

        // 检查 internal chat agent 配置
        const agentConfigPath = path.join(projectRoot, '.ai_helper', 'agent', 'internal_chat', 'agents.json');
        const fs = require('fs');
        
        if (!fs.existsSync(agentConfigPath)) {
            vscode.window.showErrorMessage('未找到 internal chat agents 配置文件');
            return;
        }

        const agentConfig = JSON.parse(fs.readFileSync(agentConfigPath, 'utf8'));
        const textGenAgent = agentConfig.agents.find(a => a.name === 'TextGenAgent');
        
        if (!textGenAgent) {
            vscode.window.showErrorMessage('未找到 TextGenAgent，请确保已配置文本生成 agent');
            return;
        }

        // 创建新的 thread
        const timestamp = Date.now();
        const chatName = `TextGen: ${userInput.substring(0, 30)}${userInput.length > 30 ? '...' : ''}`;
        const newThreadId = 'thread_' + timestamp;
        
        // 初始化 agent loader 和 thread repository
        const AgentLoader = require('../agentLoader');
        const ChatThreadRepository = require('../chat/chatThreadRepository');
        
        const config = vscode.workspace.getConfiguration('myAssistant');
        const settings = {
            apiKey: config.get('apiKey'),
            agentRepositoryUrl: config.get('agentRepositoryUrl')
        };
        
        const agentLoader = new AgentLoader(agentConfigPath, settings);
        const threadRepository = new ChatThreadRepository(
            path.join(projectRoot, '.ai_helper/agent/memory_repo', 'internal_chat_threads'),
            agentLoader
        );
        
        const newThread = threadRepository.createThread(newThreadId, chatName, textGenAgent.name);

        // 添加用户消息，包含插入模式标记和目标位置信息
        const userMessage = {
            id: 'msg_' + timestamp,
            sender: 'user',
            text: userInput,
            timestamp: timestamp,
            threadId: newThreadId,
            meta: {
                autoProcess: true,
                insertMode: true,
                targetEditor: {
                    documentUri: documentUri,
                    position: {
                        line: cursorPosition.line,
                        character: cursorPosition.character
                    }
                }
            }
        };
        threadRepository.addMessage(newThread, userMessage);

        // 显示进度提示
        vscode.window.showInformationMessage('正在生成文本，请稍候...');

        // 刷新列表并打开 chat，让 Agent 自动处理后续流程
        await vscode.commands.executeCommand('myAssistant.refreshInternalChatList');
        await vscode.commands.executeCommand('myAssistant.openInternalChat', chatName, newThreadId);

    } catch (error) {
        console.error('文本生成命令错误:', error);
        vscode.window.showErrorMessage(`文本生成失败: ${error.message}`);
    }
}

module.exports = generateTextAtCursorCommand;