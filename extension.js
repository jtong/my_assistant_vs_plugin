const vscode = require('vscode');
const path = require('path');
const ChatViewProvider = require('./chatViewProvider');
const ListViewProvider = require('./listViewProvider');

// Object to store open chat panels
const openChatPanels = {};

function activate(context) {
  const chatProvider = new ChatViewProvider(context.extensionUri);
  const listProvider = new ListViewProvider();

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

        panel.webview.onDidReceiveMessage(message => {
          switch (message.type) {
            case 'getMessages':
              const thread = chatProvider.getThread(message.threadId);
              panel.webview.postMessage({ type: 'loadThread', thread });
              break;
            case 'sendMessage':
              const newMessage = {
                id: message.messageId,
                sender: 'user',
                text: message.message,
                timestamp: Date.now(),
                threadId: message.threadId,
                formSubmitted: false
              };
              chatProvider.addMessage(message.threadId, newMessage);
              
              // 模拟机器人回复
              const botReply = {
                id: 'bot_' + message.messageId,
                sender: 'bot',
                text: '回复: ' + message.message,
                isHtml: false,
                timestamp: Date.now(),
                threadId: message.threadId,
                formSubmitted: false
              };
              chatProvider.addMessage(message.threadId, botReply);
              
              // 刷新webview中的消息
              const updatedThread = chatProvider.getThread(message.threadId);
              panel.webview.postMessage({ type: 'loadThread', thread: updatedThread });
              break;
            case 'updateMessage':
              chatProvider.updateMessage(message.threadId, message.messageId, message.updates);
              break;
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

function deactivate() {}

module.exports = {
  activate,
  deactivate
};