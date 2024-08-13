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

        panel.webview.onDidReceiveMessage(data => {
          switch (data.type) {
            case 'sendMessage':
              // Handle sending message logic
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