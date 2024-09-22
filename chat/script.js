let isBotResponding = false;

const md = window.markdownit({
    highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(str, { language: lang }).value;
            } catch (__) { }
        }
        return ''; // 使用外部默认转义
    }
});

function renderMarkdown(text) {
    return md.render(text);
}

document.getElementById('send-btn').addEventListener('click', sendMessageHandler);
document.getElementById('user-input').addEventListener('keydown', function (event) {
    // 当用户按下回车键且没有按住Shift键时发送消息
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // 防止默认的换行行为
        sendMessageHandler();
    }
});
document.getElementById('retry-btn').addEventListener('click', retryMessageHandler);

function retryMessageHandler() {
    if (isBotResponding) return;  // 如果 bot 正在回复，不允许重试

    isBotResponding = true;  // 设置标志，表示 bot 开始回复
    const message = {
        type: 'retryMessage',
        threadId: window.threadId
    };
    window.vscode.postMessage(message);
}

window.onload = function () {
    const threadId = window.threadId;
    if (threadId) {
        loadThread(threadId);
    }
};

function loadThread(threadId) {
    window.vscode.postMessage({
        type: 'getMessages',
        threadId: threadId
    });
}

function addEditButtons() {
    const messages = document.querySelectorAll('#chat-box > div');
    messages.forEach(message => {
        const container = message.querySelector('.message-container');
        if (container && !container.querySelector('.edit-btn')) {
            // 添加复制按钮
            const copyBtn = document.createElement('button');
            copyBtn.textContent = 'Copy';
            copyBtn.className = 'copy-btn';
            copyBtn.onclick = function () {
                const originalText = message.getAttribute('data-original-text');
                copyToClipboard(originalText);
            };
            container.appendChild(copyBtn);

            // 添加编辑按钮
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.className = 'edit-btn';
            editBtn.onclick = function () {
                const textContainer = container.querySelector('.message-text');
                const messageId = message.getAttribute('data-message-id');
                const originalText = message.getAttribute('data-original-text'); // 使用存储的原始文本
                const isHtml = message.getAttribute('data-is-html') === 'true'; // 获取 isHtml 属性

                const editWrapper = document.createElement('div');
                editWrapper.className = 'edit-wrapper';

                const textarea = document.createElement('textarea');
                textarea.value = originalText; // 使用原始文本
                editWrapper.appendChild(textarea);

                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'button-container';

                const saveBtn = document.createElement('button');
                saveBtn.textContent = 'Save';
                saveBtn.className = 'save-btn';
                buttonContainer.appendChild(saveBtn);

                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Cancel';
                cancelBtn.className = 'cancel-btn';
                buttonContainer.appendChild(cancelBtn);

                editWrapper.appendChild(buttonContainer);

                container.insertBefore(editWrapper, textContainer);
                textContainer.style.display = 'none';
                editBtn.style.display = 'none';

                autoResizeTextarea(textarea);

                saveBtn.onclick = function () {
                    const newText = textarea.value;
                    message.setAttribute('data-original-text', newText); // 更新存储的原始文本

                    if (isHtml) {
                        textContainer.innerHTML = newText;
                    } else {
                        textContainer.innerHTML = renderMarkdown(newText); // 重新渲染 Markdown
                    }

                    textContainer.style.display = '';
                    editWrapper.remove();
                    editBtn.style.display = '';

                    window.vscode.postMessage({
                        type: 'updateMessage',
                        threadId: window.threadId,
                        messageId: messageId,
                        newText: newText
                    });
                };

                cancelBtn.onclick = function () {
                    textContainer.style.display = '';
                    editWrapper.remove();
                    editBtn.style.display = '';
                };
            };

            container.appendChild(editBtn);
        }
    });
}

function copyToClipboard(text) {
    // 发送消息到扩展程序进行复制操作
    window.vscode.postMessage({
        type: 'copyToClipboard',
        text: text,
        threadId: window.threadId
    });
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';

    textarea.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });
}

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'loadThread':
            displayThread(message.thread);
            break;
        case 'addUserMessage':
            displayUserMessage(message.message);
            break;
        case 'addBotMessage':
            displayBotMessage(message.message, message.isStreaming);
            break;
        case 'updateBotMessage':
            updateBotMessage(message.messageId, message.text, message.availableTasks);
            break;
        case 'botResponseComplete':
            isBotResponding = false;  // 重置标志，表示 bot 回复完成
            addEditButtons();
            break;
        case 'removeLastBotMessage':
            removeLastBotMessage();
            break;
        case 'removeMessagesAfterLastUser':
            const chatBox = document.getElementById('chat-box');
            const messages = chatBox.children;
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].classList.contains('user')) {
                    break; // 找到最后一条用户消息，停止删除
                }
                chatBox.removeChild(messages[i]);
            }
            break;
        case 'updateAvailableTasks':
            displayTaskButtons(message.tasks);
            break;
        case 'loadOperations':
            window.currentSettings = message.currentSettings || {};
            displayOperations(message.operations);
            break;
        // ...其他 case    
    }
});


// 定义显示操作项的函数
function displayOperations(operations) {
    const container = document.getElementById('operations-container');
    container.innerHTML = ''; // 清除现有内容

    operations.forEach(operation => {
        if (operation.type === 'setting' && operation.control === 'select') {
            // 创建下拉框
            const select = document.createElement('select');
            select.id = `operation-${operation.settingKey}`;

            // 创建选项
            operation.options.forEach(optionValue => {
                const option = document.createElement('option');
                option.value = optionValue;
                option.textContent = optionValue;
                select.appendChild(option);
            });

            // 设置默认值
            const currentValue = window.currentSettings[operation.settingKey] || operation.default || operation.options[0];
            select.value = currentValue;

            // 监听选择变化事件
            select.addEventListener('change', function () {
                const selectedValue = this.value;
                // 发送消息给扩展后端，通知更新设置
                window.vscode.postMessage({
                    type: 'updateSetting',
                    threadId: window.threadId,
                    settingKey: operation.settingKey,
                    value: selectedValue
                });
            });

            // 创建一个标签显示设置名称
            const label = document.createElement('label');
            label.textContent = `${operation.name}：`;
            label.htmlFor = select.id;

            // 将标签和下拉框添加到容器
            container.appendChild(label);
            container.appendChild(select);
            container.appendChild(document.createElement('br'));

        } else if (operation.type === 'action' && operation.control === 'button') {
            // 创建按钮
            const button = document.createElement('button');
            button.textContent = operation.name;
            button.addEventListener('click', () => executeTask(operation.taskName));
            container.appendChild(button);
        }
    });
}

function removeLastBotMessage() {
    const chatBox = document.getElementById('chat-box');
    const messages = chatBox.children;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].classList.contains('bot')) {
            chatBox.removeChild(messages[i]);
            break;
        }
    }
}

function createMessageElement(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add(message.sender);
    messageElement.setAttribute('data-message-id', message.id);
    messageElement.setAttribute('data-original-text', message.text);
    messageElement.setAttribute('data-is-html', message.isHtml);

    const container = document.createElement('div');
    container.className = 'message-container';

    const textContainer = document.createElement('span');
    textContainer.className = 'message-text';

    if (message.isHtml) {
        textContainer.innerHTML = message.text;
    } else {
        textContainer.innerHTML = renderMarkdown(message.text);
    }

    container.appendChild(textContainer);
    messageElement.appendChild(container);

    return messageElement;
}

function displayUserMessage(message) {
    const chatBox = document.getElementById('chat-box');
    const messageElement = createMessageElement(message);
    chatBox.appendChild(messageElement);
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function displayBotMessage(message, isStreaming = false) {
    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('div');
    messageElement.classList.add(message.sender);
    messageElement.setAttribute('data-message-id', message.id);
    messageElement.setAttribute('data-original-text', message.text);
    messageElement.setAttribute('data-is-html', message.isHtml);

    const container = document.createElement('div');
    container.className = 'message-container';

    const textContainer = document.createElement('span');
    textContainer.className = 'message-text';

    if (isStreaming) {
        // 如果是流式消息，初始化为空
        textContainer.textContent = '';
    } else {
        if (message.isHtml) {
            textContainer.innerHTML = message.text;
        } else {
            textContainer.innerHTML = renderMarkdown(message.text);
        }
    }

    container.appendChild(textContainer);

    // 判断是否为最后一个bot消息，并且是否有availableTasks
    if (isLastBotMessage() && message.availableTasks && message.availableTasks.length > 0) {
        const taskContainer = document.createElement('div');
        taskContainer.className = 'task-buttons-container';

        message.availableTasks.forEach(availableTask => {
            const button = document.createElement('button');
            button.textContent = availableTask.name;
            button.className = 'task-button';
            button.addEventListener('click', () => executeTask(availableTask.task));
            taskContainer.appendChild(button);
        });

        container.appendChild(taskContainer);
    }

    messageElement.appendChild(container);
    chatBox.appendChild(messageElement);
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// 判断是否为最后一个bot消息
function isLastBotMessage() {
    const chatBox = document.getElementById('chat-box');
    const messages = chatBox.getElementsByClassName('bot');
    return messages.length === 0 || messages[messages.length - 1] === chatBox.lastElementChild;
}

function updateBotMessage(messageId, text, availableTasks) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        const textContainer = messageElement.querySelector('.message-text');
        if (textContainer && text !== undefined && text !== null) {
            // 更新存储的原始文本
            messageElement.setAttribute('data-original-text', messageElement.getAttribute('data-original-text') + text);

            const isHtml = messageElement.getAttribute('data-is-html') === 'true';
            if (isHtml) {
                textContainer.innerHTML = messageElement.getAttribute('data-original-text');
            } else {
                textContainer.innerHTML = renderMarkdown(messageElement.getAttribute('data-original-text'));
            }
        }

        const container = messageElement.querySelector('.message-container');
        // 移除旧的任务按钮容器（如果存在）
        const oldTaskContainer = container.querySelector('.task-buttons-container');
        if (oldTaskContainer) {
            container.removeChild(oldTaskContainer);
        }
        // 添加新的任务按钮
        if (availableTasks && availableTasks.length > 0) {
            const taskContainer = document.createElement('div');
            taskContainer.className = 'task-buttons-container';
            availableTasks.forEach(task => {
                const button = document.createElement('button');
                button.textContent = task.name;
                button.className = 'task-button';
                button.addEventListener('click', () => executeTask(task));
                taskContainer.appendChild(button);
            });
            container.appendChild(taskContainer);
        }
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
}

function displayThread(thread) {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = ''; // 清除现有消息
    thread.messages.forEach(message => {
        if (message.sender === 'user') {
            displayUserMessage(message);
        } else if (message.sender === 'bot') {
            displayBotMessage(message);
        }
    });
    addEditButtons();
}

function sendMessageHandler() {
    if (isBotResponding) return;  // 如果 bot 正在回复，不允许发送新消息

    const userInput = document.getElementById('user-input');
    const userInput_value = userInput.value.trim();

    if (userInput_value) {
        isBotResponding = true;  // 设置标志，表示 bot 开始回复
        const messageId = 'msg_' + Math.random().toString(36).substr(2, 9);
        const message = {
            type: 'sendMessage',
            threadId: window.threadId,
            messageId: messageId,
            message: userInput_value
        };
        console.log(message);
        window.vscode.postMessage(message);

        userInput.value = '';
    }
}

function sendMessage(text, actionAttributes = null) {
    const messageId = 'msg_' + Math.random().toString(36).substr(2, 9);
    const message = {
        type: 'sendMessage',
        threadId: window.threadId,
        messageId: messageId,
        message: text,
        actionAttributes: actionAttributes
    };

    window.vscode.postMessage(message);
}

function displayTaskButtons(tasks) {
    const taskButtonsContainer = document.getElementById('task-buttons');
    taskButtonsContainer.innerHTML = ''; // 清除现有按钮

    tasks.forEach(task => {
        const button = document.createElement('button');
        button.textContent = task.name;
        button.addEventListener('click', () => executeTask(task));
        taskButtonsContainer.appendChild(button);
    });
}

function executeTask(task) {
    const userMessage = task.message;
    displayUserMessage({
        id: 'user_' + Date.now(),
        sender: 'user',
        text: userMessage,
        timestamp: Date.now(),
        threadId: window.threadId
    });

    const message = {
        type: 'executeTask',
        threadId: window.threadId,
        taskName: task.name,
        message: task.message
    };
    window.vscode.postMessage(message);
}