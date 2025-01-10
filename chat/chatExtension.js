// chat/chatExtension.js
const vscode = require('vscode');
const path = require('path');
const AgentLoader = require('../agentLoader');
const ChatViewProvider = require('./chatViewProvider');
const ChatListViewProvider = require('./chatListViewProvider');
const ChatMessageHandler = require('./chatMessageHandler');
const ChatThreadRepository = require('./chatThreadRepository');
const SettingsEditorProvider = require('./settingsEditorProvider');
const fs = require('fs');
const yaml = require('js-yaml');
const { Response, Task, AvailableTask } = require('ai-agent-response');

// Object to store open chat panels
const openChatPanels = {};

function activateChatExtension(context) {
    const projectRoot = context.workspaceState.get('projectRoot');
    const config = vscode.workspace.getConfiguration('myAssistant');
    const settings = config.get('apiKey');

    const agentLoader = new AgentLoader(path.join(projectRoot, '.ai_helper', 'agent', 'chat', 'agents.json'), settings);
    // 监听设置变化
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('myAssistant.apiKey')) {
            const updatedSettings = vscode.workspace.getConfiguration('myAssistant').get('apiKey');
            agentLoader.updateSettings(updatedSettings);
        }
    }));
    const threadRepository = new ChatThreadRepository(path.join(projectRoot, '.ai_helper/agent/memory_repo/chat_threads'), agentLoader);

    const messageHandler = new ChatMessageHandler(threadRepository, agentLoader);
    const chatProvider = new ChatViewProvider(context.extensionUri, threadRepository, messageHandler);
    const listProvider = new ChatListViewProvider(threadRepository);

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.revealInExplorer', (item) => {
            const threadFolder = path.join(threadRepository.storagePath, item.id);
            if (fs.existsSync(threadFolder)) {
                vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(threadFolder));
            } else {
                vscode.window.showErrorMessage(`Folder for chat "${item.name}" not found.`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.refreshChatList', async () => {
            // 重新加载代理配置
            agentLoader.reloadConfig();

            // 清空所有缓存的代理
            agentLoader.clearLoadedAgents();

            // 重新构建所有线程基础文件，用于第一次安装完插件时或其他情况下路径没有初始化成功。
            threadRepository.buildThreadsIfNotExists();

            // 刷新聊天列表视图
            listProvider.refresh();
            vscode.window.showInformationMessage('Chat list and agents refreshed successfully.');
        })
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('chatList', listProvider),
        vscode.window.createTreeView('chatList', {
            treeDataProvider: listProvider,
            showCollapseAll: false,
            canSelectMany: false
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.newChat', async () => {
            const chatName = await vscode.window.showInputBox({
                prompt: "Enter a name for the new chat"
            });
            if (chatName) {
                const agents = agentLoader.getAgentsList();
                let agentName = await vscode.window.showQuickPick(
                    agents.map(agent => agent.name),
                    { placeHolder: "Select an agent for this chat" }
                );

                if (agentName) {
                    const newThreadId = 'thread_' + Date.now();
                    const newThread = threadRepository.createThread(newThreadId, chatName, agentName);
                    listProvider.refresh();
                    vscode.commands.executeCommand('myAssistant.openChat', chatName, newThreadId);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.deleteChat', async (item) => {
            const result = await vscode.window.showWarningMessage(
                `Are you sure you want to delete the chat "${item.name}"?`,
                { modal: true },
                "Yes",
                "No"
            );
            if (result === "Yes") {
                threadRepository.deleteThread(item.id);
                listProvider.refresh();
                vscode.window.showInformationMessage(`Chat "${item.name}" deleted successfully`);

                // 如果当前打开的是被删除的聊天，则关闭它
                if (openChatPanels[item.name]) {
                    openChatPanels[item.name].dispose();
                    delete openChatPanels[item.name];
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.renameChat', async (item) => {
            const newName = await vscode.window.showInputBox({
                prompt: "Enter new name for the chat",
                value: item.name
            });
            if (newName && newName !== item.name) {
                threadRepository.renameThread(item.id, newName);
                listProvider.refresh();
                vscode.window.showInformationMessage(`Chat renamed to "${newName}"`);

                // 如果当前打开的是被重命名的聊天，则更新其标题
                if (openChatPanels[item.name]) {
                    openChatPanels[item.name].title = newName;
                    openChatPanels[newName] = openChatPanels[item.name];
                    delete openChatPanels[item.name];
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.openChat', (chatName, threadId) => {
            if (openChatPanels[chatName]) {
                openChatPanels[chatName].reveal(vscode.ViewColumn.One);
            } else {
                const panel = vscode.window.createWebviewPanel(
                    'chatView',
                    chatName,
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true,
                        localResourceRoots: [
                            vscode.Uri.file(path.join(context.extensionPath)),
                            vscode.Uri.file(projectRoot)
                        ]
                    }
                );

                panel.webview.html = chatProvider.getWebviewContent(panel.webview, threadId);
                const host_utils = {
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
                    threadRepository: threadRepository,
                    postMessage: (message) => {
                        panel.webview.postMessage(message);
                    }
                };

                chatProvider.resolveWebviewPanel(panel, host_utils);

                // 获取线程和代理信息
                const thread = threadRepository.getThread(threadId);
                const agentConfig = agentLoader.getAgentConfig(thread.agent);

                // 获取代理的 operations
                const operations = agentConfig.operations || [];

                // 获取当前线程的设置
                const currentSettings = threadRepository.getThreadSettings(threadId) || {};

                // 发送 operations 和当前设置到前端
                panel.webview.postMessage({
                    type: 'loadOperations',
                    operations: operations,
                    currentSettings: currentSettings
                });

                openChatPanels[chatName] = panel;

                panel.onDidDispose(() => {
                    delete openChatPanels[chatName];
                });

                // 处理 bootMessage
                const messagesAfterLastMarker = threadRepository.getMessagesAfterLastMarker(thread);
                if (messagesAfterLastMarker.length === 0 && agentConfig && agentConfig.metadata && agentConfig.metadata.bootMessage) {
                    const bootResponse = Response.fromJSON(agentConfig.metadata.bootMessage);
                    chatProvider.handleNormalResponse(bootResponse, thread, panel, host_utils);
                }
            }
        })
    );

    const settingsEditorProvider = new SettingsEditorProvider(threadRepository, agentLoader);

    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('chat-settings', settingsEditorProvider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.openSettingsEditor', async (item) => {
            const threadId = item.id;
            const thread = threadRepository.getThread(threadId);

            // 创建一个临时文件来存储设置
            const tempDir = path.join(context.extensionPath, 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir);
            }
            const tempFilePath = path.join(tempDir, `${threadId}_settings.yaml`);

            // 获取当前设置并写入临时文件
            let settings = threadRepository.getThreadSettings(threadId);
            if (!settings) {
                if (thread && thread.agent) {
                    const agentConfig = agentLoader.getAgentConfig(thread.agent);
                    settings = agentConfig.settings || {};
                } else {
                    settings = {};
                }
            }
            fs.writeFileSync(tempFilePath, yaml.dump(settings));

            // 打开临时文件进行编辑
            const document = await vscode.workspace.openTextDocument(tempFilePath);
            const editor = await vscode.window.showTextDocument(document);

            // 设置文档的语言模式为YAML
            await vscode.languages.setTextDocumentLanguage(document, 'yaml');

            // 当编辑器关闭时保存设置
            const closeDisposable = vscode.window.onDidChangeActiveTextEditor(async (e) => {
                if (!e || e.document.uri.fsPath !== tempFilePath) {
                    try {
                        const content = fs.readFileSync(tempFilePath, 'utf8');
                        const newSettings = yaml.load(content);
                        threadRepository.updateThreadSettings(threadId, newSettings);
                        vscode.window.showInformationMessage('Settings saved successfully.');
                    } catch (error) {
                        vscode.window.showErrorMessage(`Error saving settings: ${error.message}`);
                    } finally {
                        // 清理临时文件
                        fs.unlinkSync(tempFilePath);
                        closeDisposable.dispose();
                    }
                }
            });

            context.subscriptions.push(closeDisposable);
        })
    );

    // 在 activateChatExtension 函数中添加新的命令注册
    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.createThreadFromJson', async (uri) => {
            try {
                // 读取 JSON 文件内容
                const jsonContent = fs.readFileSync(uri.fsPath, 'utf8');
                const threadData = JSON.parse(jsonContent);

                // 验证 JSON 结构
                if (!threadData.id || !threadData.name || !threadData.agent || !Array.isArray(threadData.messages)) {
                    throw new Error('Invalid thread JSON structure. Required fields: id, name, agent, messages array');
                }

                // 验证指定的 agent 是否存在
                const agents = agentLoader.getAgentsList();
                if (!agents.find(a => a.name === threadData.agent)) {
                    const selectedAgent = await vscode.window.showQuickPick(
                        agents.map(agent => agent.name),
                        {
                            placeHolder: "Selected agent not found. Please choose an available agent",
                            ignoreFocusOut: true
                        }
                    );
                    if (!selectedAgent) {
                        return;
                    }
                    threadData.agent = selectedAgent;
                }

                // 让用户确认或修改聊天名称
                const chatName = await vscode.window.showInputBox({
                    prompt: "Enter a name for the new chat",
                    value: threadData.name,
                    ignoreFocusOut: true
                });

                if (!chatName) {
                    return;
                }

                // 生成新的 thread ID
                const newThreadId = 'thread_' + Date.now();

                // 使用现有的 createThread 方法创建基本 thread 结构
                const newThread = threadRepository.createThread(
                    newThreadId,
                    chatName,
                    threadData.agent,
                    threadData.knowledge_space
                );

                // 更新所有消息的 threadId
                const messages = threadData.messages.map(msg => ({
                    ...msg,
                    id: msg.id || 'msg_' + Date.now(),
                    threadId: newThreadId,
                    timestamp: msg.timestamp || Date.now()
                }));

                // 使用 threadRepository 中的方法批量添加消息
                messages.forEach(message => {
                    threadRepository.addMessage(newThread, message);
                });

                // 如果有设置，使用现有方法更新设置
                if (threadData.settings) {
                    threadRepository.updateThreadSettings(newThreadId, threadData.settings);
                }

                // 刷新聊天列表
                listProvider.refresh();

                // 打开新创建的聊天
                vscode.commands.executeCommand('myAssistant.openChat', chatName, newThreadId);

                vscode.window.showInformationMessage(`Successfully created thread from JSON: ${chatName}`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create thread from JSON: ${error.message}`);
            }
        })
    );

    return {
        chatProvider,
        listProvider
    };
}

module.exports = activateChatExtension;