// ex_command/gotoPathCommand.js
const vscode = require('vscode');
const path = require('path');

async function gotoPathCommand(extensionContext) {
    try {
        // 获取 debug 模式配置
        const config = vscode.workspace.getConfiguration('myAssistant');
        const debugMode = config.get('debugMode', false);

        // 获取当前工作区根路径
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        const projectRoot = workspaceFolders[0].uri.fsPath;

        // 让用户输入需求描述
        const userInput = await vscode.window.showInputBox({
            prompt: "Describe where you want to go",
            placeHolder: "e.g., the component that handles user login",
            ignoreFocusOut: true
        });

        if (!userInput || userInput.trim() === '') {
            return; // 用户取消或输入为空
        }

        // 检查 goto agent 是否存在
        const agentConfigPath = path.join(projectRoot, '.ai_helper', 'agent', 'internal_chat', 'agents.json');
        const fs = require('fs');
        
        if (!fs.existsSync(agentConfigPath)) {
            vscode.window.showErrorMessage('Internal chat agents configuration not found');
            return;
        }

        const agentConfig = JSON.parse(fs.readFileSync(agentConfigPath, 'utf8'));
        const gotoAgent = agentConfig.agents.find(a => a.name === 'GoToPathAgent');
        
        if (!gotoAgent) {
            vscode.window.showErrorMessage('Goto agent not found in internal chat configuration');
            return;
        }

        // 创建新的 thread
        const timestamp = Date.now();
        const chatName = `Goto: ${userInput.substring(0, 30)}${userInput.length > 30 ? '...' : ''}`;
        const newThreadId = 'thread_' + timestamp;
        
        // 直接使用内部 chat 的创建和打开逻辑
        const AgentLoader = require('../agentLoader');
        const ChatThreadRepository = require('../chat/chatThreadRepository');
        
        const settings = {
            apiKey: config.get('apiKey'),
            agentRepositoryUrl: config.get('agentRepositoryUrl')
        };
        
        const agentLoader = new AgentLoader(agentConfigPath, settings);
        const threadRepository = new ChatThreadRepository(
            path.join(projectRoot, '.ai_helper/agent/memory_repo', 'internal_chat_threads'),
            agentLoader
        );
        
        const newThread = threadRepository.createThread(newThreadId, chatName, gotoAgent.name);

        // 添加用户消息，带上 autoProcess 标记
        const userMessage = {
            id: 'msg_' + timestamp,
            sender: 'user',
            text: userInput,
            timestamp: timestamp,
            threadId: newThreadId,
            meta: {
                autoProcess: true  // 标记这条消息需要在打开时自动处理
            }
        };
        threadRepository.addMessage(newThread, userMessage);

        // 刷新 internal chat 列表
        await vscode.commands.executeCommand('myAssistant.refreshInternalChatList');

        if (debugMode) {
            // Debug 模式：打开 UI
            await vscode.commands.executeCommand('myAssistant.openInternalChat', chatName, newThreadId);
        } else {
            // 非 Debug 模式：后台执行 InitTask
            const Task = require('ai-agent-response').Task;
            const initTask = new Task({
                name: "InitTask",
                type: Task.TYPE_ACTION,
                message: "",
                meta: {},
                skipUserMessage: true,
                skipBotMessage: false
            });

            // 调用后台执行命令
            await vscode.commands.executeCommand(
                'myAssistant.executeTaskInBackground.internalChat',
                newThreadId,
                initTask
            );
        }

    } catch (error) {
        console.error('Goto path command error:', error);
        vscode.window.showErrorMessage(`Goto failed: ${error.message}`);
    }
}

module.exports = gotoPathCommand;