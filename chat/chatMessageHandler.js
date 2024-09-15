// chat/chatMessageHandler.js
const { Task } = require('ai-agent-response');

class ChatMessageHandler {
    constructor(threadRepository, agentLoader) {
        this.threadRepository = threadRepository;
        this.agentLoader = agentLoader;
    }

    async handleTask(thread, task, responseHandler) {
        const agent = this.agentLoader.loadAgent(thread.agent);
        let response;

        if (task.isMessageTask()) {
            response = await agent.generateReply(thread, task.message);
        } else {
            response = await agent.executeTask(task, thread);
        }

        if (response.isPlanResponse()) {
            const taskList = response.getTaskList();
            let previousTaskMeta = response.meta || {};

            for (const taskInfo of taskList) {
                const subTask = new Task({
                    name: taskInfo.name,
                    type: taskInfo.type || Task.TYPE_ACTION,
                    message: taskInfo.message,
                    meta: { ...previousTaskMeta, ...taskInfo.meta },
                    host_utils: task.host_utils
                });

                await this.handleTask(thread, subTask, responseHandler);
                previousTaskMeta = subTask.meta || {};
            }
        } else {
            await responseHandler(response, thread);
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

module.exports = ChatMessageHandler;