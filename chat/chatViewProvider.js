// chatViewProvider.js
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { Response, Task, AvailableTask } = require('ai-agent-response');
const companionPluginRegistry = require('../companionPluginRegistry');
const ThreadProcessor = require('./threadProcessor');

class ChatViewProvider {
    constructor(extensionUri, threadRepository, messageHandler) {
        this._extensionUri = extensionUri;
        this.threadRepository = threadRepository;
        this.messageHandler = messageHandler;
        
        // 为每个 panel 创建独立的 ThreadProcessor，在 resolveWebviewPanel 中初始化
        this.threadProcessors = new Map();
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

        // 获取伴生插件的资源
        const companionScripts = companionPluginRegistry.generateScriptTags(webview);
        const companionStyles = companionPluginRegistry.generateStyleTags(webview);

        htmlContent = htmlContent.replace('${markdownPreviewScriptUri}', markdownPreviewScriptUri);
        htmlContent = htmlContent.replace('${markdownPreviewStyleUri}', markdownPreviewStyleUri);
        htmlContent = htmlContent.replace('${scriptUri}', scriptUri);
        htmlContent = htmlContent.replace('${styleUri}', styleUri);
        htmlContent = htmlContent.replace('${markdownItUri}', markdownItUri);
        htmlContent = htmlContent.replace('${highlightJsUri}', highlightJsUri);
        htmlContent = htmlContent.replace('${highlightCssUri}', highlightCssUri);
        htmlContent = htmlContent.replace('${threadId}', threadId || '');
        htmlContent = htmlContent.replace('${companionScripts}', companionScripts);
        htmlContent = htmlContent.replace('${companionStyles}', companionStyles);

        htmlContent = htmlContent.replace('${previewClass}', enablePreview ? 'with-preview' : 'no-preview');
        htmlContent = htmlContent.replace('${previewDisplay}', enablePreview ? '' : 'display:none');
        htmlContent = htmlContent.replace('${enablePreview}', enablePreview);

        return htmlContent;
    }

    resolveWebviewPanel(panel, host_utils) {
        // 创建 ThreadProcessor 并配置 UI 回调
        const processor = new ThreadProcessor(
            this.threadRepository, 
            this.messageHandler,
            {
                onBotMessageStart: (message, isStreaming) => {
                    panel.webview.postMessage({
                        type: 'addBotMessage',
                        message: message,
                        isStreaming: isStreaming
                    });
                },
                onBotMessageAppend: (messageId, text) => {
                    panel.webview.postMessage({
                        type: 'appendBotMessage',
                        messageId: messageId,
                        text: text
                    });
                },
                onBotMessageComplete: (message) => {
                    // 消息完成时不需要额外的UI通知，由 onProcessingComplete 统一处理
                },
                onAvailableTasksAdded: (messageId, availableTasks) => {
                    panel.webview.postMessage({
                        type: 'addAvailableTasks',
                        messageId: messageId,
                        availableTasks: availableTasks
                    });
                },
                onUserMessageAdded: (userMessage) => {
                    panel.webview.postMessage({
                        type: 'addUserMessage',
                        message: userMessage
                    });
                },
                onError: (errorMessage, error) => {
                    panel.webview.postMessage({
                        type: 'addBotMessage',
                        message: errorMessage
                    });
                },
                onProcessingComplete: (threadId) => {
                    panel.webview.postMessage({
                        type: 'botResponseComplete'
                    });
                }
            }
        );

        // 存储 processor，用于后续调用
        const panelId = panel.webview.html; // 使用一个唯一标识
        this.threadProcessors.set(panel, processor);

        // 清理
        panel.onDidDispose(() => {
            this.threadProcessors.delete(panel);
        });

        panel.webview.onDidReceiveMessage(async (message) => {
            const threadId = message.threadId;

            // 优先检查是否是伴生插件消息
            const handled = companionPluginRegistry.handleWebviewMessage(message, panel);
            if (handled) {
                return;
            }

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
                    await this.handleSendMessage(message, threadId, panel, host_utils, processor);
                    break;
                case 'retryMessage':
                    await this.handleRetryMessage(threadId, panel, host_utils, processor);
                    break;
                case 'executeTask':
                    await this.handleExecuteTask(message, threadId, panel, host_utils, processor);
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
                    this.handleStopGeneration(threadId, panel, processor);
                    break;
                case 'openImage':
                    this.handleOpenImage(message);
                    break;
            }
        });
    }

    handleOpenImage(message) {
        const { threadId, imagePath } = message;
        const absoluteImagePath = path.join(this.threadRepository.storagePath, threadId, imagePath);
        if (fs.existsSync(absoluteImagePath)) {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(absoluteImagePath));
        } else {
            vscode.window.showErrorMessage('图片不存在或已被删除。');
        }
    }

    handleStopGeneration(threadId, panel, processor) {
        processor.stopGeneration(threadId);
        panel.webview.postMessage({
            type: 'botResponseComplete'
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

    async handleSendMessage(message, threadId, panel, host_utils, processor) {
        let thread = this.threadRepository.getThread(threadId);

        // 处理文件附件
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

        // 处理图片数据
        if (message.imageData) {
            const threadFolder = path.join(this.threadRepository.storagePath, thread.id);
            if (!fs.existsSync(threadFolder)) {
                fs.mkdirSync(threadFolder, { recursive: true });
            }

            const timestamp = Date.now();
            const imageName = `image_${timestamp}_${message.imageData.name}`;
            const imagePath = path.join(threadFolder, imageName);

            const imageDataParts = message.imageData.data.split(',');
            const imageBuffer = Buffer.from(imageDataParts[1], 'base64');
            fs.writeFileSync(imagePath, imageBuffer);

            message.imagePath = imageName;
            message.imageUri = host_utils.getImageUri(thread.id, imageName);
            delete message.imageData;
        }

        const updatedThread = this.messageHandler.addUserMessageToThread(thread, message.message, message.filePath, message.imagePath, message.imageUri);
        const userMessage = updatedThread.messages[updatedThread.messages.length - 1];

        panel.webview.postMessage({
            type: 'addUserMessage',
            message: userMessage
        });

        const messageTask = this.buildMessageTask(userMessage.text, updatedThread, host_utils);
        await processor.handleThread(updatedThread, messageTask);
    }

    async handleRetryMessage(threadId, panel, host_utils, processor) {
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
        retryTask.meta._ui_action = "retry";

        await processor.handleThread(thread, retryTask);
    }

    async handleExecuteTask(message, threadId, panel, host_utils, processor) {
        const task = message.task;
        task.host_utils = host_utils;
        
        const thread = this.threadRepository.getThread(threadId);
        
        // 使用 processor 的 executeTask 方法
        await processor.executeTask(thread, task);
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

    /**
     * 为没有 panel 的场景提供的便捷方法
     * 处理正常响应（透传给 processor）
     */
    async handleNormalResponse(response, thread, panel, host_utils) {
        const processor = this.threadProcessors.get(panel);
        if (processor) {
            await processor.handleNormalResponse(response, thread, host_utils);
        } else {
            console.warn('No processor found for panel');
        }
    }

    /**
     * 为没有 panel 的场景提供的便捷方法
     * 处理线程（透传给 processor）
     */
    async handleThread(thread, task, panel) {
        const processor = this.threadProcessors.get(panel);
        if (processor) {
            await processor.handleThread(thread, task);
        } else {
            console.warn('No processor found for panel');
        }
    }
}

module.exports = ChatViewProvider;