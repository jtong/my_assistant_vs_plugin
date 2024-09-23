const vscode = require('vscode');

class PluginMarketplaceViewProvider {
    constructor(pluginMarketplace) {
        this._view = null;
        this.pluginMarketplace = pluginMarketplace;
    }

    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        this.updateContent();

        // 处理来自 WebView 的消息
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'installPlugin':
                    vscode.commands.executeCommand('myAssistant.installPlugin', message.pluginName);
                    break;
            }
        });
    }

    async updateContent() {
        if (this._view) {
            const plugins = await this.pluginMarketplace.getPluginList();
            this._view.webview.html = this.getHtmlForWebview(plugins);
        }
    }

    getHtmlForWebview(plugins) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Plugin Marketplace</title>
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
                    .plugin-item {
                        border: 1px solid #ccc;
                        padding: 10px;
                        margin-bottom: 10px;
                    }
                    .plugin-item h3 {
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
                <h1>Plugin Marketplace</h1>
                <input type="text" id="searchBar" placeholder="Search plugins...">
                <div id="pluginList">
                    ${plugins.map(plugin => `
                        <div class="plugin-item" data-name="${plugin.name.toLowerCase()}">
                            <h3>${plugin.name} (v${plugin.version})</h3>
                            <p>${plugin.description}</p>
                            <button class="install-btn" onclick="installPlugin('${plugin.name}')">Install</button>
                        </div>
                    `).join('')}
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    function installPlugin(pluginName) {
                        vscode.postMessage({ command: 'installPlugin', pluginName: pluginName });
                    }

                    // 搜索功能
                    const searchBar = document.getElementById('searchBar');
                    const pluginItems = document.querySelectorAll('.plugin-item');

                    searchBar.addEventListener('input', function() {
                        const searchTerm = this.value.toLowerCase();
                        pluginItems.forEach(item => {
                            const pluginName = item.getAttribute('data-name');
                            if (pluginName.includes(searchTerm)) {
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

module.exports = PluginMarketplaceViewProvider;