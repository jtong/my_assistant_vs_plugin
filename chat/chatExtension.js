// chat/chatExtension.js
const vscode = require('vscode');
const path = require('path');
const ChatViewProvider = require('./chatViewProvider');
const ListViewProvider = require('./ListViewProvider');
const ChatMessageHandler = require('./chatMessageHandler');
const ChatThreadRepository = require('./chatThreadRepository');
const { Task } = require('ai-agent-response');
const MetaEditorProvider = require('./metaEditorProvider');

// Object to store open chat panels
const openChatPanels = {};
function activateChatExtension(context, agentLoader) {
    const projectRoot = context.workspaceState.get('projectRoot');
    const threadRepository = new ChatThreadRepository(path.join(projectRoot, 'ai_helper/agent/memory_repo/chat_threads'));

    const messageHandler = new ChatMessageHandler(threadRepository, agentLoader);
    const chatProvider = new ChatViewProvider(context.extensionUri, threadRepository);
    const listProvider = new ListViewProvider(threadRepository);


    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('chatList', listProvider),
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
                    const agent = agentLoader.loadAgent(agentName);
                    const agentMeta = agent.metadata || {};
                    threadRepository.createThread(newThreadId, chatName, agentName);
                    threadRepository.updateThreadMeta(newThreadId, agentMeta);
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
                    convertToWebviewUri(absolutePath) {
                        const uri = vscode.Uri.file(absolutePath);
                        return panel.webview.asWebviewUri(uri).toString();
                    },
                    threadRepository
                };
                panel.webview.onDidReceiveMessage(async message => {
                    let thread = chatProvider.getThread(message.threadId);
                    switch (message.type) {
                        case 'getMessages':
                            const postedMessages = { type: 'loadThread', thread }
                            panel.webview.postMessage(postedMessages);
                            break;
                        case 'sendMessage':
                            const updatedThread = messageHandler.addUserMessageToThread(thread, message.message)
                            const userMessage = updatedThread.messages[updatedThread.messages.length - 1];
                            panel.webview.postMessage({
                                type: 'addUserMessage',
                                message: userMessage
                            });
                            const messageTask = buildMessageTask(userMessage.text, updatedThread, host_utils);
                            await handleThread(messageHandler, updatedThread, messageTask, threadRepository, panel);
                            break;
                        case 'retryMessage':
                            const removedMessages = threadRepository.removeMessagesAfterLastUser(message.threadId);
                            if (removedMessages.length > 0) {
                                panel.webview.postMessage({
                                    type: 'removeMessagesAfterLastUser',
                                    removedCount: removedMessages.length
                                });
                            }
                            thread = chatProvider.getThread(message.threadId); // 重新获取更新后的线程
                            const lastUserMessage = thread.messages[thread.messages.length - 1].text;
                            const retryTask = buildMessageTask(lastUserMessage, thread, host_utils);
                            await handleThread(messageHandler, thread, retryTask, threadRepository, panel);
                            break;
                        case 'executeTask':
                            const taskName = message.taskName;
                            const agent = agentLoader.loadAgent(thread.agent);
                            const task = agent.getTask(taskName);
                            task.host_utils = host_utils;
                            if (task) {
                                await handleThread(messageHandler, thread, task, threadRepository, panel);
                            }
                            break;
                        case 'editMessage':
                            threadRepository.updateMessage(message.threadId, message.messageId, { text: message.newText });
                            break;
                    }
                });

                openChatPanels[chatName] = panel;

                panel.onDidDispose(() => {
                    delete openChatPanels[chatName];
                });
            }
        })
    );

    const metaEditorProvider = new MetaEditorProvider(threadRepository, agentLoader);

    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('chat-meta', metaEditorProvider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.openMetaEditor', async (item) => {
            const uri = vscode.Uri.parse(`chat-meta:/${item.id}`);
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc, { preview: false });

            // 设置文档的语言模式为YAML
            await vscode.languages.setTextDocumentLanguage(doc, 'yaml');


            // 设置文档变更监听器
            const changeDisposable = vscode.workspace.onDidChangeTextDocument(async (e) => {
                if (e.document.uri.toString() === uri.toString()) {
                    await metaEditorProvider.saveDocument(e.document);
                }
            });

            // 当编辑器关闭时，移除监听器
            const closeDisposable = vscode.window.onDidChangeActiveTextEditor(async (e) => {
                if (!e || e.document.uri.toString() !== uri.toString()) {
                    // 保存文档
                    await metaEditorProvider.saveDocument(doc);

                    changeDisposable.dispose();
                    closeDisposable.dispose();
                }
            });
            context.subscriptions.push(changeDisposable, closeDisposable);

        })
    );

    return {
        chatProvider,
        listProvider
    };
}



function buildMessageTask(message, thread, host_utils) {
    return new Task({
        name: 'Process Message',
        type: Task.TYPE_MESSAGE,
        message: message,
        meta: {
            threadId: thread.id,
            timestamp: Date.now()
        },
        host_utils: host_utils
    });
}

async function handleThread(messageHandler, updatedThread, task, threadRepository, panel) {
    const responseHandler = async (response, thread) => {
        if (response.hasAvailableTasks()) {
            const availableTasks = response.getAvailableTasks();
            // 发送可用任务列表到 webview 以更新任务按钮
            panel.webview.postMessage({
                type: 'updateAvailableTasks',
                tasks: availableTasks.map(task => ({ name: task.getName() }))
            });
        }
        if (response.isStream()) {
            // 处理流式响应
            const botMessage = {
                id: 'bot_' + Date.now(),
                sender: 'bot',
                text: '',
                isHtml: response.isHtml(),
                timestamp: Date.now(),
                threadId: thread.id,
                formSubmitted: false
            };
            threadRepository.addMessage(thread.id, botMessage);
            panel.webview.postMessage({
                type: 'addBotMessage',
                message: botMessage
            });

            try {
                for await (const chunk of response.getStream()) {
                    botMessage.text += chunk;
                    panel.webview.postMessage({
                        type: 'updateBotMessage',
                        messageId: botMessage.id,
                        text: chunk
                    });
                }
            } catch (streamError) {
                console.error('Error in stream processing:', streamError);
                botMessage.text += ' An error occurred during processing.';
                panel.webview.postMessage({
                    type: 'updateBotMessage',
                    messageId: botMessage.id,
                    text: ' An error occurred during processing.'
                });
            }

            threadRepository.updateMessage(thread.id, botMessage.id, { text: botMessage.text, meta: response.meta });
        } else {
            // 处理非流式响应
            const botMessage = {
                id: 'bot_' + Date.now(),
                sender: 'bot',
                text: response.getFullMessage(),
                isHtml: response.isHtml(),
                timestamp: Date.now(),
                threadId: thread.id,
                formSubmitted: false,
                meta: response.meta
            };
            threadRepository.addMessage(thread.id, botMessage);
            thread.messages.push(botMessage);
            panel.webview.postMessage({
                type: 'addBotMessage',
                message: botMessage
            });
        }
    };

    try {
        await messageHandler.handleTask(updatedThread, task, responseHandler);
    } catch (error) {
        console.error('Error in handleThread:', error);
        const errorMessage = {
            id: 'error_' + Date.now(),
            sender: 'bot',
            text: 'An unexpected error occurred while processing your task.',
            isHtml: false,
            timestamp: Date.now(),
            threadId: updatedThread.id,
            formSubmitted: false
        };
        threadRepository.addMessage(updatedThread.id, errorMessage);
        panel.webview.postMessage({
            type: 'addBotMessage',
            message: errorMessage
        });
    } finally {
        panel.webview.postMessage({
            type: 'botResponseComplete'
        });
    }
}
module.exports = activateChatExtension;