// extension.js
const vscode = require('vscode');
const path = require('path');
const ChatViewProvider = require('./chatViewProvider');
const ListViewProvider = require('./listViewProvider');
const MessageHandler = require('./messageHandler');
const ThreadRepository = require('./threadRepository');
const AgentLoader = require('./agentLoader');
const AgentViewProvider = require('./agentViewProvider');
const { Task } = require('ai-agent-response');


// Object to store open chat panels
const openChatPanels = {};

function activate(context) {
    // 获取当前打开的工作区文件夹路径
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const projectRoot = workspaceFolders[0].uri.fsPath;
    const threadsStoragePath = path.join(projectRoot, `ai_helper/agent/memory_repo/threads`);

    const agentLoader = new AgentLoader(path.join(projectRoot, 'ai_helper', 'agent', 'agents.json'));

    const threadRepository = new ThreadRepository(agentLoader, threadsStoragePath);
    const chatProvider = new ChatViewProvider(context.extensionUri, threadRepository);
    const listProvider = new ListViewProvider(threadRepository);
    const messageHandler = new MessageHandler(threadRepository, agentLoader);
    const agentViewProvider = new AgentViewProvider(agentLoader);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('chatList', listProvider),
        vscode.window.registerTreeDataProvider('agentList', agentViewProvider)
    );

    context.subscriptions.push(
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
                    threadRepository.createThread(newThreadId, chatName, agentName);
                    listProvider.refresh();
                    vscode.commands.executeCommand('myAssistant.openChat', chatName, newThreadId);
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
                            await handleThread(messageHandler, updatedThread, message, threadRepository, panel);
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
                            await handleThread(messageHandler, thread, message, threadRepository, panel);
                            break;
                        case 'executeTask':
                            const taskName = message.taskName;
                            const agent = agentLoader.loadAgent(thread.agent);
                            const task = agent.getTask(taskName);
                            if (task) {
                                const taskResponse = await agent.executeTask(task, thread);
                                //await responseHandler(taskResponse, thread, panel); // 该功能未完成
                            }
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
}
// extension.js

async function handleThread(messageHandler, updatedThread, message, threadRepository, panel) {
    const responseHandler = async (response, thread) => {
        if (response.isPlanResponse()) {
            const taskList = response.getTaskList();
            // 发送任务列表到 webview 以更新任务按钮
            panel.webview.postMessage({
                type: 'updateTaskButtons',
                tasks: taskList
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
        const host_utils = {
            convertToWebviewUri(absolutePath) {
                const uri = vscode.Uri.file(absolutePath);
                return panel.webview.asWebviewUri(uri).toString();
            },
            threadRepository
        };
        const messageTask = new Task({
            name: 'Process Message',
            type: Task.TYPE_MESSAGE,
            message: updatedThread.messages[updatedThread.messages.length - 1].text,
            meta: {
                message    
            },
            host_utils: host_utils
        });
        await messageHandler.handleTask(updatedThread, messageTask, responseHandler);
    } catch (error) {
        console.error('Error in handleThread:', error);
        const errorMessage = {
            id: 'error_' + Date.now(),
            sender: 'bot',
            text: 'An unexpected error occurred while processing your message.',
            isHtml: false,
            timestamp: Date.now(),
            threadId: message.threadId,
            formSubmitted: false
        };
        threadRepository.addMessage(message.threadId, errorMessage);
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

function deactivate() { }

module.exports = {
    activate,
    deactivate
};