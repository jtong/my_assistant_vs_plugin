// agent/agentMarketplace.js
const vscode = require('vscode');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);
const AdmZip = require('adm-zip');

class AgentMarketplace {
    constructor(context) {
        this.context = context;
        this.agentDir = path.join(this.context.extensionPath, 'agents');
        this.updateAgentListUrl();
    }

    updateAgentListUrl() {
        const config = vscode.workspace.getConfiguration('myAssistant');
        this.agentListUrl = config.get('agentRepositoryUrl');
    }

    async getAgentList() {
        this.updateAgentListUrl(); // 每次获取代理列表时更新 URL

        if (this.agentListUrl.startsWith('http')) {
            // 如果是 URL，使用 axios 获取
            const response = await axios.get(this.agentListUrl);
            return response.data;
        } else {
            // 如果是本地路径，直接读取文件
            const localPath = path.isAbsolute(this.agentListUrl) 
                ? this.agentListUrl 
                : path.join(this.context.extensionPath, this.agentListUrl);
            
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

    async installAgent(agent) {
        let zipPath;
        if (agent.downloadUrl.startsWith('http')) {
            // 如果是 URL，下载到临时目录
            zipPath = path.join(this.context.extensionPath, 'temp', `${agent.name}.zip`);
            const response = await axios({
                method: 'get',
                url: agent.downloadUrl,
                responseType: 'stream'
            });
            await streamPipeline(response.data, fs.createWriteStream(zipPath));
        } else {
            // 如果是本地路径，直接使用
            zipPath = path.isAbsolute(agent.downloadUrl) 
                ? agent.downloadUrl 
                : path.join(path.dirname(this.agentListUrl), agent.downloadUrl);
        }

        const zip = new AdmZip(zipPath);
        zip.extractAllTo(this.agentDir, true);

        // 如果是临时下载的文件，删除它
        if (agent.downloadUrl.startsWith('http')) {
            fs.unlinkSync(zipPath);
        }

        return true;
    }
}

module.exports = AgentMarketplace;