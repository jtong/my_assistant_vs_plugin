// app/appExtension.js
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const AppInterfaceManager = require('./appInterfaceManager.js');

let appInterfaceManager = null;

function activate(context) {
    appInterfaceManager = new AppInterfaceManager(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.newAppThread', async () => {
            const panel = vscode.window.createWebviewPanel(
                'vsgradioView',
                'VSGradio Interface',
                vscode.ViewColumn.One,
                {
                    enableScripts: true
                }
            );

            const htmlPath = path.join(context.extensionPath, 'app', 'webview', 'index.html');
            let html = fs.readFileSync(htmlPath, 'utf-8');

            panel.webview.html = html;

            const interfaceId = `interface_${Date.now()}`;
            const appName = 'EchoApp'; // 这里可以根据需要动态选择应用

            try {
                const appInterface = await appInterfaceManager.createInterface(interfaceId, appName);
                
                panel.webview.onDidReceiveMessage(
                    message => handleMessage(message, panel, interfaceId),
                    undefined,
                    context.subscriptions
                );

                // 发送初始配置到 webview
                panel.webview.postMessage({
                    type: 'setInterface',
                    value: appInterface.getConfig()
                });
            } catch (error) {
                console.error('Error creating app interface:', error);
                vscode.window.showErrorMessage(`Failed to create app interface: ${error.message}`);
            }
        })
    );
}

async function handleMessage(message, panel, interfaceId) {
    const appInterface = appInterfaceManager.getInterface(interfaceId);
    if (!appInterface) {
        console.error(`No app interface found for id: ${interfaceId}`);
        return;
    }

    switch (message.type) {
        case 'getInterface':
            panel.webview.postMessage({
                type: 'setInterface',
                value: appInterface.getConfig()
            });
            return;
        case 'event':
            console.log('Received event from webview:', message);
            const eventResult = appInterface.handleEvent(
                message.componentId,
                message.eventName,
                message.args[0],
                message.inputs
            );
            console.log('Sending eventResult to webview:', {
                type: 'eventResult',
                componentId: message.componentId,
                eventName: message.eventName,
                result: eventResult
            });
            if (eventResult !== undefined) {
                panel.webview.postMessage({
                    type: 'eventResult',
                    componentId: message.componentId,
                    eventName: message.eventName,
                    result: eventResult
                });
            }
            return;
        case 'updateInterface':
            try {
                const updatedInterface = await appInterfaceManager.updateInterface(interfaceId, message.appName);
                panel.webview.postMessage({
                    type: 'setInterface',
                    value: updatedInterface.getConfig()
                });
            } catch (error) {
                console.error('Error updating app interface:', error);
                vscode.window.showErrorMessage(`Failed to update app interface: ${error.message}`);
            }
            return;
    }
}

module.exports = activate;