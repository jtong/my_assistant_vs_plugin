const vscode = require('vscode');

class ChatListViewProvider {
    constructor(threadRepository) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // this.data = [
        //     { label: 'Chat 1', threadId: 'thread_1' },
        //     { label: 'Chat 2', threadId: 'thread_2' }
        // ];
        this.threadRepository = threadRepository;
    }

    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: 'myAssistant.openChat',
            title: 'Open Chat',
            arguments: [element.name, element.id]
        };
        treeItem.contextValue = 'chat'; // 添加这行来支持上下文菜单
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