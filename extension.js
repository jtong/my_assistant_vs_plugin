// extension.js
const vscode = require('vscode');
const path = require('path');
const ChatViewProvider = require('./chatViewProvider');
const ListViewProvider = require('./listViewProvider');
const MessageHandler = require('./messageHandler');
const ThreadRepository = require('./threadRepository');
const AgentLoader = require('./agentLoader');

// Object to store open chat panels
const openChatPanels = {};

function activate(context) {
    // 获取当前打开的工作区文件夹路径
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }
    const projectRoot = workspaceFolders[0].uri.fsPath;
  const agentLoader = new AgentLoader(path.join(projectRoot, 'ai_helper', 'agent', 'agents.json'));

  const threadRepository = new ThreadRepository(agentLoader);
  const chatProvider = new ChatViewProvider(context.extensionUri, threadRepository);
  const listProvider = new ListViewProvider();
  const messageHandler = new MessageHandler(threadRepository, agentLoader);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('chatList', listProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('myAssistant.openChat', (chatName, threadId) => {
      if (openChatPanels[chatName]) {
        openChatPanels[chatName].reveal(vscode.ViewColumn.One);
      } else {
        const panel = vscode.window.createWebviewPanel(
          'chatView',
          chatName,
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath))]
          }
        );

        panel.webview.html = chatProvider.getWebviewContent(panel.webview, threadId);

        panel.webview.onDidReceiveMessage(async message => {
          let thread = chatProvider.getThread(message.threadId);
          switch (message.type) {
            case 'getMessages':
              panel.webview.postMessage({ type: 'loadThread', thread });
              break;
            case 'sendMessage':
              const response = messageHandler.handleMessage(thread, message.message);

              // 添加bot回复到线程
              const botMessage = {
                id: 'bot_' + Date.now(),
                sender: 'bot',
                text: response.getFullMessage(),
                isHtml: false,
                timestamp: Date.now(),
                threadId: message.threadId,
                formSubmitted: false
              };
              threadRepository.addMessage(message.threadId, botMessage);

              // 刷新webview中的消息
              const updatedThread = threadRepository.getThread(message.threadId);
              panel.webview.postMessage({ type: 'loadThread', thread: updatedThread });

              // 如果需要流式输出
              // for await (const chunk of response.getStream()) {
              //   panel.webview.postMessage({ type: 'streamResponse', chunk });
              // }
              break;
            // 处理其他类型的消息...
          }
        });

        openChatPanels[chatName] = panel;

        panel.onDidDispose(() => {
          delete openChatPanels[chatName];
        });
      }
    })
  );
}

function deactivate() { }

module.exports = {
  activate,
  deactivate
};