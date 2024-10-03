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
                                message.inputs  // 修改为使用指定的输入
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
                    }
                },
                undefined,
                context.subscriptions
            );
        })
    );
}

function createInstance() {
    const instance = vsgradio.Blocks([
        vsgradio.Column({
            children: [
                vsgradio.TextInput({
                    id: 'textInput',
                    label: "Enter text",
                    role: 'input'
                }),
                vsgradio.Button({
                    id: 'echoButton',
                    label: "Echo",
                    role: 'action',
                    events: {
                        click: {
                            inputs: ['textInput'],  // 指定输入组件
                            outputs: ['result'],    // 指定输出组件
                            handler: (inputs) => {  // 指定处理函数
                                console.log("Button clicked");
                                const inputValue = inputs.textInput;
                                const result = `You entered: ${inputValue}`;
                                return result;
                            }
                        }
                    }
                }),
                vsgradio.TextInput({
                    id: 'result',
                    label: "Result",
                    role: 'output',
                    readOnly: true
                })
            ]
        })
    ]);

    instance.title = "Echo Text Example";

    return instance;
}

module.exports = activate;