// messageHandler.js
const Response = require('./response');

class MessageHandler {
  constructor(threadRepository) {
    this.threadRepository = threadRepository;
  }

  handleMessage(thread, userMessage) {
    // 将用户消息添加到线程
    const updatedThread = this.addUserMessageToThread(thread, userMessage);
    
    // 这里可以实现实际的消息处理逻辑，比如调用AI模型等
    const botReply = this.generateBotReply(updatedThread);
    
    // 创建响应
    const response = new Response(botReply);
    
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

  generateBotReply(thread) {
    // 获取线程中的最后一条消息（用户的最新输入）
    const lastMessage = thread.messages[thread.messages.length - 1];
    
    // 这里应该实现实际的bot回复逻辑
    // 您可以使用整个thread来生成更有上下文的回复
    return `回复: ${lastMessage.text}`;
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