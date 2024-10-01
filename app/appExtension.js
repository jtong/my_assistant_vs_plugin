const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const vsgradio = require('./vsgradio');

function activate(context) {
    let interfaceInstance = createInterface();

    context.subscriptions.push(
        vscode.commands.registerCommand('myAssistant.newAppThread', () => {
            const panel = vscode.window.createWebviewPanel(
                'vsgradioView',
                'VSGradio Interface',
                vscode.ViewColumn.One,
                {
                    enableScripts: true
                }
            );

            const htmlPath = path.join(context.extensionPath, 'app/webview/index.html');
            let html = fs.readFileSync(htmlPath, 'utf-8');

            panel.webview.html = html;

            panel.webview.onDidReceiveMessage(
                message => {
                    switch (message.type) {
                        case 'getInterface':
                            panel.webview.postMessage({
                                type: 'setInterface',
                                value: interfaceInstance.getConfig()
                            });
                            return;
                        case 'execute':
                            const result = interfaceInstance.execute(message.inputs);
                            panel.webview.postMessage({
                                type: 'updateOutput',
                                value: result
                            });
                            return;
                    }
                },
                undefined,
                context.subscriptions
            );
        })
    );
}

function createInterface() {
    return vsgradio.Interface({
        fn: (text) => text,
        inputs: [
            vsgradio.TextInput({ label: "Enter text" }),
            vsgradio.Button({ label: "Echo" })
        ],
        outputs: [
            vsgradio.TextOutput({ label: "Result" })
        ],
        title: "Echo Text Example"
    });
}

module.exports = activate;