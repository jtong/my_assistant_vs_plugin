const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const vsgradio = require('./vsgradio');

let instance = null;

function activate(context) {
    instance = createInstance();
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
                        case 'event':
                            console.log('Received event from webview:', message);
                            const eventResult = instance.handleEvent(
                                message.componentId,
                                message.eventName,
                                message.args[0],
                                message.allInputs
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
                                    value: "",
                                    componentId: message.componentId,
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
    const instance =  vsgradio.Interface({
        fn: (text) => {
            return `You entered: ${text}`;
        },
        inputs: [
            vsgradio.TextInput({
                id: 'textInput',
                label: "Enter text",
                role: 'input',
                events: {
                    input: (value, allInputs) => {
                        console.log("Text input changed, current value:", value);
                    }
                }
            }),
            vsgradio.Button({
                id: 'echoButton',
                label: "Echo",
                role: 'action',
                events: {
                    click: (value, allInputs) => {
                        console.log("Button clicked");
                        console.log("All input values:", allInputs);
                        const result = instance.fn(allInputs.textInput);
                        return {
                            type: 'updateOutput',
                            value: result
                        };
                    }
                }
            })
        ],
        outputs: [
            vsgradio.TextOutput({ id: 'result', label: "Result" })
        ],
        title: "Echo Text Example"
    });
    return instance;
}

module.exports = activate;