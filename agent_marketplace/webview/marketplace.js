const vscode = acquireVsCodeApi();

let allAgents = [];

function installAgent(agentName) {
    vscode.postMessage({ command: 'installAgent', agentName: agentName });
}

function renderAgentList(agents) {
    const agentListElement = document.getElementById('agentList');
    agentListElement.innerHTML = agents.map(agent => `
        <div class="agent-item" data-name="${agent.name.toLowerCase()}" data-description="${agent.description.toLowerCase()}">
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
    const filteredAgents = allAgents.filter(agent => 
        agent.name.toLowerCase().includes(searchTerm) || 
        agent.description.toLowerCase().includes(searchTerm)
    );
    renderAgentList(filteredAgents);
});

// 接收来自扩展的消息
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'updateAgentList':
            allAgents = message.agents;
            renderAgentList(message.agents);
            break;
    }
});

// 初始化时请求代理列表
vscode.postMessage({ command: 'getAgentList' });