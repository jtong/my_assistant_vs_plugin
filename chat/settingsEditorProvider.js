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
        if (settings === undefined) {
            const thread = this.threadRepository.getThread(threadId);
            if (thread && thread.agent) {
                const agent = this.agentLoader.loadAgentForThread(thread);
                settings = agent.settings || {};
                this.threadRepository.updateThreadSettings(thread, settings);
            }
        }
        return yaml.dump(settings || {});
    }

    async saveDocument(document) {
        const threadId = document.uri.path.split('/').pop();
        const content = document.getText();
        
        try {
            // 尝试解析 YAML
            const newSettings = yaml.load(content);

            const thread = this.threadRepository.loadTread(threadId)
            // 如果解析成功，进行保存操作
            this.threadRepository.updateThreadSettings(thread, newSettings);
            
            // 显示成功消息
            vscode.window.showInformationMessage('Settings saved successfully.');
        } catch (error) {
            // 如果解析失败，显示错误消息
            vscode.window.showErrorMessage(`Invalid YAML format: ${error.message}`);
            
            // 可选：将光标移动到错误位置
            if (error.mark) {
                const position = new vscode.Position(error.mark.line, error.mark.column);
                vscode.window.activeTextEditor.selection = new vscode.Selection(position, position);
            }
        }
    }
}

module.exports = SettingsEditorProvider;