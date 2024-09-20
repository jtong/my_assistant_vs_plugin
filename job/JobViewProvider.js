// JobViewProvider.js
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { Response, Task, AvailableTask } = require('ai-agent-response');

class JobViewProvider {
    constructor(extensionUri, threadRepository, jobTaskHandler) {
        this._extensionUri = extensionUri;
        this.threadRepository = threadRepository;
        this.jobTaskHandler = jobTaskHandler;
    }

    getWebviewContent(webview, threadId) {
        const htmlPath = path.join(this._extensionUri.fsPath, 'job/job-view.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

        const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'job/script.js')));
        const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'job/style.css')));

        htmlContent = htmlContent.replace('${scriptUri}', scriptUri);
        htmlContent = htmlContent.replace('${styleUri}', styleUri);
        htmlContent = htmlContent.replace('${threadId}', threadId);

        return htmlContent;
    }

    resolveWebviewPanel(panel) {
        const host_utils = {
            convertToWebviewUri(absolutePath) {
                const uri = vscode.Uri.file(absolutePath);
                return panel.webview.asWebviewUri(uri).toString();
            },
            threadRepository: this.threadRepository
        };
        panel.webview.onDidReceiveMessage(async (message) => {
            const threadId = message.threadId;

            switch (message.type) {
                case 'loadContext':
                    {
                        const filePath = message.filePath;
                        const task = new Task({
                            name: 'Initialize Job',
                            type: Task.TYPE_ACTION,
                            message: `Load context from file: ${filePath}`,
                            meta: {},
                            host_utils
                        });
                        const thread = this.threadRepository.getThread(threadId);
                        const response = await this.jobTaskHandler.sendTaskToAgent(threadId, task);
                        if (response.availableTasks && response.availableTasks.length > 0) {
                            response.availableTasks.forEach(availableTask => {
                                this.threadRepository.addJobToThread(thread.id, availableTask);
                            });
                        }
                        const updatedThread = this.threadRepository.getThread(threadId);

                        panel.webview.postMessage({
                            type: 'contextLoaded',
                            jobs: updatedThread.jobs
                        });
                    }
                    break;

                case 'executeJob':
                    const jobIndex = message.jobIndex;
                    await this.jobTaskHandler.executeJob(threadId, jobIndex);
                    const updatedThread = this.threadRepository.getThread(threadId);
                    panel.webview.postMessage({
                        type: 'jobUpdated',
                        jobs: updatedThread.jobs
                    });
                    break;

                // 其他消息处理...
            }
        });
    }

}

module.exports = JobViewProvider;