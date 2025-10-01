// companionPluginRegistry.js
const vscode = require('vscode');

class CompanionPluginRegistry {
    constructor() {
        // 存储注册的伴生插件信息
        this.plugins = new Map();
        // 消息事件的统一前缀
        this.MESSAGE_PREFIX = 'companion_plugin:';
    }

    /**
     * 注册伴生插件
     * @param {string} pluginId - 插件唯一标识
     * @param {Object} config - 插件配置
     * @param {Array<string>} config.scriptUris - JS文件的绝对路径数组
     * @param {Array<string>} config.styleUris - CSS文件的绝对路径数组
     * @param {string} config.extensionPath - 伴生插件的扩展根路径
     * @param {Function} config.messageHandler - 处理来自webview的消息的函数
     */
    register(pluginId, config) {
        if (this.plugins.has(pluginId)) {
            throw new Error(`Plugin "${pluginId}" is already registered`);
        }

        if (!config.scriptUris && !config.styleUris) {
            throw new Error(`Plugin "${pluginId}" must provide at least scriptUris or styleUris`);
        }

        if (!config.extensionPath) {
            throw new Error(`Plugin "${pluginId}" must provide extensionPath`);
        }

        this.plugins.set(pluginId, {
            id: pluginId,
            scriptUris: config.scriptUris || [],
            styleUris: config.styleUris || [],
            extensionPath: config.extensionPath,
            messageHandler: config.messageHandler || (() => {})
        });

        console.log(`Companion plugin registered: ${pluginId}`);
    }

    /**
     * 注销伴生插件
     * @param {string} pluginId - 插件唯一标识
     */
    unregister(pluginId) {
        if (!this.plugins.has(pluginId)) {
            console.warn(`Plugin "${pluginId}" is not registered`);
            return false;
        }

        this.plugins.delete(pluginId);
        console.log(`Companion plugin unregistered: ${pluginId}`);
        return true;
    }

    /**
     * 获取所有注册的插件ID
     * @returns {Array<string>}
     */
    getAllPluginIds() {
        return Array.from(this.plugins.keys());
    }

    /**
     * 获取插件配置
     * @param {string} pluginId - 插件唯一标识
     * @returns {Object|null}
     */
    getPlugin(pluginId) {
        return this.plugins.get(pluginId) || null;
    }

    /**
     * 生成webview可用的资源URI
     * @param {Object} webview - VSCode webview对象
     * @param {string} type - 资源类型: 'script' 或 'style'
     * @returns {Array<string>} URI字符串数组
     */
    getWebviewUris(webview, type = 'script') {
        const uris = [];
        
        for (const plugin of this.plugins.values()) {
            const paths = type === 'script' ? plugin.scriptUris : plugin.styleUris;
            
            for (const filePath of paths) {
                const uri = webview.asWebviewUri(vscode.Uri.file(filePath));
                uris.push(uri.toString());
            }
        }
        
        return uris;
    }

    /**
     * 生成webview中注入的script标签HTML
     * @param {Object} webview - VSCode webview对象
     * @returns {string} HTML字符串
     */
    generateScriptTags(webview) {
        const scriptUris = this.getWebviewUris(webview, 'script');
        if (scriptUris.length === 0) return '';
        return '\n    ' + scriptUris.map(uri => `<script src="${uri}"></script>`).join('\n    ');
    }

    /**
     * 生成webview中注入的link标签HTML
     * @param {Object} webview - VSCode webview对象
     * @returns {string} HTML字符串
     */
    generateStyleTags(webview) {
        const styleUris = this.getWebviewUris(webview, 'style');
        if (styleUris.length === 0) return '';
        return '\n    ' + styleUris.map(uri => `<link rel="stylesheet" href="${uri}">`).join('\n    ');
    }

    /**
     * 构造伴生插件消息的标准格式
     * @param {string} pluginId - 插件ID
     * @param {string} action - 动作名称
     * @returns {string} 消息类型标识
     */
    buildMessageType(pluginId, action) {
        return `${this.MESSAGE_PREFIX}${pluginId}:${action}`;
    }

    /**
     * 解析伴生插件消息
     * @param {string} messageType - 消息类型
     * @returns {Object|null} {pluginId, action} 或 null（如果不是伴生插件消息）
     */
    parseMessageType(messageType) {
        if (!messageType.startsWith(this.MESSAGE_PREFIX)) {
            return null;
        }

        const withoutPrefix = messageType.substring(this.MESSAGE_PREFIX.length);
        const [pluginId, ...actionParts] = withoutPrefix.split(':');
        
        if (!pluginId || actionParts.length === 0) {
            return null;
        }

        return {
            pluginId,
            action: actionParts.join(':')
        };
    }

    /**
     * 处理来自webview的消息
     * @param {Object} message - webview消息对象
     * @param {Object} panel - webview面板对象
     * @returns {boolean} 是否被处理
     */
    handleWebviewMessage(message, panel) {
        const parsed = this.parseMessageType(message.type);
        
        if (!parsed) {
            return false; // 不是伴生插件消息
        }

        const plugin = this.getPlugin(parsed.pluginId);
        
        if (!plugin) {
            console.warn(`Message for unregistered plugin: ${parsed.pluginId}`);
            return false;
        }

        // 调用插件的消息处理器
        try {
            plugin.messageHandler(message, panel, parsed.action);
            return true;
        } catch (error) {
            console.error(`Error in plugin "${parsed.pluginId}" message handler:`, error);
            return false;
        }
    }

    /**
     * 向webview发送伴生插件消息
     * @param {Object} panel - webview面板对象
     * @param {string} pluginId - 插件ID
     * @param {string} action - 动作名称
     * @param {Object} data - 消息数据
     */
    postMessageToWebview(panel, pluginId, action, data = {}) {
        const messageType = this.buildMessageType(pluginId, action);
        
        panel.webview.postMessage({
            type: messageType,
            pluginId,
            action,
            ...data
        });
    }

    /**
     * 获取所有已注册插件的扩展路径（用于配置 localResourceRoots）
     * @returns {Array<string>} 扩展路径数组
     */
    getAllExtensionPaths() {
        const paths = [];
        for (const plugin of this.plugins.values()) {
            if (plugin.extensionPath && !paths.includes(plugin.extensionPath)) {
                paths.push(plugin.extensionPath);
            }
        }
        return paths;
    }
}

// 导出单例
const companionPluginRegistry = new CompanionPluginRegistry();

module.exports = companionPluginRegistry;