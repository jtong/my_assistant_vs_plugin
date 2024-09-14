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

document.getElementById('load-file-btn').addEventListener('click', () => {
    const filePath = document.getElementById('file-path').value;
    window.vscode.postMessage({
        type: 'loadContext',
        threadId: window.threadId,
        filePath: filePath
    });
});

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'loadThread':
            displayThread(message.thread);
            break;
        case 'contextLoaded':
            displayGeneratedJobs(message.jobs);
            break;
        // ... 其他 case ...
    }
});

function displayGeneratedJobs(jobs) {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';
    jobs.forEach(job => {
        const li = document.createElement('li');
        li.textContent = `${job.name}: ${job.description}`;
        taskList.appendChild(li);
    });
}

function displayThread(thread) {
    // 渲染 job 列表或详情
}