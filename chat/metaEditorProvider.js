const vscode = require('vscode');
const yaml = require('js-yaml');

class MetaEditorProvider {
    constructor(threadRepository, agentLoader) {
        this.threadRepository = threadRepository;
        this.agentLoader = agentLoader;
    }

    async provideTextDocumentContent(uri) {
        const threadId = uri.path.split('/').pop();
        let meta = this.threadRepository.getThreadMeta(threadId);
        // 如果meta为undefined，从agent读取meta
        if (meta === undefined) {
            const thread = this.threadRepository.getThread(threadId);
            if (thread && thread.agent) {
                const agent = this.agentLoader.loadAgentForThread(thread);
                meta = agent.metadata || {};
                // 更新thread的meta
                this.threadRepository.updateThreadMeta(threadId, meta);
            }
        }

        // 如果meta仍然是undefined，使用空对象
        return yaml.dump(meta || {});
    }

    async saveDocument(document) {
        const threadId = document.uri.path.split('/').pop();
        const content = document.getText();
        const newMeta = yaml.load(content);
        this.threadRepository.updateThreadMeta(threadId, newMeta);
        const thread = this.threadRepository.loadThread(threadId);
        this.agentLoader.updateAgentForThread(thread);
    }
}

module.exports = MetaEditorProvider;