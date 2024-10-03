// app/appInterfaceManager.js
const path = require('path');
const fs = require('fs');

class AppInterfaceManager {
    constructor(context) {
        this.appPath = path.join(context.extensionPath, '.ai_helper', 'agent', 'app');;
        this.interfaces = new Map();
    }

    async createInterface(interfaceId, appName) {
        const appPath = path.join(this.appPath, `${appName}.js`);
        if (!fs.existsSync(appPath)) {
            throw new Error(`App file not found: ${appPath}`);
        }

        const AppClass = require(appPath);
        const appInterface = new AppClass();
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
}

module.exports = AppInterfaceManager;