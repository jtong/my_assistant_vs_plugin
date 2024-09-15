// job/jobMessageHandler.js
const { Response, Task } = require('ai-agent-response');

class JobMessageHandler {
    constructor(threadRepository, agentLoader) {
        this.threadRepository = threadRepository;
        this.agentLoader = agentLoader;
    }

    async handleJobTask(thread, task) {
        const agent = this.agentLoader.loadAgentForThread(thread);
        let response = await agent.executeTask(task, thread);

        if (response.meta && response.meta.generatedJobs) {
            thread.jobs = response.meta.generatedJobs;
            this.threadRepository.saveThread(thread);
        }

        return response;
    }

    async loadContext(thread, filePath) {
        const agent = this.agentLoader.loadAgentForThread(thread);
        const task = new Task({
            name: "Initialize Job",
            type: Task.TYPE_ACTION,
            message: `Load context from file: ${filePath}`
        });

        const response = await this.handleJobTask(thread, task);
        return response;
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