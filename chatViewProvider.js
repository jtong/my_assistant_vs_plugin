const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class ChatViewProvider {
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
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
}

module.exports = ChatViewProvider;