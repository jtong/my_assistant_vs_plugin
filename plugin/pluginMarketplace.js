const vscode = require('vscode');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);
const AdmZip = require('adm-zip');

class PluginMarketplace {
    constructor(context) {
        this.context = context;
        this.pluginDir = path.join(this.context.extensionPath, 'plugins');
        this.updatePluginListUrl();
    }

    updatePluginListUrl() {
        const config = vscode.workspace.getConfiguration('myAssistant');
        this.pluginListUrl = config.get('pluginRepositoryUrl');
    }

    async getPluginList() {
        this.updatePluginListUrl(); // 每次获取插件列表时更新 URL

        if (this.pluginListUrl.startsWith('http')) {
            // 如果是 URL，使用 axios 获取
            const response = await axios.get(this.pluginListUrl);
            return response.data;
        } else {
            // 如果是本地路径，直接读取文件
            const localPath = path.isAbsolute(this.pluginListUrl) 
                ? this.pluginListUrl 
                : path.join(this.context.extensionPath, this.pluginListUrl);
            
            return new Promise((resolve, reject) => {
                fs.readFile(localPath, 'utf8', (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        try {
                            const jsonData = JSON.parse(data);
                            resolve(jsonData);
                        } catch (parseError) {
                            reject(parseError);
                        }
                    }
                });
            });
        }
    }

    async installPlugin(plugin) {
        let zipPath;
        if (plugin.downloadUrl.startsWith('http')) {
            // 如果是 URL，下载到临时目录
            zipPath = path.join(this.context.extensionPath, 'temp', `${plugin.name}.zip`);
            const response = await axios({
                method: 'get',
                url: plugin.downloadUrl,
                responseType: 'stream'
            });
            await streamPipeline(response.data, fs.createWriteStream(zipPath));
        } else {
            // 如果是本地路径，直接使用
            zipPath = path.isAbsolute(plugin.downloadUrl) 
                ? plugin.downloadUrl 
                : path.join(path.dirname(this.pluginListUrl), plugin.downloadUrl);
        }

        const zip = new AdmZip(zipPath);
        zip.extractAllTo(this.pluginDir, true);

        // 如果是临时下载的文件，删除它
        if (plugin.downloadUrl.startsWith('http')) {
            fs.unlinkSync(zipPath);
        }

        return true;
    }
}

module.exports = PluginMarketplace;