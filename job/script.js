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

window.global = {};

function displayGeneratedJobs(jobs) {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';
    jobs.forEach((job, index) => {
        const li = document.createElement('li');
        li.className = 'task-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.id = `task-${index}`;
        
        const label = document.createElement('label');
        label.htmlFor = `task-${index}`;
        label.className = 'task-label';
        label.textContent = `${job.name}: ${job.description}`;
        
        li.appendChild(checkbox);
        li.appendChild(label);
        taskList.appendChild(li);

        // 为复选框添加单独的事件监听器
        checkbox.addEventListener('change', function(event) {
            // 在这里可以添加复选框状态改变时的逻辑
            console.log(`Task ${index} checked: ${this.checked}`);
            // 阻止事件冒泡
            event.stopPropagation();
        });
    });
}

function displayThread(thread) {
    // 渲染 job 列表或详情
}