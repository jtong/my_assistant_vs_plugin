const vscode = acquireVsCodeApi();


let allAgents = {
    chat: [],
    job: [],
    app: []
};
let currentTab = 'chat';

function installAgent(agentName, agentType) {
    vscode.postMessage({ command: 'installAgent', agentName: agentName, agentType: agentType });
}

function renderAgentList(agents) {
    const agentListElement = document.getElementById('agentList');
    agentListElement.innerHTML = agents.map(agent => `
        <div class="agent-item" data-name="${agent.name.toLowerCase()}" data-description="${agent.description.toLowerCase()}">
            <h3>${agent.name} (v${agent.version})</h3>
            <p>${agent.description}</p>
            <button class="install-btn" onclick="installAgent('${agent.name}', '${agent.type}')">Install</button>
        </div>
    `).join('');
}

function filterAgents(searchTerm) {
    const filteredAgents = allAgents[currentTab].filter(agent => 
        agent.name.toLowerCase().includes(searchTerm) || 
        agent.description.toLowerCase().includes(searchTerm)
    );
    renderAgentList(filteredAgents);
}

// 搜索功能
const searchBar = document.getElementById('searchBar');
searchBar.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    filterAgents(searchTerm);
});

// 标签切换功能
const tabButtons = document.querySelectorAll('.tab-button');
tabButtons.forEach(button => {
    button.addEventListener('click', function() {
        currentTab = this.dataset.tab;
        tabButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        filterAgents(searchBar.value.toLowerCase());
    });
});

// 接收来自扩展的消息
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'updateAgentList':
            allAgents = message.agents;
            filterAgents(searchBar.value.toLowerCase());
            break;
    }
});

// 初始化时请求代理列表
vscode.postMessage({ command: 'getAgentList' });