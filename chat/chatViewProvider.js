// chatViewProvider.js
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { Response, Task, AvailableTask } = require('ai-agent-response');

class ChatViewProvider {
    constructor(extensionUri, threadRepository, messageHandler) {
        this._extensionUri = extensionUri;
        this.threadRepository = threadRepository;
        this.messageHandler = messageHandler;
    }

    getWebviewContent(webview, threadId) {
        const htmlPath = path.join(this._extensionUri.fsPath, 'chat', 'webview', 'chat-view.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

        const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'webview', 'script.js')));
        const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'webview', 'style.css')));

        const markdownItUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'webview', 'lib', 'markdown-it.min.js')));
        const highlightJsUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'webview', 'lib', 'highlight.min.js')));
        const highlightCssUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'webview', 'lib', 'highlight.default.min.css')));

        htmlContent = htmlContent.replace('${scriptUri}', scriptUri);
        htmlContent = htmlContent.replace('${styleUri}', styleUri);
        htmlContent = htmlContent.replace('${markdownItUri}', markdownItUri);
        htmlContent = htmlContent.replace('${highlightJsUri}', highlightJsUri);
        htmlContent = htmlContent.replace('${highlightCssUri}', highlightCssUri);
        htmlContent = htmlContent.replace('${threadId}', threadId);

        return htmlContent;
    }

    resolveWebviewPanel(panel) {
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
            threadRepository: this.threadRepository,
            postMessage: (message) => {
                panel.webview.postMessage(message);
            }
        };

        panel.webview.onDidReceiveMessage(async (message) => {
            const threadId = message.threadId;

            switch (message.type) {
                case 'getMessages':
                    const thread = this.threadRepository.getThread(threadId);
                    panel.webview.postMessage({
                        type: 'loadThread',
                        thread: thread
                    });
                    break;
                case 'selectInitialFile':
                    await this.handleSelectInitialFile(threadId, panel);
                    break;
                case 'sendMessage':
                    await this.handleSendMessage(message, threadId, panel, host_utils);
                    break;
                case 'retryMessage':
                    await this.handleRetryMessage(threadId, panel, host_utils);
                    break;
                case 'executeTask':
                    await this.handleExecuteTask(message, threadId, panel, host_utils);
                    break;
                case 'updateMessage':
                    this.threadRepository.updateMessage(this.threadRepository.getThread(threadId), message.messageId, { text: message.newText });
                    break;
                case 'copyToClipboard':
                    vscode.env.clipboard.writeText(message.text);
                    vscode.window.showInformationMessage('Text copied to clipboard');
                    break;
                case 'updateSetting':
                    this.handleUpdateSetting(message, threadId);
                    break;
                case 'deleteMessages':
                    this.handleDeleteMessages(message, threadId, panel);
                    break;
                case 'openAttachedFile':
                    this.handleOpenAttachedFile(message);
                    break;
            }
        });
    }

    async handleSelectInitialFile(threadId, panel) {
        const options = {
            canSelectMany: false,
            openLabel: '选择要添加的初始文件',
            filters: { '所有文件': ['*'] }
        };
        const fileUri = await vscode.window.showOpenDialog(options);
        if (fileUri && fileUri[0]) {
            const selectedFileUri = fileUri[0];
            const fileName = path.basename(selectedFileUri.fsPath);
            panel.webview.postMessage({
                type: 'fileSelected',
                filePath: selectedFileUri.fsPath,
                fileName: fileName
            });
        }
    }

    async handleSendMessage(message, threadId, panel, host_utils) {
        let thread = this.threadRepository.getThread(threadId);
        if (message.filePath) {
            const selectedFileUri = message.filePath;
            const fileName = path.basename(selectedFileUri);
            const threadFolder = path.join(this.threadRepository.storagePath, thread.id);
            if (!fs.existsSync(threadFolder)) {
                fs.mkdirSync(threadFolder, { recursive: true });
            }
            const destPath = path.join(threadFolder, fileName);
            fs.copyFileSync(selectedFileUri, destPath);
            const relativeFilePath = path.relative(this.threadRepository.storagePath, destPath);
            message.filePath = relativeFilePath;
        }

        const updatedThread = this.messageHandler.addUserMessageToThread(thread, message.message, message.filePath);
        const userMessage = updatedThread.messages[updatedThread.messages.length - 1];
        panel.webview.postMessage({
            type: 'addUserMessage',
            message: userMessage
        });
        const messageTask = this.buildMessageTask(userMessage.text, updatedThread, host_utils);
        await this.handleThread(updatedThread, messageTask, panel);
    }

    async handleRetryMessage(threadId, panel, host_utils) {
        const removedMessages = this.threadRepository.removeMessagesAfterLastUser(threadId);
        if (removedMessages.length > 0) {
            panel.webview.postMessage({
                type: 'removeMessagesAfterLastUser',
                removedCount: removedMessages.length
            });
        }
        const thread = this.threadRepository.getThread(threadId);
        const lastUserMessage = thread.messages[thread.messages.length - 1].text;
        const retryTask = this.buildMessageTask(lastUserMessage, thread, host_utils);
        await this.handleThread(thread, retryTask, panel);
    }

    async handleExecuteTask(message, threadId, panel, host_utils) {
        const task = message.task;

        let thread = this.threadRepository.getThread(threadId);

        if (!task.skipUserMessage) {
            this.messageHandler.addUserMessageToThread(thread, task.message);
        }
        task.host_utils = host_utils;
        if (task) {
            await this.handleThread(thread, task, panel);
        }
    }

    handleUpdateSetting(message, threadId) {
        const { settingKey, value } = message;
        let currentSettings = this.threadRepository.getThreadSettings(threadId) || {};
        if (Object.keys(currentSettings).length === 0) {
            const agentConfig = this.messageHandler.agentLoader.getAgentConfig(this.threadRepository.getThread(threadId).agent);
            currentSettings = { ...agentConfig.settings };
        }
        currentSettings[settingKey] = value;
        this.threadRepository.updateThreadSettings(threadId, currentSettings);
        const updatedThread = this.threadRepository.getThread(threadId);
        this.messageHandler.agentLoader.updateAgentForThread(updatedThread);
    }

    handleDeleteMessages(message, threadId, panel) {
        const deletedIds = this.threadRepository.deleteMessages(threadId, message.messageIds);
        panel.webview.postMessage({
            type: 'messagesDeleted',
            messageIds: deletedIds
        });
    }

    handleOpenAttachedFile(message) {
        const { filePath } = message;
        const absoluteFilePath = path.join(this.threadRepository.storagePath, filePath);
        if (fs.existsSync(absoluteFilePath)) {
            vscode.window.showTextDocument(vscode.Uri.file(absoluteFilePath));
        } else {
            vscode.window.showErrorMessage('文件不存在或已被删除。');
        }
    }

    buildMessageTask(message, thread, host_utils) {
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
    addAvailableTasks(message, availableTasks, panel) {
        message.availableTasks = availableTasks;
        this.threadRepository.updateMessage(message.threadId, message.id, message);
        panel.webview.postMessage({
            type: 'updateBotMessage',
            messageId: message.id,
            availableTasks: availableTasks
        });
    }

    async handleResponse(response, updatedThread, panel) {
        let botMessage;
        if (response.shouldUpdateLastMessage()) {
            const lastBotMessageIndex = [...updatedThread.messages].reverse().findIndex(msg => msg.sender === 'bot');
            if (lastBotMessageIndex !== -1) {
                const index = updatedThread.messages.length - 1 - lastBotMessageIndex;
                botMessage = updatedThread.messages[index];

                if (botMessage && response.hasAvailableTasks()) { // 目前更新最后一条就这一种情况：给最后一条加按钮。更新最后一条的成熟逻辑及相关机制暂且不做设计，在作出合理的机制设计之前，这条注释不能删除，以提示后人防止将来改出bug。
                    this.addAvailableTasks(botMessage, response.getAvailableTasks(), panel);
                }
            }
        } else {
            botMessage = await this.addNewBotMessage(response, updatedThread, panel); //目前 addNewBotMessage 中，非流式response有availableTask会被添加，而流式则不会处理，因为流式会走更新最后一条的逻辑，目前不确定非流式的是否存在更新最后一条这种机制之外的机制来添加。
        }


        if (response.hasNextTask()) {
            const nextTask = response.getNextTask();
            await this.handleThread(updatedThread, nextTask, panel);
        }
    }

    async handleThread(thread, task, panel) {
        try {
            if (task.skipBotMessage) {
                // 如果任务设置了跳过机器人消息，使用一个不添加消息的处理器
                const silentResponseHandler = async () => { };
                await this.messageHandler.handleTask(thread, task, silentResponseHandler);
            } else {
                await this.messageHandler.handleTask(thread, task, (response, updatedThread) =>
                    this.handleResponse(response, updatedThread, panel)
                );
            }
        } catch (error) {
            console.error('Error in handleThread:', error);
            const errorMessage = {
                id: 'error_' + Date.now(),
                sender: 'bot',
                text: 'An unexpected error occurred while processing your task.',
                isHtml: false,
                timestamp: Date.now(),
                threadId: thread.id
            };
            this.threadRepository.addMessage(thread, errorMessage);
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

    async addNewBotMessage(response, thread, panel) {
        if (response.isStream()) {
            const botMessage = {
                id: 'msg_' + Date.now(),
                sender: 'bot',
                text: '',
                isHtml: response.isHtml(),
                timestamp: Date.now(),
                threadId: thread.id,
                isVirtual: response.meta?.isVirtual || false

            };
            this.threadRepository.addMessage(thread, botMessage);
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

            this.threadRepository.updateMessage(thread, botMessage.id, {
                text: botMessage.text,
                meta: response.meta,
                availableTasks: response.availableTasks
            });
        } else {
            const botMessage = {
                id: 'msg_' + Date.now(),
                sender: 'bot',
                text: response.getFullMessage(),
                isHtml: response.isHtml(),
                timestamp: Date.now(),
                threadId: thread.id,
                meta: response.meta,
                isVirtual: response.meta?.isVirtual || false

            };
            if (response.hasAvailableTasks()) {
                botMessage.availableTasks = response.getAvailableTasks();
            }
            this.threadRepository.addMessage(thread, botMessage);
            panel.webview.postMessage({
                type: 'addBotMessage',
                message: botMessage
            });
        }
    }
}

module.exports = ChatViewProvider;