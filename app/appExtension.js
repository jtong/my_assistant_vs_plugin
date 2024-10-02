const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const vsgradio = require('./vsgradio');

function activate(context) {
    let instance = createInstance();
    instance.registerEventHandlers();

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
                                value: instance.getConfig()
                            });
                            return;
                        case 'execute':
                            if (instance.execute) {
                                const result = instance.execute(message.inputs);
                                panel.webview.postMessage({
                                    type: 'updateOutput',
                                    value: result
                                });
                            }
                            return;
                        case 'event':
                            const eventResult = instance.handleEvent(
                                message.blockPath,
                                message.eventName,
                                message.args[0],
                                message.allInputs
                            );
                            if (eventResult !== undefined) {
                                panel.webview.postMessage({
                                    type: 'eventResult',
                                    blockPath: message.blockPath,
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

function createInstance() {
    // 你可以在这里选择创建 Interface 或 Blocks
    // 这里我们创建一个 Interface 实例作为示例
    return vsgradio.Interface({
        fn: (text) => text,
        inputs: [
            vsgradio.TextInput({
                label: "Enter text",
                events: {
                    input: (value, allInputs) => {
                        console.log("Text input changed, current value:", value);
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