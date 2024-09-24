// agent/agentMarketplace.js
const vscode = require('vscode');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);
const AdmZip = require('adm-zip');
const { exec } = require('child_process');

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
        this.updateAgentListUrl();

        if (this.agentListUrl.startsWith('http')) {
            const response = await axios.get(this.agentListUrl);
            return response.data;
        } else {
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
            zipPath = path.join(this.context.extensionPath, 'temp', `${agent.name}.zip`);
            const response = await axios({
                method: 'get',
                url: agent.downloadUrl,
                responseType: 'stream'
            });
            await streamPipeline(response.data, fs.createWriteStream(zipPath));
        } else {
            zipPath = path.isAbsolute(agent.downloadUrl) 
                ? agent.downloadUrl 
                : path.join(path.dirname(this.agentListUrl), agent.downloadUrl);
        }
    
        const extractedFolderName = path.basename(zipPath, '.zip');
        const agentExtractPath = path.join(this.agentDir, extractedFolderName);
    
        // 如果目标文件夹存在，先删除
        if (fs.existsSync(agentExtractPath)) {
            fs.rmdirSync(agentExtractPath, { recursive: true });
        }
    
        // 解压agent
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(agentExtractPath, true);
    
        // 读取agent的配置文件
        const configPath = path.join(agentExtractPath, 'config.json');
        let agentConfig;
        try {
            const configContent = fs.readFileSync(configPath, 'utf8');
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
        if (fs.existsSync(agentsJsonPath)) {
            const agentsJsonContent = fs.readFileSync(agentsJsonPath, 'utf8');
            agentsConfig = JSON.parse(agentsJsonContent);
        }
    
        const existingIndex = agentsConfig.agents.findIndex(a => a.name === agent.name);
        if (existingIndex !== -1) {
            agentsConfig.agents[existingIndex] = agentConfig;
        } else {
            agentsConfig.agents.push(agentConfig);
        }
    
        fs.writeFileSync(agentsJsonPath, JSON.stringify(agentsConfig, null, 2));
    
        // 安装依赖
        await this.installDependencies(agentExtractPath);
    
        // 执行安装脚本
        await this.runInstallScript(agentExtractPath);
    
        // 如果是临时下载的文件，删除它
        if (agent.downloadUrl.startsWith('http')) {
            fs.unlinkSync(zipPath);
        }
    
        return true;
    }

    async installDependencies(agentPath) {
        return new Promise((resolve, reject) => {
            exec('npm install', { cwd: agentPath }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`npm install error: ${stderr}`);
                    reject(error);
                    return;
                }
                console.log(`npm install stdout: ${stdout}`);
                // console.error(`npm install stderr: ${stderr}`);
                resolve();
            });
        });
    }

    async runInstallScript(agentPath) {
        const packageJsonPath = path.join(agentPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
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
        }
    }
}

module.exports = AgentMarketplace;