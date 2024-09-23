// agent/agentMarketplaceViewProvider.js
const vscode = require('vscode');

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
            }
        });
    }

    async updateContent() {
        if (this._view) {
            const agents = await this.agentMarketplace.getAgentList();
            this._view.webview.html = this.getHtmlForWebview(agents);
        }
    }

    getHtmlForWebview(agents) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Agent Marketplace</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 10px;
                    }
                    #searchBar {
                        width: 97%;
                        padding: 5px;
                        margin-bottom: 10px;
                    }
                    .agent-item {
                        border: 1px solid #ccc;
                        padding: 10px;
                        margin-bottom: 10px;
                    }
                    .agent-item h3 {
                        margin-top: 0;
                    }
                    .install-btn {
                        background-color: #007acc;
                        color: white;
                        border: none;
                        padding: 5px 10px;
                        cursor: pointer;
                    }
                </style>
            </head>
            <body>
                <h1>Agent Marketplace</h1>
                <input type="text" id="searchBar" placeholder="Search agents...">
                <div id="agentList">
                    ${agents.map(agent => `
                        <div class="agent-item" data-name="${agent.name.toLowerCase()}">
                            <h3>${agent.name} (v${agent.version})</h3>
                            <p>${agent.description}</p>
                            <button class="install-btn" onclick="installAgent('${agent.name}')">Install</button>
                        </div>
                    `).join('')}
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    function installAgent(agentName) {
                        vscode.postMessage({ command: 'installAgent', agentName: agentName });
                    }

                    // 搜索功能
                    const searchBar = document.getElementById('searchBar');
                    const agentItems = document.querySelectorAll('.agent-item');

                    searchBar.addEventListener('input', function() {
                        const searchTerm = this.value.toLowerCase();
                        agentItems.forEach(item => {
                            const agentName = item.getAttribute('data-name');
                            if (agentName.includes(searchTerm)) {
                                item.style.display = 'block';
                            } else {
                                item.style.display = 'none';
                            }
                        });
                    });
                </script>
            </body>
            </html>
        `;
    }

    refresh() {
        this.updateContent();
    }
}

module.exports = AgentMarketplaceViewProvider;