const vscode = require('vscode');

class ChatListViewProvider {
    constructor(threadRepository, config = {}) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.threadRepository = threadRepository;
        this.openCommand = config.openCommand;
        this.contextValue = config.contextValue || 'chat';
    }

    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: this.openCommand || 'myAssistant.openChat',
            title: 'Open Chat',
            arguments: [element.name, element.id]
        };
        treeItem.contextValue = this.contextValue || 'chat'; // 添加这行来支持上下文菜单
        return treeItem;
    }

    getChildren() {
        const threads = this.threadRepository.getAllThreadsInfo();
        
        const chatItems = Object.values(threads).flatMap(thread => ({
            name: thread.name,
            id: thread.id
        })).reverse();
        return chatItems
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

module.exports = ChatListViewProvider;