// chat/chatThreadRepository.js
const fs = require('fs');
const path = require('path');

class ChatThreadRepository {
    constructor(storagePath) {
        this.storagePath = storagePath;
        this.indexPath = path.join(this.storagePath, 'threads.json');
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }
        if (!fs.existsSync(this.indexPath)) {
            this.saveIndex({});
        }
    }

    getThreadFilePath(threadId) {
        return path.join(this.storagePath, threadId, 'thread.json');
    }


    loadIndex() {
        return JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
    }

    saveIndex(index) {
        fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
    }

    loadThread(threadId) {
        const filePath = this.getThreadFilePath(threadId);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        return null;
    }

    saveThread(thread) {
        const threadFolder = path.join(this.storagePath, thread.id);
        if (!fs.existsSync(threadFolder)) {
            fs.mkdirSync(threadFolder, { recursive: true });
        }
        const filePath = this.getThreadFilePath(thread.id);
        fs.writeFileSync(filePath, JSON.stringify(thread, null, 2));

        // Update index
        const index = this.loadIndex();
        index[thread.id] = { id:thread.id, name: thread.name, agent: thread.agent };
        this.saveIndex(index);
    }

    createThread(threadId, name, agentName) {
        const newThread = {
            id: threadId,
            name: name,
            agent: agentName,
            messages: []
        };
        this.saveThread(newThread);
        return newThread;
    }

    getThread(threadId) {
        return this.loadThread(threadId);
    }

    getThreadMessages(threadId) {
        const thread = this.loadThread(threadId);
        return thread ? thread.messages : [];
    }

    addMessage(threadId, message) {
        let thread = this.loadThread(threadId);
        if (!thread) {
            thread = {
                id: threadId,
                agent: 'botAgent', // 默认代理
                messages: []
            };
        }
        thread.messages.push(message);
        this.saveThread(thread);
    }

    updateMessage(threadId, messageId, updates) {
        const thread = this.loadThread(threadId);
        if (thread) {
            const messageIndex = thread.messages.findIndex(m => m.id === messageId);
            if (messageIndex !== -1) {
                thread.messages[messageIndex] = { ...thread.messages[messageIndex], ...updates };
                this.saveThread(thread);
            }
        }
    }

    getAllThreadsInfo() {
        return this.loadIndex();
    }

    deleteThread(threadId) {
        const threadFolder = path.join(this.storagePath, threadId);
        if (fs.existsSync(threadFolder)) {
            fs.rmdirSync(threadFolder, { recursive: true });
        }

        // Update index
        const index = this.loadIndex();
        delete index[threadId];
        this.saveIndex(index);
    }

    removeLastBotMessage(threadId) {
        const thread = this.loadThread(threadId);
        if (thread && thread.messages.length > 0) {
            const lastMessage = thread.messages[thread.messages.length - 1];
            if (lastMessage.sender === 'bot') {
                thread.messages.pop();
                this.saveThread(thread);
                return true;
            }
        }
        return false;
    }

    removeMessagesAfterLastUser(threadId) {
        const thread = this.getThread(threadId);
        if (!thread) return [];
    
        const lastUserIndex = thread.messages.findLastIndex(msg => msg.sender === 'user');
        if (lastUserIndex === -1) return [];
    
        const removedMessages = thread.messages.splice(lastUserIndex + 1);
        this.saveThread(thread);
        return removedMessages;
    }
}

module.exports = ChatThreadRepository;