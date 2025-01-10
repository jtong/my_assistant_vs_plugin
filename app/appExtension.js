// app/appExtension.js
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const AppInterfaceManager = require('./appInterfaceManager.js');
const AppListViewProvider = require('./appListViewProvider');

let appInterfaceManager = null;

function activate(context) {
    appInterfaceManager = new AppInterfaceManager(context);
    const listProvider = new AppListViewProvider(appInterfaceManager);

    // Register the app list view
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('appList', listProvider),
        vscode.window.createTreeView('appList', {
            treeDataProvider: listProvider,
            showCollapseAll: false,
            canSelectMany: false
        })
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.newApp', async () => {
            const appName = await vscode.window.showInputBox({
                prompt: "Enter a name for the new app"
            });
            if (appName) {
                try {
                    await appInterfaceManager.createApp(appName);
                    listProvider.refresh();
                    vscode.window.showInformationMessage(`App "${appName}" created successfully`);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to create app: ${error.message}`);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.deleteApp', async (item) => {
            const result = await vscode.window.showWarningMessage(
                `Are you sure you want to delete the app "${item.label}"?`,
                { modal: true },
                "Yes"
            );
            if (result === "Yes") {
                try {
                    await appInterfaceManager.deleteApp(item.id);
                    listProvider.refresh();
                    vscode.window.showInformationMessage(`App "${item.label}" deleted successfully`);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to delete app: ${error.message}`);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.renameApp', async (item) => {
            const newName = await vscode.window.showInputBox({
                prompt: "Enter new name for the app",
                value: item.label
            });
            if (newName) {
                try {
                    await appInterfaceManager.renameApp(item.id, newName);
                    listProvider.refresh();
                    vscode.window.showInformationMessage(`App renamed to "${newName}" successfully`);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to rename app: ${error.message}`);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.openApp', async (appName, appId) => {
            const panel = vscode.window.createWebviewPanel(
                'vsgradioView',
                `App: ${appName}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.join(context.extensionPath, 'app', 'webview'))
                    ]
                }
            );

            // Get webview content
            const htmlPath = path.join(context.extensionPath, 'app', 'webview', 'index.html');
            const appListJsPath = path.join(context.extensionPath, 'app', 'webview', 'appList.js');
            
            // Convert to webview URIs
            const appListJsUri = panel.webview.asWebviewUri(vscode.Uri.file(appListJsPath));
            
            // Read and update HTML content
            let html = fs.readFileSync(htmlPath, 'utf-8');
            html = html.replace(
                './appList.js',
                appListJsUri.toString()
            );

            panel.webview.html = html;

            // Create interface for this app
            const interfaceId = `interface_${Date.now()}`;
            try {
                const appInterface = await appInterfaceManager.createInterface(interfaceId, appName);
                panel.webview.postMessage({
                    type: 'setInterface',
                    value: appInterface.getConfig()
                });

                panel.webview.onDidReceiveMessage(
                    message => handleMessage(message, panel, interfaceId),
                    undefined,
                    context.subscriptions
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open app: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.refreshAppList', () => {
            listProvider.refresh();
            vscode.window.showInformationMessage('App list refreshed successfully');
        })
    );
}

async function handleMessage(message, panel, interfaceId) {
    console.log('Received message:', message);
    switch (message.type) {
        case 'event':
            const appInterface = appInterfaceManager.getInterface(interfaceId);
            if (!appInterface) {
                console.error(`No app interface found for id: ${interfaceId}`);
                return;
            }

            const eventResult = appInterface.handleEvent(
                message.componentId,
                message.eventName,
                message.args[0],
                message.inputs
            );

            if (eventResult !== undefined) {
                panel.webview.postMessage({
                    type: 'eventResult',
                    componentId: message.componentId,
                    eventName: message.eventName,
                    result: eventResult
                });
            }
            break;
    }
}

module.exports = activate;