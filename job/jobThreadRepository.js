// job/jobThreadRepository.js
const fs = require('fs');
const path = require('path');

class JobThreadRepository {
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

    // 实现之前 ThreadRepository 中与 job 相关的方法
    // 例如：createJobThread, getJobThread, addJob, updateJob 等

    loadIndex() {
        return JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
    }

    saveIndex(index) {
        fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
    }

    // 其他方法...
    getAllJobThreadsInfo() {
        const index = this.loadIndex();
        const jobThreads = {};
        for (const [threadId, threadInfo] of Object.entries(index)) {
            const thread = this.loadThread(threadId);
            if (thread.type === 'job') {
                jobThreads[threadId] = threadInfo;
            }
        }
        return jobThreads;
    }

    getThread(threadId) {
        return this.loadThread(threadId);
    }

    loadThread(threadId) {
        const filePath = this.getThreadFilePath(threadId);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        return null;
    }
    
    createJobThread(threadId, name, agentName) {
        const newThread = {
            id: threadId,
            name: name,
            agent: agentName,
            type: 'job', // 标记为 job 类型
            jobs: []
        };
        this.saveThread(newThread);
        return newThread;
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


    getThreadFilePath(threadId) {
        return path.join(this.storagePath, threadId, 'thread.json');
    }

    deleteJobThread(threadId) {
        const threadFolder = path.join(this.storagePath, threadId);
        if (fs.existsSync(threadFolder)) {
            fs.rmdirSync(threadFolder, { recursive: true });
        }

        // Update index
        const index = this.loadIndex();
        delete index[threadId];
        this.saveIndex(index);
    }

    renameJobThread(threadId, newName) {
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

    addJobToThread(threadId, availableTask) {
        const thread = this.getThread(threadId);
        if (thread) {
            const newJob = {
                index: thread.jobs.length, // 根据 jobs 数组长度设置索引
                availableTask: availableTask // 存储 AvailableTask 对象
            };
            thread.jobs.push(newJob);
            this.saveThread(thread);
            return newJob;
        } else {
            throw new Error(`Thread with id ${threadId} not found.`);
        }
    }
}

module.exports = JobThreadRepository;