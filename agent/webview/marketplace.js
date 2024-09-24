const vscode = acquireVsCodeApi();

function installAgent(agentName) {
    vscode.postMessage({ command: 'installAgent', agentName: agentName });
}

function renderAgentList(agents) {
    const agentListElement = document.getElementById('agentList');
    agentListElement.innerHTML = agents.map(agent => `
        <div class="agent-item" data-name="${agent.name.toLowerCase()}">
            <h3>${agent.name} (v${agent.version})</h3>
            <p>${agent.description}</p>
            <button class="install-btn" onclick="installAgent('${agent.name}')">Install</button>
        </div>
    `).join('');
}

// 搜索功能
const searchBar = document.getElementById('searchBar');
searchBar.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const agentItems = document.querySelectorAll('.agent-item');
    agentItems.forEach(item => {
        const agentName = item.getAttribute('data-name');
        if (agentName.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
});

// 接收来自扩展的消息
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'updateAgentList':
            renderAgentList(message.agents);
            break;
    }
});

// 初始化时请求代理列表
vscode.postMessage({ command: 'getAgentList' });