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
        this.stopGenerationFlags = new Map(); // 添加停止标志Map，跟踪每个线程的停止状态
    }

    getWebviewContent(webview, threadId) {
        const htmlPath = path.join(this._extensionUri.fsPath, 'chat', 'webview', 'chat-view.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

        // 获取线程对应的agent配置
        const thread = this.threadRepository.getThread(threadId);
        const agentName = thread ? thread.agent : null;

        // 确定是否启用预览(默认不启用)
        let enablePreview = false;

        if (agentName) {
            try {
                const agentConfig = this.messageHandler.agentLoader.getAgentConfig(agentName);
                enablePreview = agentConfig?.metadata?.enablePreview === true;
            } catch (error) {
                console.error('Error getting agent config:', error);
            }
        }

        const markdownPreviewScriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'webview', 'markdown-preview-script.js')));
        const markdownPreviewStyleUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'webview', 'markdown-preivew-style.css')));

        const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'webview', 'script.js')));
        const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'webview', 'style.css')));

        const markdownItUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'webview', 'lib', 'markdown-it.min.js')));
        const highlightJsUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'webview', 'lib', 'highlight.min.js')));
        const highlightCssUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'webview', 'lib', 'highlight.default.min.css')));

        htmlContent = htmlContent.replace('${markdownPreviewScriptUri}', markdownPreviewScriptUri);
        htmlContent = htmlContent.replace('${markdownPreviewStyleUri}', markdownPreviewStyleUri);
        htmlContent = htmlContent.replace('${scriptUri}', scriptUri);
        htmlContent = htmlContent.replace('${styleUri}', styleUri);
        htmlContent = htmlContent.replace('${markdownItUri}', markdownItUri);
        htmlContent = htmlContent.replace('${highlightJsUri}', highlightJsUri);
        htmlContent = htmlContent.replace('${highlightCssUri}', highlightCssUri);
        htmlContent = htmlContent.replace('${threadId}', threadId || '');

        htmlContent = htmlContent.replace('${previewClass}', enablePreview ? 'with-preview' : 'no-preview');
        htmlContent = htmlContent.replace('${previewDisplay}', enablePreview ? '' : 'display:none');
        htmlContent = htmlContent.replace('${enablePreview}', enablePreview);

        return htmlContent;
    }

    resolveWebviewPanel(panel, host_utils) {

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
                case 'stopGeneration':
                    this.handleStopGeneration(threadId, panel);
                    break;
            }
        });
    }

    handleStopGeneration(threadId, panel) {
        this.stopGenerationFlags.set(threadId, true);
        panel.webview.postMessage({
            type: 'botResponseComplete'
        });
        console.log(`Generation stopped for thread: ${threadId}`);
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
        
        // 添加重试标记到任务的 meta 中
        retryTask.meta._ui_action = "retry";
        
        await this.handleThread(thread, retryTask, panel);
    }

    async handleExecuteTask(message, threadId, panel, host_utils) {
        const task = message.task;

        let thread = this.threadRepository.getThread(threadId);

        if (!task.skipUserMessage) {
            const updatedThread = this.messageHandler.addUserMessageToThread(thread, task.message);
            const userMessage = updatedThread.messages[updatedThread.messages.length - 1];
            panel.webview.postMessage({
                type: 'addUserMessage',
                message: userMessage
            });
        }
        task.host_utils = host_utils;
        if (task) {
            await this.handleThread(thread, task, panel);
        }
    }

    handleUpdateSetting(message, threadId) {
        const { settingKey, value } = message;
        const thread = this.threadRepository.loadThread(threadId);
        let currentSettings = thread.settings || {};
        if (Object.keys(currentSettings).length === 0) {
            const agentConfig = this.messageHandler.agentLoader.getAgentConfig(this.threadRepository.getThread(threadId).agent);
            currentSettings = { ...agentConfig.settings };
        }
        currentSettings[settingKey] = value;
        this.threadRepository.updateThreadSettings(thread, currentSettings);
    }

    handleDeleteMessages(message, threadId, panel) {
        const deletedIds = this.threadRepository.deleteMessages(threadId, message.messageIds);
        panel.webview.postMessage({
            type: 'messagesDeleted',
            messageIds: deletedIds
        });
    }

    handleOpenAttachedFile(message) {
        const { threadId, filePath } = message;
        const absoluteFilePath = path.join(this.threadRepository.storagePath, threadId, filePath);
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
        availableTasks.forEach(availableTask => {
            availableTask.task.host_utils = undefined;
        })
        const thread = this.threadRepository.getThread(message.threadId);
        this.threadRepository.updateMessage(thread, message.id, message);
        
        // 使用独立的 addAvailableTasks 消息
        panel.webview.postMessage({
            type: 'addAvailableTasks',
            messageId: message.id,
            availableTasks: availableTasks
        });
    }

    async handleNormalResponse(response, updatedThread, panel, host_utils) {
        const botMessage = await this.addNewBotMessage(response, updatedThread, panel);

        if (response.hasAvailableTasks()) {
            // 使用新的独立方法
            this.addAvailableTasks(botMessage, response.getAvailableTasks(), panel);
        }

        await this.handleNextTasks(response, updatedThread, panel, host_utils, botMessage.id);

    }

    async handleNextTasks(response, updatedThread, panel, host_utils, messageId) {
        if (response.hasNextTasks()) {
            const nextTasks = response.getNextTasks();
            for (const nextTask of nextTasks) {
                nextTask.host_utils = host_utils;
                nextTask.meta = { ...nextTask.meta, messageId: messageId };
                await this.handleThread(updatedThread, nextTask, panel);
            }
        }
    }

    async handleThread(thread, task, panel) {
        try {
            if (task.skipBotMessage) {
                // 如果任务设置了跳过机器人消息，使用一个不添加消息的处理器
                const silentResponseHandler = async (response, updatedThread) => {

                    if (response.hasAvailableTasks()) {
                        const botMessage = task.host_utils.threadRepository.getMessageById(thread.id, task.meta.messageId);
                        this.addAvailableTasks(botMessage, response.getAvailableTasks(), panel);
                    }

                    await this.handleNextTasks(response, updatedThread, panel, task.host_utils, task.meta.messageId);
                };
                await this.messageHandler.handleTask(thread, task, silentResponseHandler);
            } else {
                await this.messageHandler.handleTask(thread, task, async (response, updatedThread) =>
                    await this.handleNormalResponse(response, updatedThread, panel, task.host_utils)
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
            setTimeout(() => {
                panel.webview.postMessage({
                    type: 'botResponseComplete'
                });
            }, 500);
        }
    }

    async addNewBotMessage(response, thread, panel) {
        let botMessage = {
            id: 'msg_' + Date.now(),
            sender: 'bot',
            text: '',
            isHtml: response.isHtml(),
            timestamp: Date.now(),
            threadId: thread.id,
            meta: response.getMeta(),
            isVirtual: response.getMeta()?.isVirtual || false
        };

        this.threadRepository.addMessage(thread, botMessage);

        // 重置停止标志
        this.stopGenerationFlags.delete(thread.id);

        if (response.isStream()) {
            panel.webview.postMessage({
                type: 'addBotMessage',
                message: botMessage
            });

            try {
                for await (const chunk of response.getStream()) {
                    // 检查停止标志，如果设置了就停止处理
                    if (this.stopGenerationFlags.get(thread.id)) {
                        console.log('Stream processing stopped by user');
                        break;
                    }

                    botMessage.text += chunk;
                    // 使用 appendBotMessage 而不是 updateBotMessage
                    panel.webview.postMessage({
                        type: 'appendBotMessage',
                        messageId: botMessage.id,
                        text: chunk
                    });
                }
            } catch (streamError) {
                console.error('Error in stream processing:', streamError);
                if (!this.stopGenerationFlags.get(thread.id)) {
                    botMessage.text += ' An error occurred during processing.';
                    // 使用 appendBotMessage
                    panel.webview.postMessage({
                        type: 'appendBotMessage',
                        messageId: botMessage.id,
                        text: ' An error occurred during processing.'
                    });
                }
            } finally {
                // 清理停止标志
                this.stopGenerationFlags.delete(thread.id);
            }
        } else {
            botMessage.text = response.getFullMessage();
            panel.webview.postMessage({
                type: 'addBotMessage',
                message: botMessage
            });
        }

        this.threadRepository.updateMessage(thread, botMessage.id, {
            text: botMessage.text
        });

        return botMessage;
    }

}

module.exports = ChatViewProvider;