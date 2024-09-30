// job/jobExtension.js
const vscode = require('vscode');
const path = require('path');
const JobListViewProvider = require('./JobListViewProvider');
const JobViewProvider = require('./JobViewProvider');
const JobTaskHandler = require('./jobTaskHandler');
const JobThreadRepository = require('./jobThreadRepository');

// 添加这个对象来跟踪打开的 job 面板
const openJobPanels = {};

function activateJobExtension(context, agentLoader) {
    const projectRoot = context.workspaceState.get('projectRoot');
    const threadRepository = new JobThreadRepository(path.join(projectRoot, '.ai_helper/agent/memory_repo/job_threads'));

    const jobTaskHandler = new JobTaskHandler(threadRepository, agentLoader);
    const jobListProvider = new JobListViewProvider(threadRepository);
    const jobViewProvider = new JobViewProvider(context.extensionUri, threadRepository, jobTaskHandler);

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


    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.deleteJob', async (item) => {
            const result = await vscode.window.showWarningMessage(
                `Are you sure you want to delete the job "${item.name}"?`,
                { modal: true },
                "Yes",
                "No"
            );
            if (result === "Yes") {
                threadRepository.deleteJobThread(item.id);
                jobListProvider.refresh();
                vscode.window.showInformationMessage(`Job "${item.name}" deleted successfully`);

                // 如果job面板已打开，关闭它
                if (openJobPanels[item.name]) {
                    openJobPanels[item.name].dispose();
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.renameJob', async (item) => {
            const newName = await vscode.window.showInputBox({
                prompt: "Enter new name for the job",
                value: item.name
            });
            if (newName && newName !== item.name) {
                threadRepository.renameJobThread(item.id, newName);
                jobListProvider.refresh();
                vscode.window.showInformationMessage(`Job renamed to "${newName}"`);
    
                // 如果job面板已打开，更新其标题
                if (openJobPanels[item.name]) {
                    openJobPanels[item.name].title = newName;
                    openJobPanels[newName] = openJobPanels[item.name];
                    delete openJobPanels[item.name];
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

            jobViewProvider.resolveWebviewPanel(panel);

            // 将新打开的面板添加到 openJobPanels 对象中
            openJobPanels[jobName] = panel;

            // 当面板关闭时，从 openJobPanels 中移除
            panel.onDidDispose(() => {
                delete openJobPanels[jobName];
            });
        })
    );

    return {
        jobListProvider,
        jobViewProvider,
        jobThreadRepository: threadRepository,
        jobTaskHandler
    };
}

module.exports = activateJobExtension;