const fs = require('fs');
const path = require('path');
const { getProjectEnv } = require('./project-env');

class AIGenFileParser {
    constructor(projectPath) {
        this.projectPath = projectPath;
    }

    /*
    * 解析输入字符串，提取所有文件信息并替换对应文件
    * @param {string} inputString - 包含ai_gen:file标签的字符串
    * @returns {Object} 解析结果和操作统计
    */
    parseAndReplace(inputString) {
        const results = {
            success: [],
            errors: [],
            stats: {
                filesProcessed: 0,
                filesCreated: 0,
                filesUpdated: 0
            }
        };

        try {
            // 直接提取文件信息，不再依赖data块
            const files = this.extractFiles(inputString);

            for (const file of files) {
                try {
                    this.processFile(file);
                    results.success.push({
                        path: file.path,
                        action: file.existed ? 'updated' : 'created'
                    });

                    results.stats.filesProcessed++;
                    if (file.existed) {
                        results.stats.filesUpdated++;
                    } else {
                        results.stats.filesCreated++;
                    }
                } catch (error) {
                    results.errors.push({
                        path: file.path,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            results.errors.push({
                path: 'parsing',
                error: error.message
            });
        }

        return results;
    }

    /*
    * 直接从输入字符串中提取文件信息（移除对ai_gen:data的依赖）
    * @param {string} inputString - 输入字符串
    * @returns {Array} 文件信息数组
    */
    extractFiles(inputString) {
        const fileRegex = /<ai_gen:file\s+path="([^"]+)">([\s\S]*?)<\/ai_gen:file>/g;
        const files = [];
        let match;
        const project_base_path = getProjectEnv("PROMPT_CONTEXT_BUILDER_PROJECT_BASE_PATH") || "./";
        
        while ((match = fileRegex.exec(inputString)) !== null) {
            const filePath = match[1];
            const content = match[2];

            files.push({
                path: filePath,
                content: this.cleanContent(content),
                fullPath: path.resolve(this.projectPath,project_base_path, filePath),
                existed: false
            });
        }

        return files;
    }

    /*
    * 清理文件内容，移除首尾空白行
    * @param {string} content - 原始内容
    * @returns {string} 清理后的内容
    */
    cleanContent(content) {
        // 移除开头和结尾的空行，但保留内容中间的格式
        return content.replace(/^\s*\n/, '').replace(/\n\s*$/, '');
    }

    /*
    * 处理单个文件：创建目录、写入文件
    * @param {Object} file - 文件信息对象
    */
    processFile(file) {
        const fullPath = file.fullPath;
        const dir = path.dirname(fullPath);

        // 检查文件是否已存在
        file.existed = fs.existsSync(fullPath);

        // 确保目录存在
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 写入文件
        fs.writeFileSync(fullPath, file.content, 'utf8');
    }

    /*
    * 预览模式：解析但不实际写入文件
    * @param {string} inputString - 包含ai_gen:file标签的字符串
    * @returns {Array} 将要处理的文件列表
    */
    preview(inputString) {
        const files = [];

        try {
            const extractedFiles = this.extractFiles(inputString);
            files.push(...extractedFiles);
        } catch (error) {
            throw new Error(`Preview failed: ${error.message}`);
        }

        return files.map(file => ({
            path: file.path,
            fullPath: file.fullPath,
            contentLength: file.content.length,
            exists: fs.existsSync(file.fullPath)
        }));
    }

    /*
    * 验证输入字符串格式
    * @param {string} inputString - 输入字符串
    * @returns {Object} 验证结果
    */
    validate(inputString) {
        const issues = [];

        // 检查是否有ai_gen:file标签
        if (!inputString.includes('<ai_gen:file')) {
            issues.push('No <ai_gen:file> tags found');
        }

        // 检查文件标签配对
        const fileOpenCount = (inputString.match(/<ai_gen:file[^>]*>/g) || []).length;
        const fileCloseCount = (inputString.match(/<\/ai_gen:file>/g) || []).length;

        if (fileOpenCount !== fileCloseCount) {
            issues.push(`Mismatched ai_gen:file tags: ${fileOpenCount} open, ${fileCloseCount} close`);
        }

        // 检查每个文件标签是否有path属性
        const fileTagsWithPath = (inputString.match(/<ai_gen:file\s+path="[^"]+"/g) || []).length;
        if (fileTagsWithPath !== fileOpenCount) {
            issues.push(`Some ai_gen:file tags missing path attribute: ${fileOpenCount} total, ${fileTagsWithPath} with path`);
        }

        return {
            valid: issues.length === 0,
            issues: issues
        };
    }

    /*
    * 获取统计信息
    * @param {string} inputString - 输入字符串
    * @returns {Object} 统计信息
    */
    getStats(inputString) {
        try {
            const files = this.extractFiles(inputString);
            return {
                totalFiles: files.length,
                existingFiles: files.filter(file => fs.existsSync(file.fullPath)).length,
                newFiles: files.filter(file => !fs.existsSync(file.fullPath)).length,
                totalContentLength: files.reduce((sum, file) => sum + file.content.length, 0)
            };
        } catch (error) {
            return {
                error: error.message
            };
        }
    }
}

module.exports = AIGenFileParser;