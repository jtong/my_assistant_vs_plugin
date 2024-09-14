// job/jobExtension.js
const vscode = require('vscode');
const path = require('path');
const JobListViewProvider = require('./JobListViewProvider');
const JobViewProvider = require('./JobViewProvider');
const JobMessageHandler = require('./jobMessageHandler');
const JobThreadRepository = require('./jobThreadRepository');

function activateJobExtension(context, agentLoader) {
    const projectRoot = context.workspaceState.get('projectRoot');
    const threadRepository = new JobThreadRepository(path.join(projectRoot, 'ai_helper/agent/memory_repo/job_threads'));
    
    const jobMessageHandler = new JobMessageHandler(threadRepository, agentLoader);
    const jobListProvider = new JobListViewProvider(threadRepository);
    const jobViewProvider = new JobViewProvider(context.extensionUri, threadRepository);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('jobList', jobListProvider),
    );

    context.subscriptions.push(
        vscode.window.createTreeView('jobList', {
            treeDataProvider: jobListProvider,
            showCollapseAll: false,
            canSelectMany: false
        })
    );

    // 注册新建 Job 命令
    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.newJob', async () => {
            const jobName = await vscode.window.showInputBox({
                prompt: "Enter a name for the new job"
            });
            if (jobName) {
                const agents = agentLoader.getAgentsList();
                const jobAgents = agents.filter(agent => agent.metadata && agent.metadata.type === 'job');
                if (jobAgents.length === 0) {
                    vscode.window.showErrorMessage('No job type agents available.');
                    return;
                }
                let agentName = await vscode.window.showQuickPick(
                    jobAgents.map(agent => agent.name),
                    { placeHolder: "Select an agent for this job" }
                );

                if (agentName) {
                    const newThreadId = 'thread_' + Date.now();
                    threadRepository.createJobThread(newThreadId, jobName, agentName);
                    jobListProvider.refresh();
                    vscode.commands.executeCommand('myAssistant.openJob', jobName, newThreadId);
                }
            }
        })
    );

    // 注册打开 Job 命令
    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.openJob', (jobName, threadId) => {
            // 与 openChat 类似，但使用 JobViewProvider
            const panel = vscode.window.createWebviewPanel(
                'jobView',
                jobName,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.join(context.extensionPath)),
                        vscode.Uri.file(projectRoot)
                    ]
                }
            );

            panel.webview.html = jobViewProvider.getWebviewContent(panel.webview, threadId);

            // 处理与前端的消息通信
            panel.webview.onDidReceiveMessage(async message => {
                // 在这里处理 job 类型的消息
            });
        })
    );

    return {
        jobListProvider,
        jobViewProvider,
        jobThreadRepository: threadRepository,
        jobMessageHandler
    };
}

module.exports = activateJobExtension;