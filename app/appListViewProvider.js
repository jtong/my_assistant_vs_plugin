const vscode = require('vscode');
const path = require('path');

class AppListViewProvider {
    constructor(appInterfaceManager) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.appInterfaceManager = appInterfaceManager;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren(element) {
        if (element) {
            return [];
        }

        const apps = this.appInterfaceManager.getAvailableApps();
        return apps.map(app => {
            const treeItem = new vscode.TreeItem(app.name);
            treeItem.id = app.id;
            treeItem.contextValue = 'app';
            treeItem.tooltip = `${app.name} v${app.version}\n${app.description || ''}`;
            treeItem.command = {
                command: 'myAssistant.openApp',
                title: 'Open App',
                arguments: [app.name, app.id]
            };
            return treeItem;
        });
    }
}

module.exports = AppListViewProvider;
