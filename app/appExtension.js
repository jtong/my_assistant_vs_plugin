const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const vsgradio = require('./vsgradio');

function activate(context) {
    let interfaceInstance = createInterface();
    interfaceInstance.registerEventHandlers();

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
                        case 'event':
                            const eventResult = interfaceInstance.handleEvent(
                                message.inputIndex,
                                message.eventName,
                                message.args[0],
                                message.allInputs
                            );
                            if (eventResult !== undefined) {
                                panel.webview.postMessage({
                                    type: 'eventResult',
                                    inputIndex: message.inputIndex,
                                    eventName: message.eventName,
                                    result: eventResult
                                });
                            }
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
            vsgradio.TextInput({
                label: "Enter text",
                events: {
                    click: (value, allInputs) => {
                        console.log("Text input clicked, current value:", value);
                        console.log("All input values:", allInputs);
                    },
                    input: (value, allInputs) => {
                        console.log("Input changed to:", value);
                        console.log("All input values:", allInputs);
                    }
                }
            }),
            vsgradio.Button({
                label: "Echo",
                events: {
                    click: (value, allInputs) => {
                        console.log("Button clicked");
                        console.log("All input values:", allInputs);
                    }
                }
            })
        ],
        outputs: [
            vsgradio.TextOutput({label: "Result"})
        ],
        title: "Echo Text Example"
    });
}

module.exports = activate;