// job/jobMessageHandler.js
class JobMessageHandler {
    constructor(threadRepository, agentLoader) {
        this.threadRepository = threadRepository;
        this.agentLoader = agentLoader;
    }

    // 这里可以添加处理 job 相关消息的方法
    async handleJobTask(thread, task) {
        const agent = this.agentLoader.loadAgent(thread.agent);
        // 实现 job 任务的处理逻辑
    }

    addJobToThread(thread, jobDetails) {
        const newJob = {
            id: 'job_' + Date.now(),
            ...jobDetails,
            timestamp: Date.now(),
            threadId: thread.id,
            status: 'pending'
        };
        this.threadRepository.addJob(thread.id, newJob);
        return this.threadRepository.getThread(thread.id);
    }
}

module.exports = JobMessageHandler;