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
const { createHostUtils, createBackgroundHostUtils } = require('./hostUtils');
const companionPluginRegistry = require('../companionPluginRegistry');
// 存储打开的聊天面板
const openChatPanels = {};

function activateChatExtension(context, chatConfig = {}) {
    // 默认配置
    const defaultConfig = {
        chatType: 'chat',
        viewId: 'chatList',
        commandPrefix: 'myAssistant',
        storagePath: 'chat_threads',
        agentsPath: path.join('agent', 'chat', 'agents.json')
    };
    
    // 合并配置
    const finalConfig = { ...defaultConfig, ...chatConfig };
    
    const projectRoot = context.workspaceState.get('projectRoot');
  
    const config = vscode.workspace.getConfiguration('myAssistant');
    const settings = {
        apiKey: config.get('apiKey'),
        agentRepositoryUrl: config.get('agentRepositoryUrl')
    };

    const agentLoader = new AgentLoader(path.join(projectRoot, '.ai_helper', finalConfig.agentsPath), settings);
    
    // 监听设置变化
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('myAssistant')) {
            const updatedConfig = vscode.workspace.getConfiguration('myAssistant');
            const updatedSettings = {
                apiKey: updatedConfig.get('apiKey'),
                agentRepositoryUrl: updatedConfig.get('agentRepositoryUrl')
            };
            agentLoader.updateSettings(updatedSettings);
        }
    }));

    const threadRepository = new ChatThreadRepository(path.join(projectRoot, '.ai_helper/agent/memory_repo', finalConfig.storagePath), agentLoader);

    const messageHandler = new ChatMessageHandler(threadRepository, agentLoader);
    
    // 传入 agentLoader
    const chatProvider = new ChatViewProvider(context.extensionUri, threadRepository, messageHandler, agentLoader);
    
    const listProvider = new ChatListViewProvider(threadRepository, {
        openCommand: `${finalConfig.commandPrefix}.open${finalConfig.chatType.charAt(0).toUpperCase() + finalConfig.chatType.slice(1)}`,
        contextValue: finalConfig.chatType
    });

    // 注册 revealInExplorer 命令
    context.subscriptions.push(
        vscode.commands.registerCommand(`${finalConfig.commandPrefix}.revealInExplorer.${finalConfig.chatType}`, (item) => {
            const threadFolder = path.join(threadRepository.storagePath, item.id);
            if (fs.existsSync(threadFolder)) {
                vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(threadFolder));
            } else {
                vscode.window.showErrorMessage(`Folder for chat "${item.name}" not found.`);
            }
        })
    );

    // 注册刷新命令
    context.subscriptions.push(
        vscode.commands.registerCommand(`${finalConfig.commandPrefix}.refresh${finalConfig.chatType.charAt(0).toUpperCase() + finalConfig.chatType.slice(1)}List`, async () => {
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

    // 注册 TreeView
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(finalConfig.viewId, listProvider),
        vscode.window.createTreeView(finalConfig.viewId, {
            treeDataProvider: listProvider,
            showCollapseAll: false,
            canSelectMany: false
        })
    );

    // 注册新建聊天命令
    context.subscriptions.push(
        vscode.commands.registerCommand(`${finalConfig.commandPrefix}.new${finalConfig.chatType.charAt(0).toUpperCase() + finalConfig.chatType.slice(1)}`, async () => {
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
                    vscode.commands.executeCommand(`${finalConfig.commandPrefix}.open${finalConfig.chatType.charAt(0).toUpperCase() + finalConfig.chatType.slice(1)}`, chatName, newThreadId);
                }
            }
        })
    );

    // 注册删除聊天命令
    context.subscriptions.push(
        vscode.commands.registerCommand(`${finalConfig.commandPrefix}.delete${finalConfig.chatType.charAt(0).toUpperCase() + finalConfig.chatType.slice(1)}`, async (item) => {
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

    // 注册重命名聊天命令
    context.subscriptions.push(
        vscode.commands.registerCommand(`${finalConfig.commandPrefix}.rename${finalConfig.chatType.charAt(0).toUpperCase() + finalConfig.chatType.slice(1)}`, async (item) => {
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


    // 创建并初始化面板的通用函数
    async function createAndInitChatPanel(threadId, chatName) {
        // 获取线程和代理信息
        const thread = threadRepository.getThread(threadId);
        const agentConfig = agentLoader.getAgentConfig(thread.agent);
        
        // 检查是否启用预览
        const enablePreview = agentConfig?.metadata?.enablePreview === true;
        
        // 如果已经打开，只需要更新并显示
        if (openChatPanels[chatName]) {
            openChatPanels[chatName].reveal(vscode.ViewColumn.One);
            
            // 如果支持预览，且线程有关联的附件文件
            if (enablePreview) {
                const attachment = threadRepository.getAttachment(threadId);
                if (attachment) {
                    try {
                        const markdownContent = fs.readFileSync(attachment.path, 'utf8');
                        openChatPanels[chatName].webview.postMessage({
                            type: 'updateMarkdown',
                            content: markdownContent,
                            filePath: attachment.path
                        });
                    } catch (error) {
                        console.error('Error reading markdown attachment:', error);
                    }
                }
            }
            
            return openChatPanels[chatName];
        }

        // 获取所有伴生插件的扩展路径
        const companionExtensionPaths = companionPluginRegistry.getAllExtensionPaths();
        const localResourceRoots = [
            vscode.Uri.file(path.join(context.extensionPath)),
            vscode.Uri.file(projectRoot),
            ...companionExtensionPaths.map(p => vscode.Uri.file(p))
        ];

        // 创建新的面板
        const panel = vscode.window.createWebviewPanel(
            'chatView',
            chatName,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: localResourceRoots
            }
        );

        panel.webview.html = chatProvider.getWebviewContent(panel.webview, threadId);
        
        const host_utils = createHostUtils(panel, threadRepository);
        chatProvider.resolveWebviewPanel(panel, host_utils);
        
        // 如果有预览功能，设置预览
        if (enablePreview) {
            await chatProvider.setupMarkdownPreview(panel, threadId);
        }

        // 加载并发送operations
        await chatProvider.loadAndSendOperations(panel, thread);

        openChatPanels[chatName] = panel;

        panel.onDidDispose(() => {
            delete openChatPanels[chatName];
        });

        // 处理初始任务
        await chatProvider.handleInitialTasks(panel, thread, host_utils);
        
        return panel;
    }

    // 注册打开 Markdown 聊天命令
    context.subscriptions.push(
        vscode.commands.registerCommand(`${finalConfig.commandPrefix}.openMarkdown${finalConfig.chatType.charAt(0).toUpperCase() + finalConfig.chatType.slice(1)}`, async (uri) => {
            // If uri is not provided, try to get it from active editor
            if (!uri) {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No file is currently open');
                    return;
                }
                uri = editor.document.uri;
            }

            // Verify it's a markdown file
            if (path.extname(uri.fsPath).toLowerCase() !== '.md') {
                vscode.window.showErrorMessage('Please select a markdown file');
                return;
            }

            // Get the list of available agents and let user select one
            const agents = agentLoader.getAgentsList();
            const agentName = await vscode.window.showQuickPick(
                agents.map(agent => agent.name),
                { placeHolder: "Select an agent for this chat" }
            );

            if (!agentName) {
                return; // User cancelled agent selection
            }

            // 检查agent是否支持预览
            const agentConfig = agentLoader.getAgentConfig(agentName);
            const enablePreview = agentConfig?.metadata?.enablePreview === true;
            
            if (!enablePreview) {
                vscode.window.showWarningMessage('Selected agent does not support preview mode.');
            }

            // 读取markdown文件内容
            const document = await vscode.workspace.openTextDocument(uri);
            const markdownContent = document.getText();
            const fileName = path.basename(uri.fsPath);
            const chatName = `Chat: ${fileName}`;

            // 创建新线程
            const newThreadId = 'thread_' + Date.now();
            const newThread = threadRepository.createThread(newThreadId, chatName, agentName);
            
            // 创建附件信息
            const fileStats = fs.statSync(uri.fsPath);
            const attachment = {
                id: 'att_' + Date.now(),
                type: 'markdown',
                name: fileName,
                path: uri.fsPath,
                lastModified: fileStats.mtime.getTime(),
                size: fileStats.size
            };
            
            // 使用 setAttachment 方法保存附件
            threadRepository.setAttachment(newThreadId, attachment);
            
            // 初始化并打开聊天面板
            listProvider.refresh();
            await createAndInitChatPanel(newThreadId, chatName);
        })
    );

    // 注册打开聊天命令
    context.subscriptions.push(
        vscode.commands.registerCommand(`${finalConfig.commandPrefix}.open${finalConfig.chatType.charAt(0).toUpperCase() + finalConfig.chatType.slice(1)}`, async (chatName, threadId) => {
            await createAndInitChatPanel(threadId, chatName);
        })
    );

    // 注册后台执行任务命令
    context.subscriptions.push(
        vscode.commands.registerCommand(`${finalConfig.commandPrefix}.executeTaskInBackground.${finalConfig.chatType}`, async (threadId, task) => {
            try {
                const thread = threadRepository.getThread(threadId);
                if (!thread) {
                    throw new Error(`Thread not found: ${threadId}`);
                }

                // 创建后台模式的 host_utils（不需要 webview）
                const backgroundHostUtils = createBackgroundHostUtils(threadRepository);
                
                // 将 host_utils 附加到 task
                task.host_utils = backgroundHostUtils;

                // 创建一个 ThreadProcessor 实例来处理任务
                const ThreadProcessor = require('./threadProcessor');
                const processor = new ThreadProcessor(
                    threadRepository,
                    messageHandler,
                    {
                        onBotMessageStart: (message, isStreaming) => {
                            console.log(`[Background] Bot message started: ${message.id}`);
                        },
                        onBotMessageAppend: (messageId, text) => {
                            // 后台执行，不需要 UI 更新
                        },
                        onBotMessageComplete: (message) => {
                            console.log(`[Background] Bot message completed: ${message.id}`);
                        },
                        onAvailableTasksAdded: (messageId, availableTasks) => {
                            console.log(`[Background] Available tasks added: ${availableTasks.length}`);
                        },
                        onUserMessageAdded: (userMessage) => {
                            console.log(`[Background] User message added: ${userMessage.id}`);
                        },
                        onError: (errorMessage, error) => {
                            console.error(`[Background] Error:`, error);
                            vscode.window.showErrorMessage(`Background task failed: ${error.message}`);
                        },
                        onProcessingComplete: (threadId) => {
                            console.log(`[Background] Processing complete for thread: ${threadId}`);
                            vscode.window.showInformationMessage('Background task completed successfully');
                        }
                    }
                );

                // 执行任务
                await processor.handleThread(thread, task);
                
                return { success: true, threadId: thread.id };
            } catch (error) {
                console.error('Background task execution error:', error);
                vscode.window.showErrorMessage(`Background task failed: ${error.message}`);
                return { success: false, error: error.message };
            }
        })
    );

    // 注册设置编辑器
    const settingsEditorProvider = new SettingsEditorProvider(threadRepository, agentLoader);

    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('chat-settings', settingsEditorProvider)
    );

    // 注册打开设置编辑器命令
    context.subscriptions.push(
        vscode.commands.registerCommand(`${finalConfig.commandPrefix}.openSettingsEditor.${finalConfig.chatType}`, async (item) => {
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
                        threadRepository.updateThreadSettings(thread, newSettings);
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

    // 注册从 JSON 创建线程命令
    context.subscriptions.push(
        vscode.commands.registerCommand(`${finalConfig.commandPrefix}.createThreadFromJson.${finalConfig.chatType}`, async (uri) => {
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

                // 处理附件信息
                if (threadData.attachment) {
                    // 如果有单个附件，使用setAttachment方法
                    threadRepository.setAttachment(newThreadId, threadData.attachment);
                } else if (threadData.attachments && Array.isArray(threadData.attachments) && threadData.attachments.length > 0) {
                    // 向后兼容：如果有旧格式的attachments数组，取第一个作为attachment
                    threadRepository.setAttachment(newThreadId, threadData.attachments[0]);
                }

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
                    threadRepository.updateThreadSettings(newThread, threadData.settings);
                }

                // 刷新聊天列表
                listProvider.refresh();

                // 打开新创建的聊天
                vscode.commands.executeCommand(`${finalConfig.commandPrefix}.open${finalConfig.chatType.charAt(0).toUpperCase() + finalConfig.chatType.slice(1)}`, chatName, newThreadId);

                vscode.window.showInformationMessage(`Successfully created thread from JSON: ${chatName}`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create thread from JSON: ${error.message}`);
            }
        })
    );

    return {
        chatProvider,
        listProvider,
        config: finalConfig
    };
}

module.exports = activateChatExtension;