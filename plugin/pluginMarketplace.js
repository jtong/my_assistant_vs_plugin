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
        this.pluginListUrl = 'https://raw.githubusercontent.com/your-repo/plugins/main/plugin-list.json';
        this.pluginDir = path.join(this.context.extensionPath, 'plugins');
    }

    async getPluginList() {
        const response = await axios.get(this.pluginListUrl);
        return response.data;
    }

    async installPlugin(plugin) {
        const zipPath = path.join(this.context.extensionPath, 'temp', `${plugin.name}.zip`);
        const response = await axios({
            method: 'get',
            url: plugin.downloadUrl,
            responseType: 'stream'
        });

        await streamPipeline(response.data, fs.createWriteStream(zipPath));

        const zip = new AdmZip(zipPath);
        zip.extractAllTo(this.pluginDir, true);

        fs.unlinkSync(zipPath);

        return true;
    }
}

module.exports = PluginMarketplace;