// messageHandler.js

class MessageHandler {
    constructor(threadRepository, agentLoader) {
        this.threadRepository = threadRepository;
        this.agentLoader = agentLoader
    }

    async handleMessage(thread, responseHandler) {
        const agent = this.agentLoader.loadAgent(thread.agent);
        const initialResponse = await agent.generateReply(thread);

        if (initialResponse.isPlanResponse()) {
            const taskList = initialResponse.getTaskList();

            for (const task of taskList) {
                const taskResponse = await agent.executeTask(task, thread);
                // 对每个任务响应异步执行 responseHandler
                await responseHandler(taskResponse, thread);
            }
        }else{
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