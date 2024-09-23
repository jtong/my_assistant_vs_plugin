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
    }

    async updateContent() {
        if (this._view) {
            const plugins = await this.pluginMarketplace.getPluginList();
            this._view.webview.html = this.getHtmlForWebview(plugins);
        }
    }

    getHtmlForWebview(plugins) {
        // 生成 HTML 内容，显示插件列表和安装按钮
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Plugin Marketplace</title>
            </head>
            <body>
                <h1>Plugin Marketplace</h1>
                <ul>
                    ${plugins.map(plugin => `
                        <li>
                            <h3>${plugin.name} (v${plugin.version})</h3>
                            <p>${plugin.description}</p>
                            <button onclick="installPlugin('${plugin.name}')">Install</button>
                        </li>
                    `).join('')}
                </ul>
                <script>
                    const vscode = acquireVsCodeApi();
                    function installPlugin(pluginName) {
                        vscode.postMessage({ command: 'installPlugin', pluginName: pluginName });
                    }
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