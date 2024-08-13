// chatViewProvider.js
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const ThreadRepository = require('./threadRepository');

class ChatViewProvider {
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
    this.threadRepository = new ThreadRepository();
  }

  getWebviewContent(webview, threadId) {
    const htmlPath = path.join(this._extensionUri.fsPath, 'chat-view.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'script.js')));
    const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'style.css')));

    htmlContent = htmlContent.replace('${scriptUri}', scriptUri);
    htmlContent = htmlContent.replace('${styleUri}', styleUri);
    htmlContent = htmlContent.replace('${threadId}', threadId);

    return htmlContent;
  }

  getThread(threadId) {
    return this.threadRepository.getThread(threadId);
  }

  getThreadMessages(threadId) {
    return this.threadRepository.getThreadMessages(threadId);
  }

  addMessage(threadId, message) {
    this.threadRepository.addMessage(threadId, message);
  }

  updateMessage(threadId, messageId, updates) {
    this.threadRepository.updateMessage(threadId, messageId, updates);
  }
}

module.exports = ChatViewProvider;