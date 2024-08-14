// messageHandler.js
const Response = require('./response');

class MessageHandler {
  constructor(threadRepository, agentLoader) {
    this.threadRepository = threadRepository;
    this.agentLoader = agentLoader
  }

  handleMessage(thread, userMessage) {
    // 将用户消息添加到线程
    const updatedThread = this.addUserMessageToThread(thread, userMessage);
    
    // 这里可以实现实际的消息处理逻辑，比如调用AI模型等
    const agent = this.agentLoader.loadAgent(thread.agent);
    const response =  agent.generateReply(updatedThread);
    // 创建响应
    
    // 如果需要流式输出，可以设置流
    // response.setStream(this.createStream(botReply));
    
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