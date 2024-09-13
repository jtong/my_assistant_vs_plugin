// JobViewProvider.js
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class JobViewProvider {
    constructor(extensionUri, threadRepository) {
        this._extensionUri = extensionUri;
        this.threadRepository = threadRepository;
    }

    getWebviewContent(webview, threadId) {
        const htmlPath = path.join(this._extensionUri.fsPath, 'job-view.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

        const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'jobScript.js')));
        const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'style.css')));

        htmlContent = htmlContent.replace('${scriptUri}', scriptUri);
        htmlContent = htmlContent.replace('${styleUri}', styleUri);
        htmlContent = htmlContent.replace('${threadId}', threadId);

        return htmlContent;
    }

    // 其他与 job 相关的方法
}

module.exports = JobViewProvider;