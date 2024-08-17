// extension.js
const vscode = require('vscode');
const path = require('path');
const ChatViewProvider = require('./chatViewProvider');
const ListViewProvider = require('./listViewProvider');
const MessageHandler = require('./messageHandler');
const ThreadRepository = require('./threadRepository');
const AgentLoader = require('./agentLoader');
const AgentViewProvider = require('./agentViewProvider');


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
    const agentLoader = new AgentLoader(path.join(projectRoot, 'ai_helper', 'agent', 'agents.json'));

    const threadRepository = new ThreadRepository(agentLoader);
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

    let currentlySelectedAgent = null;

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.newChat', async () => {
            const chatName = await vscode.window.showInputBox({
                prompt: "Enter a name for the new chat"
            });
            if (chatName) {
                const agents = agentLoader.getAgentsList();
                let agentName;

                if (currentlySelectedAgent && agents.some(agent => agent.name === currentlySelectedAgent)) {
                    // If there's a currently selected agent, use it as the default
                    agentName = await vscode.window.showQuickPick(
                        agents.map(agent => agent.name),
                        {
                            placeHolder: "Select an agent for this chat",
                            default: currentlySelectedAgent
                        }
                    );
                } else {
                    // If no agent is selected or the selected agent is not in the list, show the regular picker
                    agentName = await vscode.window.showQuickPick(
                        agents.map(agent => agent.name),
                        { placeHolder: "Select an agent for this chat" }
                    );
                }

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
        vscode.commands.registerCommand('myAssistant.selectAgent', (agentName) => {
            // Handle agent selection
            //vscode.window.showInformationMessage(`Selected agent: ${agentName}`);
            // You can add logic here to change the current agent for new chats
            currentlySelectedAgent = agentName;

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
                        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath))]
                    }
                );

                panel.webview.html = chatProvider.getWebviewContent(panel.webview, threadId);

                panel.webview.onDidReceiveMessage(async message => {
                    let thread = chatProvider.getThread(message.threadId);
                    switch (message.type) {
                        case 'getMessages':
                            panel.webview.postMessage({ type: 'loadThread', thread });
                            break;
                        case 'sendMessage':
                            const updatedThread = messageHandler.addUserMessageToThread(thread, message.message)
                            const userMessage = updatedThread.messages[updatedThread.messages.length-1];
                            panel.webview.postMessage({
                                type: 'addUserMessage',
                                message: userMessage
                            });
                            const response = await messageHandler.handleMessage(thread, message.message);

                            // 添加bot回复到线程
                            if (!response.isStream()) {
                                const botMessage = {
                                    id: 'bot_' + Date.now(),
                                    sender: 'bot',
                                    text: response.getFullMessage(),
                                    isHtml: false,
                                    timestamp: Date.now(),
                                    threadId: message.threadId,
                                    formSubmitted: false
                                };
                                threadRepository.addMessage(message.threadId, botMessage);
                                panel.webview.postMessage({
                                    type: 'addBotMessage',
                                    message: botMessage
                                });
                            } else {
                                const botMessage = {
                                    id: 'bot_' + Date.now(),
                                    sender: 'bot',
                                    text: '',
                                    isHtml: false,
                                    timestamp: Date.now(),
                                    threadId: message.threadId,
                                    formSubmitted: false
                                };
                                threadRepository.addMessage(message.threadId, botMessage);
                                panel.webview.postMessage({
                                    type: 'addBotMessage',
                                    message: botMessage
                                });

                                // 流式输出
                                for await (const chunk of response.getStream()) {
                                    botMessage.text += chunk;
                                    panel.webview.postMessage({
                                        type: 'updateBotMessage',
                                        messageId: botMessage.id,
                                        text: chunk
                                    });
                                }
                                // 更新完整的bot回复
                                threadRepository.updateMessage(message.threadId, botMessage.id, { text: botMessage.text });

                                // 刷新webview中的消息
                                // const updatedThread = threadRepository.getThread(message.threadId);
                                // panel.webview.postMessage({ type: 'loadThread', thread: updatedThread });

                                // 如果需要流式输出
                                // for await (const chunk of response.getStream()) {
                                //   panel.webview.postMessage({ type: 'streamResponse', chunk });
                                // }
                                break;
                                // 处理其他类型的消息...
                            }
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

function deactivate() { }

module.exports = {
    activate,
    deactivate
};