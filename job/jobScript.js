// jobScript.js

window.onload = function () {
    const threadId = window.threadId;
    if (threadId) {
        loadThread(threadId);
    }
};

function loadThread(threadId) {
    window.vscode.postMessage({
        type: 'getJobs',
        threadId: threadId
    });
}

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'loadThread':
            displayThread(message.thread);
            break;
        // 处理其他与 job 相关的消息
    }
});

function displayThread(thread) {
    // 渲染 job 列表或详情
}