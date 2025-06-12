const fs = require('fs');
const path = require('path');
const os = require('os');

// 配置文件路径
const CONFIG_FILE = path.join(os.homedir(), '.prompt-context-builder-env');

// 写入环境变量的函数
function setProjectEnv(key, value) {
    let envVars = {};

    // 如果文件存在，先读取现有配置
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const content = fs.readFileSync(CONFIG_FILE, 'utf8');
            envVars = JSON.parse(content);
        } catch (error) {
            console.warn('读取配置文件失败，将创建新文件');
            envVars = {};
        }
    }

    // 更新环境变量
    envVars[key] = value;
    envVars.lastUpdated = new Date().toISOString();

    // 写入文件
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(envVars, null, 2));
    console.log(`✅ 环境变量 ${key} 已保存到 ${CONFIG_FILE}`);
}

// 读取环境变量的函数
function getProjectEnv(key) {
    if (!fs.existsSync(CONFIG_FILE)) {
        console.warn(`⚠️  配置文件不存在: ${CONFIG_FILE}`);
        return null;
    }

    try {
        const content = fs.readFileSync(CONFIG_FILE, 'utf8');
        const envVars = JSON.parse(content);
        return envVars[key] || null;
    } catch (error) {
        console.error('❌ 读取配置文件失败:', error.message);
        return null;
    }
}

// 获取所有环境变量
function getAllProjectEnvs() {
    if (!fs.existsSync(CONFIG_FILE)) {
        return {};
    }

    try {
        const content = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('❌ 读取配置文件失败:', error.message);
        return {};
    }
}

// 删除环境变量
function removeProjectEnv(key) {
    if (!fs.existsSync(CONFIG_FILE)) {
        return false;
    }

    try {
        const content = fs.readFileSync(CONFIG_FILE, 'utf8');
        const envVars = JSON.parse(content);

        if (key in envVars) {
            delete envVars[key];
            envVars.lastUpdated = new Date().toISOString();
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(envVars, null, 2));
            console.log(`✅ 环境变量 ${key} 已删除`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ 删除环境变量失败:', error.message);
        return false;
    }
}

module.exports = {
    setProjectEnv,
    getProjectEnv,
    getAllProjectEnvs,
    removeProjectEnv,
    CONFIG_FILE
};
