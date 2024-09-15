const vscode = require('vscode');
const yaml = require('js-yaml');

class SettingsEditorProvider {
    constructor(threadRepository, agentLoader) {
        this.threadRepository = threadRepository;
        this.agentLoader = agentLoader;
    }

    async provideTextDocumentContent(uri) {
        const threadId = uri.path.split('/').pop();
        let settings = this.threadRepository.getThreadSettings(threadId);
        // 如果meta为undefined，从agent读取meta
        if (settings === undefined) {
            const thread = this.threadRepository.getThread(threadId);
            if (thread && thread.agent) {
                const agent = this.agentLoader.loadAgentForThread(thread);
                settings = agent.settings || {};
                // 更新thread的meta
                this.threadRepository.update(threadId, settings);
            }
        }

        // 如果meta仍然是undefined，使用空对象
        return yaml.dump(settings || {});
    }

    async saveDocument(document) {
        const threadId = document.uri.path.split('/').pop();
        const content = document.getText();
        const newSettings = yaml.load(content);
        this.threadRepository.updateThreadSettings(threadId, newSettings);
        const thread = this.threadRepository.loadThread(threadId);
        this.agentLoader.updateAgentForThread(thread);
    }
}

module.exports = SettingsEditorProvider;