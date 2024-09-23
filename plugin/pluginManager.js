const vscode = require('vscode');
const PluginMarketplace = require('./pluginMarketplace');
const PluginMarketplaceViewProvider = require('./pluginMarketplaceViewProvider');

class PluginManager {
    constructor(context) {
        this.context = context;
        this.pluginMarketplace = new PluginMarketplace(context);
        this.pluginMarketplaceViewProvider = new PluginMarketplaceViewProvider(this.pluginMarketplace);
    }

    activate() {
        // 注册 WebView Provider
        this.context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('pluginMarketplace', this.pluginMarketplaceViewProvider)
        );

        // 注册命令
        this.context.subscriptions.push(
            vscode.commands.registerCommand('myAssistant.refreshPluginMarketplace', () => {
                this.pluginMarketplaceViewProvider.refresh();
            })
        );

        this.context.subscriptions.push(
            vscode.commands.registerCommand('myAssistant.installPlugin', async (pluginName) => {
                const plugins = await this.pluginMarketplace.getPluginList();
                const plugin = plugins.find(p => p.name === pluginName);
                if (plugin) {
                    const success = await this.pluginMarketplace.installPlugin(plugin);
                    if (success) {
                        vscode.window.showInformationMessage(`Plugin ${plugin.name} installed successfully!`);
                        this.pluginMarketplaceViewProvider.refresh();
                    } else {
                        vscode.window.showErrorMessage(`Failed to install plugin ${plugin.name}.`);
                    }
                }
            })
        );
    }
}

module.exports = PluginManager;