// chat/chatThreadRepository.js
const fs = require('fs');
const path = require('path');

class ChatThreadRepository {
    constructor(storagePath, agentLoader) {
        this.storagePath = storagePath;
        this.indexPath = path.join(this.storagePath, 'threads.json');
        this.buildThreadsIfNotExists();
        this.agentLoader = agentLoader;
    }

    getThreadFolderPath(threadId) {
        return path.join(this.storagePath, threadId);
    }
    
    buildThreadsIfNotExists() {
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
        index[thread.id] = { id: thread.id, name: thread.name, agent: thread.agent };
        this.saveIndex(index);
    }

    // 修改 createThread 方法，同时创建 knowledge space 文件夹
    createThread(threadId, name, agentName, initialKnowledgeSpace = null) {
        const agentConfig = this.agentLoader.getAgentConfig(agentName);
        const messages = [];
        
        const newThread = {
            id: threadId,
            name: name,
            agent: agentName,
            messages: messages
        };

        this.saveThread(newThread);

        // 创建 knowledge_space 文件夹和 repo.json
        const knowledgeSpacePath = this.getKnowledgeSpacePath(threadId);
        const dirPath = path.dirname(knowledgeSpacePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // 如果没有提供初始 knowledge space，使用默认内容
        const defaultKnowledgeSpace = {
            knowledge_space: {
                knowledge_items: [
                    { id: 0, content: "", type: "memory" }, // 用于记录记忆
                    { id: 1, content: -1, type: "memory_summary_index" } // 用于记录记忆索引，表示当前的memory是基于第几条之前的message总结的。
                ]
            }
        };

        const knowledgeSpace = initialKnowledgeSpace || defaultKnowledgeSpace;
        this.saveKnowledgeSpace(threadId, knowledgeSpace);

        return newThread;
    }

    getThread(threadId) {
        return this.loadThread(threadId);
    }

    getThreadMessages(threadId) {
        const thread = this.loadThread(threadId);
        return thread ? thread.messages : [];
    }

    addMessage(thread, message) {
        if (!thread) {
            throw new Error('Thread object is required');
        }
        thread.messages.push(message);
        this.saveThread(thread);
    }

    updateMessage(thread, messageId, updates) {
        if (!thread) {
            throw new Error('Thread object is required');
        }
        const messageIndex = thread.messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
            thread.messages[messageIndex] = { ...thread.messages[messageIndex], ...updates };
            this.saveThread(thread);
        }
    }

    getAllThreadsInfo() {
        return this.loadIndex();
    }

    getKnowledgeSpacePath(threadId) {
        return path.join(this.getThreadFolderPath(threadId), 'knowledge_space', 'repo.json');
    }

    // 新增方法：保存 knowledge space 数据
    saveKnowledgeSpace(threadId, knowledgeSpace) {
        const filePath = this.getKnowledgeSpacePath(threadId);
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(knowledgeSpace, null, 2));
    }

    // 新增方法：获取 knowledge space 数据
    getKnowledgeSpace(threadId) {
        const filePath = this.getKnowledgeSpacePath(threadId);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        return null;
    }

    deleteThread(threadId) {
        // not deleting thread folder for now
        // const threadFolder = path.join(this.storagePath, threadId);
        // if (fs.existsSync(threadFolder)) {
        //     fs.rmdirSync(threadFolder, { recursive: true });
        // }

        // only update index for now
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

    renameThread(threadId, newName) {
        const thread = this.loadThread(threadId);
        if (thread) {
            thread.name = newName;
            this.saveThread(thread);

            // Update index
            const index = this.loadIndex();
            if (index[threadId]) {
                index[threadId].name = newName;
                this.saveIndex(index);
            }
        }
    }

    getThreadSettings(threadId) {
        const thread = this.loadThread(threadId);
        return thread.settings;
    }

    updateThreadSettings(threadId, newSettings) {
        const thread = this.loadThread(threadId);
        if (thread) {
            thread.settings = newSettings;
            this.saveThread(thread);
        }
    }

    deleteMessages(threadId, messageIds) {
        const thread = this.getThread(threadId);
        if (thread) {
            const initialLength = thread.messages.length;
            thread.messages = thread.messages.filter(msg => !messageIds.includes(msg.id));
            if (thread.messages.length < initialLength) {
                this.saveThread(thread);
                return messageIds;
            }
        }
        return [];
    }

    addMarker(thread) {
        const markerMessage = {
            id: 'marker_' + Date.now(),
            type: 'marker',
            timestamp: Date.now()
        };
        thread.messages.push(markerMessage);
        this.saveThread(thread);
        return markerMessage.id;
    }

    getMessagesAfterLastMarker(thread) {
        const lastMarkerIndex = thread.messages.map(msg => msg.type).lastIndexOf('marker');
        return lastMarkerIndex !== -1 ? thread.messages.slice(lastMarkerIndex + 1) : thread.messages;
    }
    
    getMessageById(threadId, messageId) {
        const thread = this.getThread(threadId);
        if (thread) {
            return thread.messages.find(message => message.id === messageId);
        }
        return null;
    }
}

module.exports = ChatThreadRepository;