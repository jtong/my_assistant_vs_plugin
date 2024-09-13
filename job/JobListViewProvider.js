// JobListViewProvider.js
const vscode = require('vscode');

class JobListViewProvider {
    constructor(threadRepository) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.threadRepository = threadRepository;
    }

    getTreeItem(element) {
        return {
            label: element.name,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command: {
                command: 'myAssistant.openJob',
                title: 'Open Job',
                arguments: [element.name, element.id]
            }
        };
    }

    getChildren() {
        const threads = this.threadRepository.getAllJobThreadsInfo();
        const jobItems = Object.values(threads).map(thread => ({
            name: thread.name,
            id: thread.id
        }));
        return jobItems;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

module.exports = JobListViewProvider;