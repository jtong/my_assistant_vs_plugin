// chat/threadProcessor.js
const { Response, Task } = require('ai-agent-response');

/**
 * ThreadProcessor - 处理线程消息和任务执行的核心类
 * 与UI解耦，通过回调函数通知外部
 */
class ThreadProcessor {
    constructor(threadRepository, messageHandler, callbacks = {}) {
        this.threadRepository = threadRepository;
        this.messageHandler = messageHandler;
        this.stopGenerationFlags = new Map();
        
        // 默认的空回调函数
        this.callbacks = {
            onBotMessageStart: callbacks.onBotMessageStart || (() => {}),
            onBotMessageAppend: callbacks.onBotMessageAppend || (() => {}),
            onBotMessageComplete: callbacks.onBotMessageComplete || (() => {}),
            onAvailableTasksAdded: callbacks.onAvailableTasksAdded || (() => {}),
            onError: callbacks.onError || (() => {}),
            onProcessingComplete: callbacks.onProcessingComplete || (() => {}),
            onUserMessageAdded: callbacks.onUserMessageAdded || (() => {})
        };
    }

    /**
     * 处理线程的主入口
     * @param {Object} thread - 线程对象
     * @param {Task} task - 要执行的任务
     */
    async handleThread(thread, task) {
        try {
            if (task.skipBotMessage) {
                // 如果任务设置了跳过机器人消息，使用一个不添加消息的处理器
                const silentResponseHandler = async (response, updatedThread) => {
                    if (response.hasAvailableTasks()) {
                        const botMessage = this.threadRepository.getMessageById(thread.id, task.meta.messageId);
                        this.handleAvailableTasks(botMessage, response.getAvailableTasks());
                    }

                    await this.handleNextTasks(response, updatedThread, task.host_utils, task.meta.messageId);
                };
                await this.messageHandler.handleTask(thread, task, silentResponseHandler);
            } else {
                await this.messageHandler.handleTask(thread, task, async (response, updatedThread) =>
                    await this.handleNormalResponse(response, updatedThread, task.host_utils)
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
            
            // 通知错误
            this.callbacks.onError(errorMessage, error);
        } finally {
            setTimeout(() => {
                this.callbacks.onProcessingComplete(thread.id);
            }, 500);
        }
    }

    /**
     * 处理正常响应
     */
    async handleNormalResponse(response, updatedThread, host_utils) {
        const botMessage = await this.addNewBotMessage(response, updatedThread);

        if (response.hasAvailableTasks()) {
            this.handleAvailableTasks(botMessage, response.getAvailableTasks());
        }

        await this.handleNextTasks(response, updatedThread, host_utils, botMessage.id);
    }

    /**
     * 添加新的机器人消息
     */
    async addNewBotMessage(response, thread) {
        let botMessage = {
            id: 'msg_' + Date.now(),
            sender: 'bot',
            text: response.getFullMessage() || '',
            isHtml: response.isHtml(),
            timestamp: Date.now(),
            threadId: thread.id,
            meta: response.getMeta(),
            isVirtual: response.getMeta()?.isVirtual || false
        };

        this.threadRepository.addMessage(thread, botMessage);

        // 重置停止标志
        this.stopGenerationFlags.delete(thread.id);

        // 通知消息开始
        this.callbacks.onBotMessageStart(botMessage, response.isStream());

        if (response.isStream()) {
            try {
                for await (const chunk of response.getStream()) {
                    // 检查停止标志
                    if (this.stopGenerationFlags.get(thread.id)) {
                        console.log('Stream processing stopped by user');
                        break;
                    }

                    botMessage.text += chunk;
                    // 通知消息追加
                    this.callbacks.onBotMessageAppend(botMessage.id, chunk);
                }
            } catch (streamError) {
                console.error('Error in stream processing:', streamError);
                if (!this.stopGenerationFlags.get(thread.id)) {
                    const errorChunk = ' An error occurred during processing.';
                    botMessage.text += errorChunk;
                    this.callbacks.onBotMessageAppend(botMessage.id, errorChunk);
                }
            } finally {
                // 清理停止标志
                this.stopGenerationFlags.delete(thread.id);
            }
        }

        // 更新最终消息内容
        this.threadRepository.updateMessage(thread, botMessage.id, {
            text: botMessage.text
        });

        // 通知消息完成
        this.callbacks.onBotMessageComplete(botMessage);

        return botMessage;
    }

    /**
     * 处理可用任务
     */
    handleAvailableTasks(message, availableTasks) {
        message.availableTasks = availableTasks;
        
        // 清理任务中的 host_utils（避免序列化问题）
        availableTasks.forEach(availableTask => {
            availableTask.task.host_utils = undefined;
        });
        
        const thread = this.threadRepository.getThread(message.threadId);
        this.threadRepository.updateMessage(thread, message.id, message);

        // 通知UI
        this.callbacks.onAvailableTasksAdded(message.id, availableTasks);
    }

    /**
     * 处理下一个任务
     */
    async handleNextTasks(response, updatedThread, host_utils, messageId) {
        if (response.hasNextTasks()) {
            const nextTasks = response.getNextTasks();
            for (const nextTask of nextTasks) {
                nextTask.host_utils = host_utils;
                nextTask.meta = { ...nextTask.meta, messageId: messageId };
                await this.handleThread(updatedThread, nextTask);
            }
        }
    }

    /**
     * 执行任务（包括处理 skipUserMessage 逻辑）
     * @param {Object} thread - 线程对象
     * @param {Task} task - 任务对象
     */
    async executeTask(thread, task) {
        if (!task.skipUserMessage) {
            const updatedThread = this.messageHandler.addUserMessageToThread(thread, task.message);
            const userMessage = updatedThread.messages[updatedThread.messages.length - 1];
            
            // 通知 UI 添加用户消息
            this.callbacks.onUserMessageAdded(userMessage);
            
            // 更新 thread 引用
            thread = updatedThread;
        }
        
        if (task) {
            await this.handleThread(thread, task);
        }
    }

    /**
     * 停止生成
     */
    stopGeneration(threadId) {
        this.stopGenerationFlags.set(threadId, true);
        console.log(`Generation stopped for thread: ${threadId}`);
    }
}

module.exports = ThreadProcessor;