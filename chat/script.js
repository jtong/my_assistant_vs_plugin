let isBotResponding = false;

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
        if (!message.querySelector('.edit-btn')) {
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.className = 'edit-btn';
            editBtn.onclick = function() {
                const textContainer = message.querySelector('.message-text');
                const messageId = message.getAttribute('data-message-id');
                const originalText = textContainer.textContent;
                
                const editWrapper = document.createElement('div');
                editWrapper.className = 'edit-wrapper';
                
                const textarea = document.createElement('textarea');
                textarea.value = originalText;
                editWrapper.appendChild(textarea);
                
                const saveBtn = document.createElement('button');
                saveBtn.textContent = 'Save';
                saveBtn.className = 'save-btn';
                editWrapper.appendChild(saveBtn);
                
                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Cancel';
                cancelBtn.className = 'cancel-btn';
                editWrapper.appendChild(cancelBtn);
                
                message.insertBefore(editWrapper, textContainer);
                textContainer.style.display = 'none';
                editBtn.style.display = 'none';
                
                saveBtn.onclick = function() {
                    const newText = textarea.value;
                    textContainer.textContent = newText;
                    textContainer.style.display = '';
                    editWrapper.remove();
                    editBtn.style.display = '';
                    
                    window.vscode.postMessage({
                        type: 'editMessage',
                        threadId: window.threadId,
                        messageId: messageId,
                        newText: newText
                    });
                };
                
                cancelBtn.onclick = function() {
                    textContainer.style.display = '';
                    editWrapper.remove();
                    editBtn.style.display = '';
                };
            };
            message.appendChild(editBtn);
        }
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
            updateBotMessage(message.messageId, message.text);
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
    }
});

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

// 修改 displayUserMessage 函数
function displayUserMessage(message) {
    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('div');
    messageElement.classList.add(message.sender);
    messageElement.setAttribute('data-message-id', message.id);

    const textContainer = document.createElement('span');
    textContainer.className = 'message-text';
    textContainer.textContent = message.text;
    messageElement.appendChild(textContainer);

    chatBox.appendChild(messageElement);
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function updateBotMessage(messageId, text) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        const textContainer = messageElement.querySelector('.message-text');
        if (textContainer) {
            textContainer.textContent += text;
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }
}

function displayBotMessage(message, isStreaming = false) {
    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('div');
    messageElement.classList.add(message.sender);
    messageElement.setAttribute('data-message-id', message.id);

    const textContainer = document.createElement('span');
    textContainer.className = 'message-text';

    if (isStreaming) {
        // 如果是流式消息，初始化为空
        textContainer.textContent = '';
    } else {
        // 如果不是流式消息，使用原来的逻辑
        if (message.isHtml) {
            textContainer.innerHTML = message.text;
        } else {
            textContainer.textContent = message.text;
        }
    }

    messageElement.appendChild(textContainer);
    chatBox.appendChild(messageElement);
    // 自动滚动到底部
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });

    if (message.isHtml) {
        setupForms(messageElement, message.id);
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
    const message = {
        type: 'executeTask',
        threadId: window.threadId,
        taskName: task.name
    };
    window.vscode.postMessage(message);
}


function setupForms(container, messageId) {
    container.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            const formData = new FormData(form);
            // 处理表单提交
            window.vscode.postMessage({
                type: 'updateMessage',
                threadId: window.threadId,
                messageId: messageId,
                updates: { formSubmitted: true }
            });
            form.querySelector('input[type="submit"]').style.display = 'none';
            form.querySelector('.cancel-btn').style.display = 'none';
        });

        form.querySelector('.cancel-btn').addEventListener('click', function () {
            form.querySelector('input[type="submit"]').style.display = 'none';
            this.style.display = 'none';
            window.vscode.postMessage({
                type: 'updateMessage',
                threadId: window.threadId,
                messageId: messageId,
                updates: { formSubmitted: true }
            });
        });
    });
}

