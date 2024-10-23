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

// 添加新的 JavaScript 函数
function toggleEditMode() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.classList.toggle('edit-mode');
    document.getElementById('edit-btn').style.display = chatContainer.classList.contains('edit-mode') ? 'none' : 'block';
    document.getElementById('done-btn').style.display = chatContainer.classList.contains('edit-mode') ? 'block' : 'none';
    document.getElementById('delete-selected-btn').style.display = chatContainer.classList.contains('edit-mode') ? 'block' : 'none';

    // 显示或隐藏复选框
    const checkboxes = document.querySelectorAll('.message-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.style.display = chatContainer.classList.contains('edit-mode') ? 'inline-block' : 'none';
    });
}


function deleteSelectedMessages() {
    const selectedMessages = document.querySelectorAll('.message-checkbox:checked');
    const messageIds = Array.from(selectedMessages).map(checkbox => {
        // 从复选框开始，向上遍历 DOM 树，直到找到带有 data-message-id 属性的元素
        let element = checkbox;
        while (element && !element.dataset.messageId) {
            element = element.parentElement;
        }
        return element ? element.dataset.messageId : null;
    }).filter(id => id !== null);

    if (messageIds.length > 0) {
        window.vscode.postMessage({
            type: 'deleteMessages',
            threadId: window.threadId,
            messageIds: messageIds
        });
    }

    toggleEditMode();
}

document.getElementById('edit-btn').addEventListener('click', toggleEditMode);
document.getElementById('done-btn').addEventListener('click', toggleEditMode);
document.getElementById('delete-selected-btn').addEventListener('click', deleteSelectedMessages);


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
    const chatBox = document.getElementById('chat-box');
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

                // 计算 chat-box 的宽度
                const chatBoxWidth = chatBox.offsetWidth;
                const textareaWidth = Math.floor(chatBoxWidth * 0.8); // 80% 的宽度

                const textarea = document.createElement('textarea');
                textarea.value = originalText;
                textarea.style.width = `${textareaWidth}px`; // 设置精确的像素宽度
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

}

let selectedFilePath = null; // 用于暂存选中的文件路径

document.getElementById('add-initial-file-btn').addEventListener('click', addInitialFileHandler);

function addInitialFileHandler() {
    // 发送消息到后端，让后端处理文件选择
    window.vscode.postMessage({
        type: 'selectInitialFile',
        threadId: window.threadId
    });
}


function showFileSelectedHint(fileName) {
    // 在界面上显示已选中的文件名，您可以自定义样式和位置
    const hintElement = document.getElementById('file-selected-hint');
    if (!hintElement) {
        const newHintElement = document.createElement('div');
        newHintElement.id = 'file-selected-hint';
        newHintElement.textContent = `已选文件：${fileName}`;
        // 将提示添加到输入框下方
        const userInput = document.getElementById('add-initial-file-btn');
        userInput.parentNode.insertBefore(newHintElement, userInput.nextSibling);
    } else {
        hintElement.textContent = `已选文件：${fileName}`;
    }
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
        case 'messagesDeleted':
            message.messageIds.forEach(id => {
                const messageElement = document.querySelector(`[data-message-id="${id}"]`);
                if (messageElement) {
                    messageElement.remove();
                }
            });
            break;
        case 'fileSelected':
            selectedFilePath = message.filePath; // 暂存文件路径
            // 在界面上显示已选中的文件名
            showFileSelectedHint(message.fileName);
            break;
        case 'markerAdded':
            addMarkerLine(message.markerId);
            break;    
        // ...其他 case    
    }
});



function addMarkerLine(markerId) {
    const markerLine = document.createElement('div');
    markerLine.className = 'marker-line';
    markerLine.setAttribute('data-marker-id', markerId);
    
    const chatBox = document.getElementById('chat-box');
    chatBox.appendChild(markerLine);
}



// 定义显示操作项的函数
function displayOperations(operations) {
    const container = document.getElementById('operations-container');
    container.innerHTML = ''; // 清除现有内容

    let hasFileUploadOperation = false;

    operations.forEach(operation => {
        if (operation.type === 'setting' && operation.control === 'select') {
            // 创建下拉框
            const select = document.createElement('select');
            select.id = `operation-${operation.settingKey}`;

            // 创建选项
            operation.options.forEach(option => {
                const optionElement = document.createElement('option');
                if (typeof option === 'string') {
                    optionElement.value = option;
                    optionElement.textContent = option;
                } else {
                    // 只有当 value 是对象时才进行 JSON 转换
                    optionElement.value = typeof option.value === 'object' ? JSON.stringify(option.value) : option.value;
                    optionElement.textContent = option.label;
                }
                select.appendChild(optionElement);
            });

            // 设置默认值
            let currentValue = window.currentSettings[operation.settingKey] || operation.default;
            if (typeof currentValue === 'object') {
                debugger;
                currentValue = JSON.stringify(currentValue);
            }
            select.value = currentValue || (typeof operation.options[0] === 'string' ? operation.options[0] : 
                (typeof operation.options[0].value === 'object' ? JSON.stringify(operation.options[0].value) : operation.options[0].value));

            // 监听选择变化事件
            select.addEventListener('change', function () {
                let selectedValue = this.value;
                try {
                    // 尝试解析为 JSON，如果失败则保持原样（字符串）
                    selectedValue = JSON.parse(selectedValue);
                } catch (e) {
                    // 值不是有效的 JSON，保持为字符串
                }
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
        } else if (operation.type === 'task' && operation.control === 'button') {
            // 创建按钮
            const button = document.createElement('button');
            button.textContent = operation.name;
            button.addEventListener('click', () => executeTask(operation.task));
            container.appendChild(button);
        }

        if (operation.type === 'file_upload') {
            hasFileUploadOperation = true;
        }
    });

    // 更新文件上传按钮的可见性
    const addInitialFileBtn = document.getElementById('add-initial-file-btn');
    addInitialFileBtn.style.display = hasFileUploadOperation ? 'block' : 'none';
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

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'message-checkbox';
    messageElement.appendChild(checkbox);

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

    if (message.filePath) {
        const fileLink = document.createElement('a');
        fileLink.href = '#';
        fileLink.textContent = '查看附件';
        fileLink.addEventListener('click', () => {
            // 发送消息到后端，打开文件
            window.vscode.postMessage({
                type: 'openAttachedFile',
                threadId: window.threadId,
                filePath: message.filePath
            });
        });
        textContainer.appendChild(fileLink);
        textContainer.appendChild(document.createElement('br')); // 换行
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
    const messageElement = createMessageElement(message);

    if (isStreaming) {
        messageElement.querySelector('.message-text').textContent = '';
    }
    if (message.availableTasks && message.availableTasks.length > 0) {
        addTaskButtons(messageElement, message.availableTasks);
    }

    chatBox.appendChild(messageElement);
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function addTaskButtons(container, availableTasks) {
    const taskContainer = document.createElement('div');
    taskContainer.className = 'task-buttons-container';

    availableTasks.forEach(availableTask => {
        const button = document.createElement('button');
        button.textContent = availableTask.name;
        button.className = 'task-button';
        button.addEventListener('click', () => executeTask(availableTask.task));
        taskContainer.appendChild(button);
    });

    container.querySelector('.message-container').appendChild(taskContainer);
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
            availableTasks.forEach(availableTask => {
                const button = document.createElement('button');
                button.textContent = availableTask.name;
                button.className = 'task-button';
                button.addEventListener('click', () => executeTask(availableTask.task));
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
        if (message.type === 'marker') {
            addMarkerLine(message.id);
        } else if (message.sender === 'user') {
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
        const message = {
            type: 'sendMessage',
            threadId: window.threadId,
            message: userInput_value
        };

        if (selectedFilePath) {
            message.filePath = selectedFilePath;
            selectedFilePath = null; // 发送后清除暂存的文件路径

            // 移除界面上的提示
            const hintElement = document.getElementById('file-selected-hint');
            if (hintElement) {
                hintElement.remove();
            }
        }
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
    // if (!task.skipUserMessage) {
    //     const userMessage = task.message;
    //     displayUserMessage({
    //         id: 'msg_' + Date.now(),
    //         sender: 'user',
    //         text: userMessage,
    //         timestamp: Date.now(),
    //         threadId: window.threadId
    //     });
    // }
    const message = {
        type: 'executeTask',
        threadId: window.threadId,
        task: task,
    };
    window.vscode.postMessage(message);
}



