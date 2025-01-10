// app/webview/appList.js

class AppList {
    constructor() {
        console.log('AppList: Initializing');
        this.container = document.createElement('div');
        this.container.id = 'app-list-container';
        this.container.className = 'app-list';
        this.apps = [];
    }

    render() {
        console.log('AppList: Rendering with apps:', this.apps);
        this.container.innerHTML = `
            <div class="app-list-header">
                <h2>Apps</h2>
                <button id="new-app-btn">New App</button>
            </div>
            <div class="app-items">
                ${this.renderAppItems()}
            </div>
        `;

        this.setupEventListeners();
        return this.container;
    }

    renderAppItems() {
        if (!this.apps || this.apps.length === 0) {
            return '<div class="no-apps">No apps available. Click "New App" to create one.</div>';
        }

        return this.apps.map(app => `
            <div class="app-item" data-app-id="${app.id}">
                <div class="app-item-header">
                    <span class="app-name">${app.name}</span>
                    <div class="app-actions">
                        <button class="edit-app-btn">Edit</button>
                        <button class="delete-app-btn">Delete</button>
                    </div>
                </div>
                <div class="app-config-container" id="app-config-${app.id}"></div>
            </div>
        `).join('');
    }

    setupEventListeners() {
        console.log('AppList: Setting up event listeners');
        const newAppBtn = this.container.querySelector('#new-app-btn');
        newAppBtn.addEventListener('click', () => this.handleNewApp());

        this.container.querySelectorAll('.edit-app-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const appItem = e.target.closest('.app-item');
                const appId = appItem.dataset.appId;
                this.handleEditApp(appId);
            });
        });

        this.container.querySelectorAll('.delete-app-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const appItem = e.target.closest('.app-item');
                const appId = appItem.dataset.appId;
                this.handleDeleteApp(appId);
            });
        });
    }

    handleNewApp() {
        console.log('AppList: Handling new app creation');
        vscode.postMessage({
            type: 'createApp'
        });
    }

    handleEditApp(appId) {
        console.log('AppList: Handling edit app:', appId);
        const configContainer = this.container.querySelector(`#app-config-${appId}`);
        if (configContainer) {
            vscode.postMessage({
                type: 'getAppConfig',
                appId: appId
            });
        }
    }

    handleDeleteApp(appId) {
        console.log('AppList: Handling delete app:', appId);
        vscode.postMessage({
            type: 'deleteApp',
            appId: appId
        });
    }

    updateApps(apps) {
        console.log('AppList: Updating apps:', apps);
        this.apps = apps;
        this.render();
    }

    updateAppConfig(appId, config) {
        console.log('AppList: Updating app config:', appId, config);
        const configContainer = this.container.querySelector(`#app-config-${appId}`);
        if (configContainer) {
            renderInterface(config, configContainer);
        }
    }
}

// 导出AppList类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppList;
} else {
    window.AppList = AppList;
}
