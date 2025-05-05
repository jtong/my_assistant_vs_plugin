// job/jobMessageHandler.js
const { Response, Task } = require('ai-agent-response');

class JobTaskHandler {
    constructor(threadRepository, agentLoader) {
        this.threadRepository = threadRepository;
        this.agentLoader = agentLoader;
    }

    async handleJobTask(thread, task) {
        const agent = await this.agentLoader.loadAgentForThread(thread);
        let response = await agent.executeTask(task, thread);
        return response;
    }

    async sendTaskToAgent(threadId, task) {
        const thread = this.threadRepository.getThread(threadId);
        if (thread) {
            return await this.handleJobTask(thread, task);
        } else {
            throw new Error(`Thread with id ${threadId} not found.`);
        }
    }

    async executeJob(threadId, jobIndex) {
        const thread = this.threadRepository.getThread(threadId);
        if (thread) {
            const job = thread.jobs.find(j => j.index === jobIndex);
            if (job) {
                const agent = await this.agentLoader.loadAgentForThread(thread);

                // 从 job 的 AvailableTask 获取 Task
                const task = job.availableTask.task;

                // 执行任务
                const response = await agent.executeTask(task, thread);

                // 更新 AvailableTask 的状态
                job.availableTask.status = 'completed';
                this.threadRepository.saveThread(thread);

                return response;
            } else {
                throw new Error(`Job with index ${jobIndex} not found.`);
            }
        } else {
            throw new Error(`Thread with id ${threadId} not found.`);
        }
    }

}

module.exports = JobTaskHandler;