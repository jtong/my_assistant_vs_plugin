const vscode = require('vscode');

class ListViewProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.data = [
            { label: 'Chat 1', threadId: 'thread_1' },
            { label: 'Chat 2', threadId: 'thread_2' }
        ];
    }

    getTreeItem(element) {
        return {
            label: element.label,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command: {
                command: 'myAssistant.openChat',
                title: 'Open Chat',
                arguments: [element.label, element.threadId]
            }
        };
    }



    getChildren() {
        return this.data;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

module.exports = ListViewProvider;