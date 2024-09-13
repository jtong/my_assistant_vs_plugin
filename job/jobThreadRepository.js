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
}

module.exports = JobThreadRepository;