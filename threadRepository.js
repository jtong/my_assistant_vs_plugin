// threadRepository.js
class ThreadRepository {
    constructor(agentLoader) {
      this.agentLoader = agentLoader;
      this.threads = {
        'thread_1': {
          id: 'thread_1',
          agent: 'testAgent',
          messages: [
            {
              id: 'msg_1',
              sender: 'user',
              text: '你好',
              timestamp: 1615000000000,
              formSubmitted: false,
              threadId: 'thread_1'
            },
            {
              id: 'msg_2',
              sender: 'bot',
              text: '回复: 你好！有什么可以帮到你的？',
              isHtml: false,
              timestamp: 1615000020000,
              threadId: 'thread_1'
            },
            // ... 其他消息
          ]
        },
        'thread_2': {
            id: 'thread_2',
            agent: 'testAgent',
            messages: [
              {
                id: 'msg_1',
                sender: 'user',
                text: '你好',
                timestamp: 1615000000000,
                formSubmitted: false,
                threadId: 'thread_2'
              },
              {
                id: 'msg_2',
                sender: 'bot',
                text: '回复: 你好！有什么可以帮到你的？',
                isHtml: false,
                timestamp: 1615000020000,
                threadId: 'thread_2'
              },
              // ... 其他消息
            ]
          }
        // 可以添加更多线程
      };
    }

    createThread(threadId, agentName = 'testAgent') {
        this.threads[threadId] = {
          id: threadId,
          agent: agentName,
          messages: []
        };
        return this.threads[threadId];
    }
  
    getThread(threadId) {
      return this.threads[threadId];
    }
  
    getThreadMessages(threadId) {
      const thread = this.threads[threadId];
      return thread ? thread.messages : [];
    }
  
    addMessage(threadId, message) {
      if (!this.threads[threadId]) {
        this.threads[threadId] = {
          id: threadId,
          agent: 'botAgent', // 默认代理
          messages: []
        };
      }
      this.threads[threadId].messages.push(message);
    }
  
    updateMessage(threadId, messageId, updates) {
      const thread = this.threads[threadId];
      if (thread) {
        const messageIndex = thread.messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
          thread.messages[messageIndex] = { ...thread.messages[messageIndex], ...updates };
        }
      }
    }
  }
  
  module.exports = ThreadRepository;