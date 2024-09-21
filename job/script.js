// jobScript.js

window.onload = function () {
    const threadId = window.threadId;
    if (threadId) {
        loadThread(threadId);
    }

    document.getElementById('load-file-btn').addEventListener('click', () => {
        const filePath = document.getElementById('file-path').value;
        window.vscode.postMessage({
            type: 'loadContext',
            threadId: window.threadId,
            filePath: filePath
        });
    });
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
        case 'loadJobs':
            displayGeneratedJobs(message.jobs);
            break;
        case 'contextLoaded':
            displayGeneratedJobs(message.jobs);
            break;
        case 'jobUpdated':
            displayGeneratedJobs(message.jobs);
            break;    
        // ... 其他 case ...
    }
});

window.global = {};

function displayGeneratedJobs(jobs) {
    // 按索引排序
    jobs.sort((a, b) => a.index - b.index);

    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';
    jobs.forEach(job => {
        const li = document.createElement('li');
        li.className = 'task-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.id = `task-${job.index}`;
        checkbox.checked = job.availableTask.status === 'completed';

        const label = document.createElement('label');
        label.htmlFor = `task-${job.index}`;
        label.className = 'task-label';
        label.textContent = `[${job.index}] ${job.availableTask.name}: ${job.availableTask.task.message} (Status: ${job.availableTask.status})`;

        li.appendChild(checkbox);
        li.appendChild(label);
        taskList.appendChild(li);

        // 为复选框添加事件监听
        checkbox.addEventListener('change', function(event) {
            if (this.checked) {
                // 执行任务
                window.vscode.postMessage({
                    type: 'executeJob',
                    threadId: window.threadId,
                    jobIndex: job.index
                });
            }
            // 阻止事件冒泡
            event.stopPropagation();
        });
    });
}
