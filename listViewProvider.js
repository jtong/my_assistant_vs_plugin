const vscode = require('vscode');

class ListViewProvider {
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
        return {
            label: element.name,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command: {
                command: 'myAssistant.openChat',
                title: 'Open Chat',
                arguments: [element.name, element.id]
            }
        };
    }

    getChildren() {
        const threads = this.threadRepository.getAllThreads();
        const chatItems = threads.map(thread => ({
            name: thread.name,
            id: thread.id
        }));
        return chatItems
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

module.exports = ListViewProvider;