document.getElementById('send-btn').addEventListener('click', sendMessageHandler);
document.getElementById('user-input').addEventListener('keydown', function (event) {
    // 当用户按下回车键且没有按住Shift键时发送消息
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // 防止默认的换行行为
        sendMessageHandler();
    }
});



document.getElementById('clear-thread-btn').addEventListener('click', clearThreadMessages);
function clearThreadMessages() {
    if (!window.threadId) {
        alert('没有选定的对话线程！');
        return;
    }

    if (confirm('确定要清除当前对话的所有消息吗？')) {
        fetch(`/clear-thread/${window.threadId}`, { method: 'DELETE' })
            .then(response => {
                if (response.ok) {
                    loadThread(window.threadId); // 重新加载消息，此时应为空
                }
            })
            .catch(error => console.error('清除对话时出错:', error));
    }
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

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'loadThread':
            displayThread(message.thread);
            break;
        case 'updateBotMessage':
            updateBotMessage(message.messageId, message.text);
            break;
    }
});

function updateBotMessage(messageId, text) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        messageElement.textContent = text;
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
}

function displayUserMessage(message) {
    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('div');
    messageElement.classList.add(message.sender);
    messageElement.textContent = message.text;
    messageElement.setAttribute('data-message-id', message.id);
    chatBox.appendChild(messageElement);
}

function displayBotMessage(message) {
    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('div');
    messageElement.classList.add(message.sender);

    if (message.isHtml) {
        messageElement.innerHTML = message.text;
    } else {
        messageElement.textContent = message.text;
    }

    if (message.additionalData && message.additionalData.buttons) {
        Object.keys(message.additionalData.buttons).forEach(buttonName => {
            const buttonElement = document.createElement('button');
            buttonElement.textContent = buttonName;
            buttonElement.disabled = message.additionalData.buttons[buttonName];
            buttonElement.addEventListener('click', function () {
                const actionAttributes = {
                    action: buttonName,
                    value: true
                };
                sendMessage(`动作执行: ${buttonName}`, actionAttributes);
            });
            messageElement.appendChild(buttonElement);
        });
    }

    messageElement.setAttribute('data-message-id', message.id);
    chatBox.appendChild(messageElement);

    if (message.isHtml) {
        setupForms(messageElement, message.id);
    }
}

function sendMessageHandler() {
    const userInput = document.getElementById('user-input');
    const userInput_value = userInput.value.trim();

    if (userInput_value) {
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