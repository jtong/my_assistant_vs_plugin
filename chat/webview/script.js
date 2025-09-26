let isBotResponding = false;
let isAutoScrollEnabled = true; // 自动滚屏状态，默认为ON
let isGenerating = false; // 标记是否正在生成响应
let selectedImage = null;

document.getElementById('add-image-btn').addEventListener('click', () => {
    document.getElementById('image-upload').click();
});

document.getElementById('image-upload').addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        selectedImage = file;
        showImageSelectedHint(file.name);
    }
});

function showImageSelectedHint(fileName) {
    const hintElement = document.getElementById('image-selected-hint');
    if (!hintElement) {
        const newHintElement = document.createElement('div');
        newHintElement.id = 'image-selected-hint';
        newHintElement.textContent = `已选图片：${fileName}`;
        const userInput = document.getElementById('add-image-btn');
        userInput.parentNode.insertBefore(newHintElement, userInput.nextSibling);
    } else {
        hintElement.textContent = `已选图片：${fileName}`;
    }
}




// 存储原始markdown文本与行号的映射关系
let markdownSourceMap = new Map();

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

// 自定义渲染规则，为每个块级元素添加源码行号信息
function addSourceLineMapping(ruleName) {
    const originalRule = md.renderer.rules[ruleName] || md.renderer.renderToken.bind(md.renderer);
    md.renderer.rules[ruleName] = function (tokens, idx, options, env, renderer) {
        const token = tokens[idx];
        if (token.map && token.map.length >= 2) {
            const startLine = token.map[0];
            const endLine = token.map[1];
            // 添加源码行号属性
            if (token.attrJoin) {
                token.attrJoin('data-source-lines', `${startLine},${endLine}`);
            } else {
                token.attrSet('data-source-lines', `${startLine},${endLine}`);
            }
        }
        return originalRule.call(this, tokens, idx, options, env, renderer);
    };
}

// 为主要的块级元素添加源码映射
['paragraph_open', 'heading_open', 'blockquote_open', 'code_block', 
 'fence', 'bullet_list_open', 'ordered_list_open', 'list_item_open'].forEach(addSourceLineMapping);

function renderMarkdown(text, messageId) {
    // 存储原始文本到映射表
    if (messageId) {
        markdownSourceMap.set(messageId, text.split('\n'));
    }
    
    const htmlContent = md.render(text);
    
    // 后处理：为没有行号信息的元素也添加映射
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // 为渲染后的元素添加消息ID引用
    if (messageId) {
        const blockElements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, pre, blockquote, ul, ol, li');
        blockElements.forEach(element => {
            element.setAttribute('data-message-id', messageId);
        });
    }
    
    return tempDiv.innerHTML;
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
document.getElementById('stop-btn').addEventListener('click', stopGenerationHandler);



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

function stopGenerationHandler() {
    if (isGenerating) {
        window.vscode.postMessage({
            type: 'stopGeneration',
            threadId: window.threadId
        });

        // 立即更新UI状态，不等待后端响应
        isGenerating = false;
        isBotResponding = false;
        hideStopButton();
    }
}

// 显示和隐藏停止按钮的函数
function showStopButton() {
    document.getElementById('stop-btn').style.display = 'inline-block';
}

function hideStopButton() {
    document.getElementById('stop-btn').style.display = 'none';
}

// 右键菜单相关变量
let contextMenu = null;

// 创建右键菜单
function createContextMenu() {
    if (contextMenu) {
        document.body.removeChild(contextMenu);
    }
    
    contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.innerHTML = `
        <div class="context-menu-item" id="copy-markdown-source">
            复制原始 Markdown
        </div>
    `;
    
    contextMenu.style.cssText = `
        position: fixed;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        padding: 4px 0;
        z-index: 10000;
        display: none;
        min-width: 150px;
    `;
    
    const menuItem = contextMenu.querySelector('#copy-markdown-source');
    menuItem.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        color: #333;
    `;
    
    menuItem.addEventListener('mouseenter', () => {
        menuItem.style.backgroundColor = '#f0f0f0';
    });
    
    menuItem.addEventListener('mouseleave', () => {
        menuItem.style.backgroundColor = '';
    });
    
    document.body.appendChild(contextMenu);
    return contextMenu;
}

// 提取选中区域的原始markdown片段
function extractSelectedMarkdownSource() {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
        return null;
    }
    
    // 获取选中范围
    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    
    // 找到包含选中内容的消息容器
    const messageContainer = commonAncestor.nodeType === Node.ELEMENT_NODE ? 
        commonAncestor.closest('[data-message-id]') : 
        commonAncestor.parentElement.closest('[data-message-id]');
    
    if (!messageContainer) {
        return null;
    }
    
    const messageId = messageContainer.getAttribute('data-message-id');
    if (!messageId || !markdownSourceMap.has(messageId)) {
        return null;
    }
    
    const originalLines = markdownSourceMap.get(messageId);
    
    // 获取选中范围内的所有块级元素
    const blockElements = [];
    const walker = document.createTreeWalker(
        commonAncestor,
        NodeFilter.SHOW_ELEMENT,
        {
            acceptNode: function(node) {
                // 检查节点是否与选中范围相交
                if (range.intersectsNode(node) && 
                    ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'BLOCKQUOTE', 'UL', 'OL', 'LI'].includes(node.tagName)) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
            }
        }
    );
    
    let node;
    while (node = walker.nextNode()) {
        blockElements.push(node);
    }
    
    if (blockElements.length === 0) {
        return null;
    }
    
    // 收集所有选中块的源码行号范围
    const sourceRanges = [];
    
    for (const element of blockElements) {
        const sourceLines = element.getAttribute('data-source-lines');
        if (sourceLines) {
            const [startLine, endLine] = sourceLines.split(',').map(Number);
            sourceRanges.push({ start: startLine, end: endLine });
        } else {
            // 如果没有行号信息，尝试通过内容匹配
            const matchedRange = findElementInSource(element, originalLines);
            if (matchedRange) {
                sourceRanges.push(matchedRange);
            }
        }
    }
    
    if (sourceRanges.length === 0) {
        return null;
    }
    
    // 合并连续或重叠的范围，并排序
    sourceRanges.sort((a, b) => a.start - b.start);
    const mergedRanges = [];
    let currentRange = sourceRanges[0];
    
    for (let i = 1; i < sourceRanges.length; i++) {
        const nextRange = sourceRanges[i];
        if (nextRange.start <= currentRange.end + 1) {
            // 范围连续或重叠，合并
            currentRange.end = Math.max(currentRange.end, nextRange.end);
        } else {
            // 不连续，保存当前范围，开始新范围
            mergedRanges.push(currentRange);
            currentRange = nextRange;
        }
    }
    mergedRanges.push(currentRange);
    
    // 提取所有范围的文本
    const extractedParts = mergedRanges.map(range => 
        originalLines.slice(range.start, range.end).join('\n')
    );
    
    return extractedParts.join('\n\n');
}

// 通过内容在源码中查找元素对应的范围
function findElementInSource(element, originalLines) {
    const elementText = element.textContent.trim();
    
    // 对于代码块，查找其中的代码内容
    if (element.tagName === 'PRE') {
        const codeElement = element.querySelector('code');
        const codeText = codeElement ? codeElement.textContent.trim() : elementText;
        
        // 在源码中查找匹配的代码块
        for (let i = 0; i < originalLines.length; i++) {
            if (originalLines[i].startsWith('```')) {
                let end = i + 1;
                let blockContent = '';
                
                // 收集代码块内容
                while (end < originalLines.length && !originalLines[end].startsWith('```')) {
                    blockContent += originalLines[end] + '\n';
                    end++;
                }
                
                // 检查内容是否匹配
                if (blockContent.trim() === codeText) {
                    return { start: i, end: end + 1 }; // 包含结束的```
                }
            }
        }
    }
    
    // 对于标题
    if (element.tagName.match(/^H[1-6]$/)) {
        const level = parseInt(element.tagName[1]);
        const prefix = '#'.repeat(level) + ' ';
        
        for (let i = 0; i < originalLines.length; i++) {
            if (originalLines[i].startsWith(prefix) && 
                originalLines[i].substring(prefix.length).trim() === elementText) {
                return { start: i, end: i + 1 };
            }
        }
    }
    
    // 对于段落，查找文本内容匹配的连续行
    if (element.tagName === 'P') {
        for (let i = 0; i < originalLines.length; i++) {
            if (originalLines[i].trim() && elementText.startsWith(originalLines[i].trim())) {
                // 找到段落的开始和结束
                let start = i;
                let end = i + 1;
                
                // 向前找段落真正的开始
                while (start > 0 && originalLines[start - 1].trim() !== '' && 
                       !originalLines[start - 1].startsWith('#') && 
                       !originalLines[start - 1].startsWith('```')) {
                    start--;
                }
                
                // 向后找段落结束
                while (end < originalLines.length && originalLines[end].trim() !== '' &&
                       !originalLines[end].startsWith('#') && 
                       !originalLines[end].startsWith('```')) {
                    end++;
                }
                
                return { start, end };
            }
        }
    }
    
    return null;
}

// 提取单个元素的原始markdown片段（保留原有功能作为备用）
function extractMarkdownSource(element) {
    const messageId = element.getAttribute('data-message-id');
    const sourceLines = element.getAttribute('data-source-lines');
    
    if (!messageId || !markdownSourceMap.has(messageId)) {
        return null;
    }
    
    const originalLines = markdownSourceMap.get(messageId);
    
    if (sourceLines) {
        // 有具体行号信息
        const [startLine, endLine] = sourceLines.split(',').map(Number);
        return originalLines.slice(startLine, endLine).join('\n');
    } else {
        // 使用新的查找方法
        const range = findElementInSource(element, originalLines);
        if (range) {
            return originalLines.slice(range.start, range.end).join('\n');
        }
    }
    
    return null;
}

// 显示右键菜单
function showContextMenu(event, element) {
    event.preventDefault();
    
    if (!contextMenu) {
        createContextMenu();
    }
    
    // 优先尝试提取选中内容的markdown源码
    let markdownSource = extractSelectedMarkdownSource();
    
    // 如果没有选中内容，则尝试提取单个元素的源码
    if (!markdownSource) {
        markdownSource = extractMarkdownSource(element);
    }
    
    if (!markdownSource) {
        return false;
    }
    
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
    contextMenu.style.display = 'block';
    
    // 绑定复制事件
    const copyMenuItem = contextMenu.querySelector('#copy-markdown-source');
    copyMenuItem.onclick = () => {
        copyToClipboard(markdownSource);
        hideContextMenu();
    };
    
    return true;
}

// 隐藏右键菜单
function hideContextMenu() {
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

window.onload = function () {
    const threadId = window.threadId;
    if (threadId) {
        loadThread(threadId);
    }

    const toggleScrollBtn = document.getElementById('toggle-scroll-btn');
    toggleScrollBtn.addEventListener('click', () => {
        isAutoScrollEnabled = !isAutoScrollEnabled; // 切换状态

        // 更新按钮文本和提示
        if (isAutoScrollEnabled) {
            toggleScrollBtn.textContent = 'Auto Scroll: ON';
            toggleScrollBtn.title = 'Turn Auto-Scroll OFF';
            toggleScrollBtn.classList.remove('auto-scroll-off'); // 可选：移除关闭状态的样式

        } else {
            toggleScrollBtn.textContent = 'Auto Scroll: OFF';
            toggleScrollBtn.title = 'Turn Auto-Scroll ON';
            toggleScrollBtn.classList.add('auto-scroll-off'); // 可选：添加关闭状态的样式
        }
    });

    // 根据启用预览与否调整某些UI行为
    if (!window.enablePreview) {
        // 如果没有启用预览，隐藏相关按钮和功能
        document.querySelector('.paragraph-toolbar').style.display = 'none';
    }
    
    // 添加右键菜单事件监听
    document.addEventListener('contextmenu', (event) => {
        const target = event.target;
        
        // 检查是否点击在消息内容的块级元素上
        if (target.closest('.message-text')) {
            const blockElement = target.closest('p, h1, h2, h3, h4, h5, h6, pre, blockquote, ul, ol, li');
            
            if (blockElement && blockElement.getAttribute('data-message-id')) {
                // 显示自定义右键菜单
                if (showContextMenu(event, blockElement)) {
                    return; // 阻止默认菜单
                }
            }
        }
        
        // 对于其他情况，隐藏自定义菜单
        hideContextMenu();
    });
    
    // 点击其他地方隐藏右键菜单
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.context-menu')) {
            hideContextMenu();
        }
    });
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

function appendBotMessage(messageId, text) {
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
                const messageId = messageElement.getAttribute('data-message-id');
                textContainer.innerHTML = renderMarkdown(messageElement.getAttribute('data-original-text'), messageId);
            }
        }

        if (isAutoScrollEnabled) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }
}

function updateBotMessage(messageId, text) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        const textContainer = messageElement.querySelector('.message-text');
        if (textContainer && text !== undefined && text !== null) {
            // 完全替换存储的原始文本
            messageElement.setAttribute('data-original-text', text);

            const isHtml = messageElement.getAttribute('data-is-html') === 'true';
            if (isHtml) {
                textContainer.innerHTML = text;
            } else {
                const messageId = messageElement.getAttribute('data-message-id');
                textContainer.innerHTML = renderMarkdown(text, messageId);
            }
        }

        if (isAutoScrollEnabled) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }
}

function addAvailableTasksToMessage(messageId, availableTasks) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement && availableTasks && availableTasks.length > 0) {
        const container = messageElement.querySelector('.message-container');

        // 移除旧的任务按钮容器（如果存在）
        const oldTaskContainer = container.querySelector('.task-buttons-container');
        if (oldTaskContainer) {
            container.removeChild(oldTaskContainer);
        }

        // 添加新的任务按钮
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
            isGenerating = true;
            showStopButton();
            break;
        case 'appendBotMessage':
            appendBotMessage(message.messageId, message.text);
            break;
        case 'updateBotMessage':
            updateBotMessage(message.messageId, message.text);
            break;
        case 'addAvailableTasks':
            addAvailableTasksToMessage(message.messageId, message.availableTasks);
            break;
        case 'botResponseComplete':
            isBotResponding = false;
            isGenerating = false;
            hideStopButton();
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
        case 'triggerRetry':
            retryMessageHandler();
            break;
        // ...其他 case    

        //markdown cases
        case 'updateMarkdown':
            if (window.enablePreview) {
                updateMarkdownPreview(message);
            }
            break;
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

    // 处理自定义背景色
    if (message.meta && message.meta._webview && message.meta._webview.message_bg_color) {
        messageElement.style.backgroundColor = message.meta._webview.message_bg_color;
    }

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
        textContainer.innerHTML = renderMarkdown(message.text, message.id);
    }

    // 处理文件附件
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

    // 处理图片附件
    if (message.imagePath) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'message-image-container';

        const image = document.createElement('img');
        image.src = message.imageUri; // 使用转换后的URI
        image.className = 'message-image';
        image.alt = '用户上传的图片';
        image.addEventListener('click', () => {
            // 打开图片
            window.vscode.postMessage({
                type: 'openImage',
                threadId: window.threadId,
                imagePath: message.imagePath
            });
        });

        imageContainer.appendChild(image);
        container.appendChild(imageContainer);
    }

    container.appendChild(textContainer);
    messageElement.appendChild(container);

    // 添加消息气泡的点击事件
    messageElement.addEventListener('click', (event) => {
        // 如果不在编辑模式下，不处理点击事件
        if (!document.getElementById('chat-container').classList.contains('edit-mode')) {
            return;
        }

        // 如果点击的是按钮、链接或复选框本身，不触发选中效果
        if (event.target.tagName === 'BUTTON' ||
            event.target.tagName === 'A' ||
            event.target.className === 'message-checkbox') {
            return;
        }

        // 切换复选框的状态
        const checkbox = messageElement.querySelector('.message-checkbox');
        checkbox.checked = !checkbox.checked;
    });

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

function attachFilePathToMessage(message) {
    if (selectedFilePath) {
        message.filePath = selectedFilePath;
        selectedFilePath = null; // 发送后清除暂存的文件路径

        // 移除界面上的提示
        const hintElement = document.getElementById('file-selected-hint');
        if (hintElement) {
            hintElement.remove();
        }
    }
}

function doSendMessage(message_text) {
    isBotResponding = true;  // 设置标志，表示 bot 开始回复
    const message = {
        type: 'sendMessage',
        threadId: window.threadId,
        message: message_text
    };

    attachFilePathToMessage(message);
    window.vscode.postMessage(message);
}

function sendMessageHandler() {
    if (isBotResponding) return;  // 如果 bot 正在回复，不允许发送新消息

    const userInput = document.getElementById('user-input');
    const userInput_value = userInput.value.trim();

    if (userInput_value || selectedImage) {
        const message = {
            type: 'sendMessage',
            threadId: window.threadId,
            message: userInput_value
        };

        // 处理图片
        if (selectedImage) {
            const reader = new FileReader();
            reader.onload = function (e) {
                message.imageData = {
                    name: selectedImage.name,
                    type: selectedImage.type,
                    data: e.target.result
                };
                window.vscode.postMessage(message);

                // 清除已选择的图片
                selectedImage = null;
                const hintElement = document.getElementById('image-selected-hint');
                if (hintElement) {
                    hintElement.remove();
                }

                userInput.value = '';
            };
            reader.readAsDataURL(selectedImage);
        } else {
            window.vscode.postMessage(message);
            userInput.value = '';
        }

        isBotResponding = true;  // 设置标志，表示 bot 开始回复
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

    if (isBotResponding) return;  // 如果 bot 正在回复，不允许发送新任务

    if (task.type === 'message') {
        doSendMessage(task.message);
    } else {
        const message = {
            type: 'executeTask',
            threadId: window.threadId,
            task: task,
        };
        window.vscode.postMessage(message);
    }
}