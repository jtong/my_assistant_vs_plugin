// app/appInterfaceManager.js
const path = require('path');
const fs = require('fs');

class AppInterfaceManager {
    constructor(context) {
        const projectRoot = context.workspaceState.get('projectRoot');
        this.appPath = path.join(projectRoot, '.ai_helper', 'agent', 'app');
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

    saveAppsConfig() {
        const configPath = path.join(this.appPath, 'apps.json');
        fs.writeFileSync(configPath, JSON.stringify(this.appsConfig, null, 2));
    }

    async createApp(appName) {
        // Check if app name already exists
        if (this.appsConfig.apps.some(app => app.name === appName)) {
            throw new Error(`App with name ${appName} already exists`);
        }

        // Create app directory
        const appDir = path.join(this.appPath, appName);
        fs.mkdirSync(appDir, { recursive: true });

        // Create default app configuration
        const appConfig = {
            name: appName,
            path: `./${appName}/index.js`,
            metadata: {
                title: appName,
                description: '',
                version: '1.0.0',
                config: {
                    blocks: []
                }
            }
        };

        // Create default app implementation
        const appImplementation = `
class ${appName} {
    constructor(metadata) {
        this.metadata = metadata;
    }

    async init() {
        // Initialize your app here
    }

    getConfig() {
        return this.metadata.config;
    }

    handleEvent(componentId, eventName, value, inputs) {
        // Handle your app events here
        return null;
    }

    async destroy() {
        // Clean up your app here
    }
}

module.exports = ${appName};
`;

        fs.writeFileSync(path.join(appDir, 'index.js'), appImplementation);

        // Add app to config
        this.appsConfig.apps.push(appConfig);
        this.saveAppsConfig();

        return appConfig;
    }

    async deleteApp(appId) {
        const appConfig = this.appsConfig.apps.find(app => app.name === appId);
        if (!appConfig) {
            throw new Error(`App with id ${appId} not found`);
        }

        // Remove app directory
        const appDir = path.join(this.appPath, appId);
        if (fs.existsSync(appDir)) {
            fs.rmSync(appDir, { recursive: true });
        }

        // Remove app from config
        this.appsConfig.apps = this.appsConfig.apps.filter(app => app.name !== appId);
        this.saveAppsConfig();
    }

    async getAppConfig(appId) {
        const appConfig = this.appsConfig.apps.find(app => app.name === appId);
        if (!appConfig) {
            throw new Error(`App with id ${appId} not found`);
        }

        return appConfig.metadata.config;
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
        await appInterface.init();
        this.interfaces.set(interfaceId, appInterface);
        return appInterface;
    }

    getInterface(interfaceId) {
        return this.interfaces.get(interfaceId);
    }

    async updateInterface(interfaceId, appName) {
        if (this.interfaces.has(interfaceId)) {
            await this.interfaces.get(interfaceId).destroy();
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
        return this.appsConfig.apps.map(app => ({
            id: app.name,
            name: app.name,
            description: app.metadata.description,
            version: app.metadata.version
        }));
    }

    async renameApp(appId, newName) {
        const appConfig = this.appsConfig.apps.find(app => app.name === appId);
        if (!appConfig) {
            throw new Error(`App with id ${appId} not found`);
        }

        // Check if new name already exists
        if (this.appsConfig.apps.some(app => app.name === newName)) {
            throw new Error(`App with name ${newName} already exists`);
        }

        // Get old and new paths
        const oldPath = path.join(this.appPath, appId);
        const newPath = path.join(this.appPath, newName);

        // Rename directory
        if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
        }

        // Update config
        appConfig.name = newName;
        appConfig.path = `./${newName}/index.js`;
        this.saveAppsConfig();
    }
}

module.exports = AppInterfaceManager;