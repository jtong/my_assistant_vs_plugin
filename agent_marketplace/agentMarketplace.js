// agent/agentMarketplace.js
const vscode = require('vscode');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { pipeline } = require('stream/promises');
const AdmZip = require('adm-zip');
const { exec } = require('child_process');

class AgentMarketplace {
    constructor(context) {
        this.context = context;
        this.updateAgentDir();
        this.updateAgentListUrl();
    }

    updateAgentDir() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            this.agentDir = path.join(workspaceRoot, 'ai_helper', 'agent');
        } else {
            throw new Error('No workspace folder found');
        }
    }

    updateAgentListUrl() {
        const config = vscode.workspace.getConfiguration('myAssistant');
        this.agentListUrl = config.get('agentRepositoryUrl');
    }

    async getAgentList() {
        this.updateAgentListUrl();

        if (this.agentListUrl.startsWith('http')) {
            const response = await axios.get(this.agentListUrl);
            return response.data;
        } else {
            const localPath = path.isAbsolute(this.agentListUrl) 
                ? this.agentListUrl 
                : path.join(this.context.extensionPath, this.agentListUrl);
            
            try {
                const data = await fs.readFile(localPath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                throw new Error(`Error reading or parsing agent list: ${error.message}`);
            }
        }
    }

    async installAgent(agent) {
        let zipPath;
        if (agent.downloadUrl.startsWith('http')) {
            zipPath = path.join(this.context.extensionPath, 'temp', `${agent.name}.zip`);
            const response = await axios({
                method: 'get',
                url: agent.downloadUrl,
                responseType: 'stream'
            });
            await pipeline(response.data, fs.createWriteStream(zipPath));
        } else {
            zipPath = path.isAbsolute(agent.downloadUrl) 
                ? agent.downloadUrl 
                : path.join(path.dirname(this.agentListUrl), agent.downloadUrl);
        }
    
        const extractedFolderName = path.basename(zipPath, '.zip');
        const agentExtractPath = path.join(this.agentDir, extractedFolderName);
    
        // 如果目标文件夹存在，先删除
        try {
            await fs.access(agentExtractPath);
            await fs.rm(agentExtractPath, { recursive: true, force: true });
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error removing existing agent folder: ${error}`);
                throw new Error(`Failed to remove existing agent folder for ${agent.name}`);
            }
        }
    
        // 解压agent
        await new Promise((resolve, reject) => {
            const zip = new AdmZip(zipPath);
            zip.extractAllToAsync(agentExtractPath, true, false, (err) => {
                if (err) {
                    console.error(`Error extracting agent: ${err}`);
                    reject(err);
                }
                else resolve();
            });
        });
           
        // 读取agent的配置文件
        const configPath = path.join(agentExtractPath, 'config.json');
        let agentConfig;
        try {
            const configContent = await fs.readFile(configPath, 'utf8');
            agentConfig = JSON.parse(configContent);
        } catch (error) {
            console.error(`Error reading agent config: ${error}`);
            throw new Error(`Failed to read agent configuration for ${agent.name}`);
        }
    
        // 添加path属性到agentConfig，使用解压后的文件夹名
        agentConfig.path = `./${extractedFolderName}/${agentConfig.entry}`;
        agentConfig.name = agent.name; // 确保名称与市场中的名称一致
    
        // 更新agents.json
        const agentsJsonPath = path.join(this.agentDir, 'agents.json');
        let agentsConfig = { agents: [] };
        try {
            const agentsJsonContent = await fs.readFile(agentsJsonPath, 'utf8');
            agentsConfig = JSON.parse(agentsJsonContent);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error reading agents.json: ${error}`);
            }
        }
    
        const existingIndex = agentsConfig.agents.findIndex(a => a.name === agent.name);
        if (existingIndex !== -1) {
            agentsConfig.agents[existingIndex] = agentConfig;
        } else {
            agentsConfig.agents.push(agentConfig);
        }
    
        await fs.writeFile(agentsJsonPath, JSON.stringify(agentsConfig, null, 2));
    
        // 安装依赖
        await this.installDependencies(agentExtractPath);
    
        // 执行安装脚本
        await this.runInstallScript(agentExtractPath);
    
        // 如果是临时下载的文件，删除它
        if (agent.downloadUrl.startsWith('http')) {
            await fs.unlink(zipPath);
        }
    
        return true;
    }

    installDependencies(agentPath) {
        return new Promise((resolve, reject) => {
            exec('npm install', { cwd: agentPath }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`npm install error: ${stderr}`);
                    reject(error);
                    return;
                }
                console.log(`npm install stdout: ${stdout}`);
                resolve();
            });
        });
    }

    async runInstallScript(agentPath) {
        const packageJsonPath = path.join(agentPath, 'package.json');
        try {
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonContent);
            if (packageJson.scripts && packageJson.scripts.install) {
                return new Promise((resolve, reject) => {
                    exec('npm run install', { cwd: agentPath }, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`Install script error: ${error}`);
                            reject(error);
                            return;
                        }
                        console.log(`Install script stdout: ${stdout}`);
                        console.error(`Install script stderr: ${stderr}`);
                        resolve();
                    });
                });
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error reading package.json: ${error}`);
                throw error;
            }
        }
    }
}

module.exports = AgentMarketplace;