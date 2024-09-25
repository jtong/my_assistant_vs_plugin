const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class AgentMarketplaceViewProvider {
    constructor(agentMarketplace) {
        this._view = null;
        this.agentMarketplace = agentMarketplace;
    }

    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        this.updateContent();

        // 处理来自 WebView 的消息
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'installAgent':
                    vscode.commands.executeCommand('myAssistant.installAgent', message.agentName);
                    break;
                case 'getAgentList':
                    this.sendAgentListToWebview();
                    break;
            }
        });
    }

    async updateContent() {
        if (this._view) {
            this._view.webview.html = await this.getHtmlForWebview(this._view.webview);
        }
    }

    async getHtmlForWebview(webview) {
        const htmlPath = path.join(__dirname, 'webview', 'marketplace.html');
        const cssPath = path.join(__dirname, 'webview', 'marketplace.css');
        const jsPath = path.join(__dirname, 'webview', 'marketplace.js');

        let htmlContent = await fs.promises.readFile(htmlPath, 'utf-8');
        const cssContent = await fs.promises.readFile(cssPath, 'utf-8');
        const jsContent = await fs.promises.readFile(jsPath, 'utf-8');

        const styleUri = webview.asWebviewUri(vscode.Uri.file(cssPath));
        const scriptUri = webview.asWebviewUri(vscode.Uri.file(jsPath));

        htmlContent = htmlContent.replace('${styleUri}', styleUri);
        htmlContent = htmlContent.replace('${scriptUri}', scriptUri);

        return htmlContent;
    }

    async sendAgentListToWebview() {
        const agents = await this.agentMarketplace.getAgentList();
        this._view.webview.postMessage({ type: 'updateAgentList', agents: agents });
    }

    refresh() {
        this.updateContent();
    }
}

module.exports = AgentMarketplaceViewProvider;