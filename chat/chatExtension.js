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
                chatProvider.resolveWebviewPanel(panel);

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
                        const updatedThread = threadRepository.loadThread(threadId);
                        agentLoader.updateAgentForThread(updatedThread);
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

    return {
        chatProvider,
        listProvider
    };
}

module.exports = activateChatExtension;