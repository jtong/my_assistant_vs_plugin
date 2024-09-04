// messageHandler.js

const logger = require("./logger");


class MessageHandler {
    constructor(threadRepository, agentLoader) {
        this.threadRepository = threadRepository;
        this.agentLoader = agentLoader
    }

    async handleMessage(thread, responseHandler, host_utils) {
        const agent = this.agentLoader.loadAgent(thread.agent);
        const initialResponse = await agent.generateReply(thread, host_utils);

        if (initialResponse.isPlanResponse()) {
            const taskList = initialResponse.getTaskList();
            let previousTaskMeta = initialResponse.meta || {};  // 使用初始响应的 meta 或空对象
            for (const task of taskList) {
                // 如果任务没有 meta，则初始化为空对象
                task.meta = task.meta || {};
                task.meta = { ...previousTaskMeta, ...task.meta };
                task.host_utils = host_utils;
                const taskResponse = await agent.executeTask(task, thread);

                // 对每个任务响应异步执行 responseHandler
                await responseHandler(taskResponse, thread);

                // 保存当前任务的 response meta 为下一个任务的 previousTaskMeta
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