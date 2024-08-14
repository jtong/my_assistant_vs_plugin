// threadRepository.js
class ThreadRepository {
    constructor(agentLoader) {
      this.agentLoader = agentLoader;
      this.threads = {
        'thread_1': {
          id: 'thread_1',
          name: 'thread 1',
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
            name: 'thread 2',
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

    createThread(threadId, name, agentName) {
        this.threads[threadId] = {
          id: threadId,
          name: name,
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

    getAllThreads() {
        return Object.values(this.threads);
      }
  }
  
  module.exports = ThreadRepository;