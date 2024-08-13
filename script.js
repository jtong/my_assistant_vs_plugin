document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keydown', function (event) {
    // 当用户按下回车键且没有按住Shift键时发送消息
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // 防止默认的换行行为
        sendMessage();
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
                    loadMessages(window.threadId); // 重新加载消息，此时应为空
                }
            })
            .catch(error => console.error('清除对话时出错:', error));
    }
}

window.onload = function () {

    // 其他已有的初始化代码
    const urlParams = new URLSearchParams(window.location.search);
    const threadIdFromUrl = urlParams.get('threadId');

    if (threadIdFromUrl) {
        window.threadId = threadIdFromUrl;
        loadMessages(threadIdFromUrl);
    }
};





function loadMessages(threadId) {
    fetch('/thread/' + threadId)
        .then(response => response.json())
        .then(messages => {
            const chatBox = document.getElementById('chat-box');
            chatBox.innerHTML = ''; // 清空当前聊天框中的内容
            messages.forEach(message => {
                // 根据sender类型添加不同的处理
                if (message.sender === 'user') {
                    // 如果消息是用户发送的
                    displayUserMessage(message.text, message.sender, message.id);
                } else if (message.sender === 'bot') {
                    // 如果消息是机器人发送的
                    displayBotMessage(message, message.sender, message.id, message.additionalData);
                }
            });
        });
}

function sendMessage(messageContent, actionAttributes = null) {
    const userInput = document.getElementById('user-input').value;
    document.getElementById('user-input').value = "";
    const threadId = window.threadId || createThread(); // 确保有一个有效的线程 ID
    const messageId = 'msg_' + Math.random().toString(36).substr(2, 9);

    let messageData = {
        message: actionAttributes ? messageContent : userInput,
        threadId,
        messageId,
        // 如果存在动作属性，将其包含在发送的数据中
        actionAttributes: actionAttributes,
    };

    // 显示用户输入
    displayUserMessage(messageData.message, 'user', messageId);

    fetch('/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
    })
        .then(response => response.json())
        .then(data => {
            // 显示消息等
            if (actionAttributes) {
                console.log('处理动作执行事件的响应');
            } else {
                // 处理普通消息的逻辑
                
            }
            //displayBotMessage(data.message, data.message.sender, data.message.id, data.message.additionalData);
            loadMessages(data.message.threadId); // 在这里调用 loadMessages 函数，确保使用正确的 threadId

        })
        .catch(error => console.error('发送消息时出错:', error));
}

function updateFormStatus(threadId, messageId, submitted) {
    fetch('/form-submitted', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ threadId: threadId, messageId: messageId, submitted: submitted })
    })
        .then(response => response.json())
        .then(data => {
            // 处理响应
            console.log('Form status updated:', data);
        })
        .catch(error => {
            // 处理错误
            console.error('Error updating form status:', error);
        });
}

function displayUserMessage(message, sender, messageId) {
    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('div');
    messageElement.classList.add(sender);
    messageElement.textContent = message;
    if (messageId) {
        messageElement.setAttribute('data-message-id', messageId);
    }
    chatBox.appendChild(messageElement);
}

function displayBotMessage(message, sender, messageId, additionalData) {
    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('div');
    messageElement.classList.add(sender);

    // 检查消息是否包含HTML内容
    if (message.isHtml) {
        displayHtml(message.text, message);
    } else {
        // 如果不是HTML，设置textContent以避免HTML注入
        messageElement.textContent = message.text;
    }

    // 根据additionalData渲染额外的元素
    if (additionalData && additionalData.buttons && !message.ignoreButtons) {
        const anyButtonClicked = Object.values(additionalData.buttons).some(value => value === true);

        Object.keys(additionalData.buttons).forEach(buttonName => {
            const buttonElement = document.createElement('button');
            buttonElement.textContent = buttonName;
            // 如果有任何按钮被点击，仅显示被点击的按钮，并使其不可点击
            if (anyButtonClicked) {
                if (additionalData.buttons[buttonName]) {
                    // 按钮被点击，显示并禁用
                    buttonElement.disabled = true;
                } else {
                    // 隐藏未被点击的按钮
                    return;
                }
            }
            buttonElement.addEventListener('click', function () {
                // 构建动作属性对象
                const actionAttributes = { 
                    action: buttonName,
                    value: true 
                };
                // 调用 sendMessage 函数并传递动作属性
                sendMessage(`动作执行: ${buttonName}`, actionAttributes);
            });
            messageElement.appendChild(buttonElement);
        });
    }

    if (messageId) {
        messageElement.setAttribute('data-message-id', messageId);
    }

    chatBox.appendChild(messageElement);
}

function displayHtml(htmlContent, message) {
    var chatBox = document.getElementById('chat-box');
    var htmlContainer = document.createElement('div');
    htmlContainer.innerHTML = htmlContent;
    chatBox.appendChild(htmlContainer);

    // 使用传入的 message 对象来判断表单是否已提交
    if (message && message.formSubmitted) {
        // 如果表单已提交，隐藏提交和取消按钮
        htmlContainer.querySelector('input[type="submit"]').style.display = 'none';
        htmlContainer.querySelector('.cancel-btn').style.display = 'none';
    }

    // 为每个新增的特殊表单添加事件监听器
    htmlContainer.querySelectorAll('form').forEach(form => {
        setupForm(form, message.id);
    });
}

function setupForm(form, messageId) {
    form.addEventListener('submit', function (event) {
        event.preventDefault(); // 阻止表单默认提交
        var actionUrl = form.getAttribute('action'); // 获取表单的提交地址

        // 获取表单数据并发送
        var formData = new FormData(form);
        fetch(actionUrl, {  // 使用表单的 action URL
            method: 'POST',
            body: formData
        }).then(response => {
            // 处理响应
            // ...
            console.log(response);
        }).catch(error => {
            // 处理错误
            // ...
            console.log(error);

        });

        // 隐藏提交和取消按钮
        form.querySelector('input[type="submit"]').style.display = 'none';
        form.querySelector('.cancel-btn').style.display = 'none';

        // 更新表单提交状态
        updateFormStatus(window.threadId, messageId, true);
    });

    // 为取消按钮绑定事件
    form.querySelector('.cancel-btn').addEventListener('click', function () {
        form.querySelector('input[type="submit"]').style.display = 'none';
        this.style.display = 'none';
        updateFormStatus(window.threadId, messageId, true);

    });
}
