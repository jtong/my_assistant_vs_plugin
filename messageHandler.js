// messageHandler.js
const { Task } = require('ai-agent-response');
const logger = require("./logger");

class MessageHandler {
    constructor(threadRepository, agentLoader) {
        this.threadRepository = threadRepository;
        this.agentLoader = agentLoader;
    }

    async handleMessage(thread, responseHandler, host_utils) {
        const messageTask = new Task({
            name: 'Process Message',
            type: Task.TYPE_MESSAGE,
            message: thread.messages[thread.messages.length - 1].text,
            meta: {
                threadId: thread.id,
                messageId: thread.messages[thread.messages.length - 1].id
            },
            host_utils: host_utils
        });

        this.handleTask(thread, messageTask, responseHandler);
    }

    async handleTask(thread, task, responseHandler) {
        const agent = this.agentLoader.loadAgent(thread.agent);
        let initialResponse;

        if (task.isMessageTask()) {
            initialResponse = await agent.generateReply(thread, task.message);
        } else {
            initialResponse = await agent.executeTask(task, thread);
        }

        if (initialResponse.isPlanResponse()) {
            const taskList = initialResponse.getTaskList();
            let previousTaskMeta = initialResponse.meta || {};

            for (const taskInfo of taskList) {
                const subTask = new Task({
                    name: taskInfo.name,
                    type: taskInfo.type || Task.TYPE_ACTION,
                    message: taskInfo.message,
                    meta: { ...previousTaskMeta, ...taskInfo.meta },
                    host_utils: task.host_utils
                });

                const taskResponse = await this.handleTask(thread, subTask, responseHandler);
                previousTaskMeta = taskResponse.meta || {};
            }
        } else {
            await responseHandler(initialResponse, thread);
        }

    }

    addUserMessageToThread(thread, userMessage) {
        const newMessage = {
            id: 'msg_' + Date.now(),
            sender: 'user',
            text: userMessage,
            timestamp: Date.now(),
            threadId: thread.id,
            formSubmitted: false
        };
        this.threadRepository.addMessage(thread.id, newMessage);
        return this.threadRepository.getThread(thread.id);
    }
}

module.exports = MessageHandler;