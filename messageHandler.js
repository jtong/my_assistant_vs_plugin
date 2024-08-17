// messageHandler.js

class MessageHandler {
    constructor(threadRepository, agentLoader) {
        this.threadRepository = threadRepository;
        this.agentLoader = agentLoader
    }

    async handleMessage(thread) {

        const agent = this.agentLoader.loadAgent(thread.agent);
        const response = await agent.generateReply(thread);

        return response;
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


    // 如果需要实现流式输出，可以使用这个方法
    // async *createStream(message) {
    //   const words = message.split(' ');
    //   for (const word of words) {
    //     yield word + ' ';
    //     await new Promise(resolve => setTimeout(resolve, 100)); // 模拟延迟
    //   }
    // }
}

module.exports = MessageHandler;