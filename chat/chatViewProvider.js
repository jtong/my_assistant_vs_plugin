// chatViewProvider.js
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class ChatViewProvider {
    constructor(extensionUri, threadRepository) {
        this._extensionUri = extensionUri;
        this.threadRepository = threadRepository;
    }

    getWebviewContent(webview, threadId) {
        const htmlPath = path.join(this._extensionUri.fsPath, 'chat/chat-view.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

        const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat/script.js')));
        const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat/style.css')));
        const markdownItUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'lib', 'markdown-it.min.js')));
        const highlightJsUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'lib', 'highlight.min.js')));
        const highlightCssUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'chat', 'lib', 'highlight.default.min.css')));

        htmlContent = htmlContent.replace('${scriptUri}', scriptUri);
        htmlContent = htmlContent.replace('${styleUri}', styleUri);
        htmlContent = htmlContent.replace('${markdownItUri}', markdownItUri);
        htmlContent = htmlContent.replace('${highlightJsUri}', highlightJsUri);
        htmlContent = htmlContent.replace('${highlightCssUri}', highlightCssUri);
        htmlContent = htmlContent.replace('${threadId}', threadId);

        return htmlContent;
    }

    getThread(threadId) {
        return this.threadRepository.getThread(threadId);
    }

    getThreadMessages(threadId) {
        return this.threadRepository.getThreadMessages(threadId);
    }

}

module.exports = ChatViewProvider;