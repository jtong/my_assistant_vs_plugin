// app/appInterfaceManager.js
const path = require('path');
const fs = require('fs');

class AppInterfaceManager {
    constructor(context) {
        const projectRoot = context.workspaceState.get('projectRoot');
        this.appPath = path.join(projectRoot, '.ai_helper', 'agent', 'app');;
        this.interfaces = new Map();
        this.ensureConfigFile();
        this.appsConfig = this.loadAppsConfig();
    }

    ensureConfigFile() {
        const configPath = path.join(this.appPath, 'apps.json');
        if (!fs.existsSync(this.appPath)) {
            fs.mkdirSync(this.appPath, { recursive: true });
        }
        if (!fs.existsSync(configPath)) {
            const defaultConfig = {
                apps: []
            };
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            console.log(`Initialized default config at ${configPath}`);
        }
    }

    loadAppsConfig() {
        const configPath = path.join(this.appPath, 'apps.json');
        if (!fs.existsSync(configPath)) {
            throw new Error(`Apps configuration file not found: ${configPath}`);
        }
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    }

    async createInterface(interfaceId, appName) {
        const appConfig = this.appsConfig.apps.find(app => app.name === appName);
        if (!appConfig) {
            throw new Error(`App configuration not found for: ${appName}`);
        }

        const appPath = path.join(this.appPath, appConfig.path);
        if (!fs.existsSync(appPath)) {
            throw new Error(`App file not found: ${appPath}`);
        }

        const AppClass = require(appPath);
        const appInterface = new AppClass(appConfig.metadata);
        await appInterface.init(); // 假设有一个初始化方法
        this.interfaces.set(interfaceId, appInterface);
        return appInterface;
    }

    getInterface(interfaceId) {
        return this.interfaces.get(interfaceId);
    }

    async updateInterface(interfaceId, appName) {
        if (this.interfaces.has(interfaceId)) {
            await this.interfaces.get(interfaceId).destroy(); // 假设有一个销毁方法
            this.interfaces.delete(interfaceId);
        }
        return this.createInterface(interfaceId, appName);
    }

    async destroyInterface(interfaceId) {
        if (this.interfaces.has(interfaceId)) {
            await this.interfaces.get(interfaceId).destroy();
            this.interfaces.delete(interfaceId);
        }
    }

    getAvailableApps() {
        return this.appsConfig.apps.map(app => app.name);
    }
}

module.exports = AppInterfaceManager;