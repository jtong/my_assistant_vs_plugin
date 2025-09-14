const fs = require('fs');
const path = require('path');
const { getProjectEnv } = require('./project-env');

class AIGenFilePatchParser {
    constructor(projectPath) {
        this.projectPath = projectPath;
    }

    /**
     * 解析输入字符串，提取所有文件补丁信息并应用修改
     * @param {string} inputString - 包含ai_gen:file_patch标签的字符串
     * @returns {Object} 解析结果和操作统计
     */
    parseAndApply(inputString) {
        const results = {
            success: [],
            errors: [],
            stats: {
                filesProcessed: 0,
                filesCreated: 0,
                filesUpdated: 0,
                patchItemsApplied: 0
            }
        };

        try {
            const filePatches = this.extractFilePatches(inputString);

            for (const filePatch of filePatches) {
                try {
                    const result = this.processFilePatch(filePatch);
                    results.success.push({
                        path: filePatch.path,
                        action: result.action,
                        patchItemsApplied: result.patchItemsApplied
                    });

                    results.stats.filesProcessed++;
                    results.stats.patchItemsApplied += result.patchItemsApplied;
                    
                    if (result.action === 'created') {
                        results.stats.filesCreated++;
                    } else {
                        results.stats.filesUpdated++;
                    }
                } catch (error) {
                    results.errors.push({
                        path: filePatch.path,
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

    /**
     * 从输入字符串中提取文件补丁信息
     * @param {string} inputString - 输入字符串
     * @returns {Array} 文件补丁信息数组
     */
    extractFilePatches(inputString) {
        const filePatchRegex = /<ai_gen:file_patch\s+path="([^"]+)">([\s\S]*?)<\/ai_gen:file_patch>/g;
        const filePatches = [];
        let match;
        const project_base_path = getProjectEnv("PROMPT_CONTEXT_BUILDER_PROJECT_BASE_PATH") || "./";

        while ((match = filePatchRegex.exec(inputString)) !== null) {
            const filePath = match[1];
            const patchContent = match[2];
            const fullPath = path.resolve(this.projectPath, project_base_path, filePath);

            const patchItems = this.extractPatchItems(patchContent);

            filePatches.push({
                path: filePath,
                fullPath: fullPath,
                patchItems: patchItems
            });
        }

        return filePatches;
    }

    /**
     * 从补丁内容中提取补丁项
     * @param {string} patchContent - 补丁内容字符串
     * @returns {Array} 补丁项数组
     */
    extractPatchItems(patchContent) {
        const patchItemRegex = /<patch_item>([\s\S]*?)<\/patch_item>/g;
        const patchItems = [];
        let match;

        while ((match = patchItemRegex.exec(patchContent)) !== null) {
            const itemContent = match[1];
            const patchItem = this.parsePatchItem(itemContent);
            if (patchItem) {
                patchItems.push(patchItem);
            }
        }

        return patchItems;
    }

    /**
     * 解析单个补丁项
     * @param {string} itemContent - 补丁项内容
     * @returns {Object|null} 解析后的补丁项对象
     */
    parsePatchItem(itemContent) {
        // 检查是否为插入操作
        const insertMatch = itemContent.match(/<insert>([\s\S]*?)<\/insert>/);
        if (insertMatch) {
            return {
                type: 'insert',
                content: this.cleanContent(insertMatch[1])
            };
        }

        // 检查是否为替换操作
        const searchMatch = itemContent.match(/<search>([\s\S]*?)<\/search>/);
        const replaceMatch = itemContent.match(/<replace>([\s\S]*?)<\/replace>/);
        
        if (searchMatch && replaceMatch) {
            return {
                type: 'replace',
                search: this.cleanContent(searchMatch[1]),
                replace: this.cleanContent(replaceMatch[1])
            };
        }

        return null;
    }

    /**
     * 清理内容，移除首尾空白行
     * @param {string} content - 原始内容
     * @returns {string} 清理后的内容
     */
    cleanContent(content) {
        return content.replace(/^\s*\n/, '').replace(/\n\s*$/, '');
    }

    /**
     * 处理单个文件的补丁
     * @param {Object} filePatch - 文件补丁对象
     * @returns {Object} 处理结果
     */
    processFilePatch(filePatch) {
        const fullPath = filePatch.fullPath;
        const dir = path.dirname(fullPath);
        let fileExists = fs.existsSync(fullPath);
        let fileContent = '';
        let patchItemsApplied = 0;

        // 如果文件存在，读取内容
        if (fileExists) {
            fileContent = fs.readFileSync(fullPath, 'utf8');
        }

        // 确保目录存在
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 处理所有的替换操作
        const replaceItems = filePatch.patchItems.filter(item => item.type === 'replace');
        for (const item of replaceItems) {
            const originalContent = fileContent;
            fileContent = this.applyReplace(fileContent, item.search, item.replace);
            if (fileContent !== originalContent) {
                patchItemsApplied++;
            } else {
                throw new Error(`Search pattern not found or not unique: ${item.search.substring(0, 50)}...`);
            }
        }

        // 处理所有的插入操作
        const insertItems = filePatch.patchItems.filter(item => item.type === 'insert');
        for (const item of insertItems) {
            if (!fileExists && fileContent === '') {
                // 新文件创建
                fileContent = item.content;
            } else {
                // 追加到文件末尾
                fileContent += (fileContent.endsWith('\n') ? '' : '\n') + item.content;
            }
            patchItemsApplied++;
        }

        // 写入文件
        fs.writeFileSync(fullPath, fileContent, 'utf8');

        return {
            action: fileExists ? 'updated' : 'created',
            patchItemsApplied: patchItemsApplied
        };
    }

    /**
     * 应用替换操作
     * @param {string} content - 原始内容
     * @param {string} searchPattern - 搜索模式
     * @param {string} replaceContent - 替换内容
     * @returns {string} 替换后的内容
     */
    applyReplace(content, searchPattern, replaceContent) {
        // 检查搜索模式是否存在且唯一
        const occurrences = content.split(searchPattern).length - 1;
        
        if (occurrences === 0) {
            throw new Error(`Search pattern not found: ${searchPattern.substring(0, 50)}...`);
        }
        
        if (occurrences > 1) {
            throw new Error(`Search pattern found multiple times (${occurrences}), must be unique: ${searchPattern.substring(0, 50)}...`);
        }

        return content.replace(searchPattern, replaceContent);
    }

    /**
     * 预览模式：解析但不实际应用补丁
     * @param {string} inputString - 包含ai_gen:file_patch标签的字符串
     * @returns {Array} 将要处理的文件列表
     */
    preview(inputString) {
        const filePatches = [];

        try {
            const extractedPatches = this.extractFilePatches(inputString);
            
            for (const filePatch of extractedPatches) {
                const fileExists = fs.existsSync(filePatch.fullPath);
                let previewInfo = {
                    path: filePatch.path,
                    fullPath: filePatch.fullPath,
                    exists: fileExists,
                    patchItems: filePatch.patchItems.length,
                    operations: []
                };

                // 分析每个补丁项
                for (const item of filePatch.patchItems) {
                    if (item.type === 'replace') {
                        previewInfo.operations.push({
                            type: 'replace',
                            searchLength: item.search.length,
                            replaceLength: item.replace.length
                        });
                    } else if (item.type === 'insert') {
                        previewInfo.operations.push({
                            type: 'insert',
                            contentLength: item.content.length
                        });
                    }
                }

                filePatches.push(previewInfo);
            }
        } catch (error) {
            throw new Error(`Preview failed: ${error.message}`);
        }

        return filePatches;
    }

    /**
     * 验证输入字符串格式
     * @param {string} inputString - 输入字符串
     * @returns {Object} 验证结果
     */
    validate(inputString) {
        const issues = [];

        // 检查是否有ai_gen:file_patch标签
        if (!inputString.includes('<ai_gen:file_patch')) {
            issues.push('No <ai_gen:file_patch> tags found');
        }

        // 检查文件补丁标签配对
        const filePatchOpenCount = (inputString.match(/<ai_gen:file_patch[^>]*>/g) || []).length;
        const filePatchCloseCount = (inputString.match(/<\/ai_gen:file_patch>/g) || []).length;

        if (filePatchOpenCount !== filePatchCloseCount) {
            issues.push(`Mismatched ai_gen:file_patch tags: ${filePatchOpenCount} open, ${filePatchCloseCount} close`);
        }

        // 检查每个文件补丁标签是否有path属性
        const patchTagsWithPath = (inputString.match(/<ai_gen:file_patch\s+path="[^"]+"/g) || []).length;
        if (patchTagsWithPath !== filePatchOpenCount) {
            issues.push(`Some ai_gen:file_patch tags missing path attribute: ${filePatchOpenCount} total, ${patchTagsWithPath} with path`);
        }

        // 检查补丁项标签配对
        const patchItemOpenCount = (inputString.match(/<patch_item>/g) || []).length;
        const patchItemCloseCount = (inputString.match(/<\/patch_item>/g) || []).length;

        if (patchItemOpenCount !== patchItemCloseCount) {
            issues.push(`Mismatched patch_item tags: ${patchItemOpenCount} open, ${patchItemCloseCount} close`);
        }

        // 验证补丁项内容
        try {
            const filePatches = this.extractFilePatches(inputString);
            for (const filePatch of filePatches) {
                if (filePatch.patchItems.length === 0) {
                    issues.push(`File patch for "${filePatch.path}" contains no valid patch items`);
                }
            }
        } catch (error) {
            issues.push(`Error parsing patch items: ${error.message}`);
        }

        return {
            valid: issues.length === 0,
            issues: issues
        };
    }

    /**
     * 获取统计信息
     * @param {string} inputString - 输入字符串
     * @returns {Object} 统计信息
     */
    getStats(inputString) {
        try {
            const filePatches = this.extractFilePatches(inputString);
            let totalPatchItems = 0;
            let replaceOperations = 0;
            let insertOperations = 0;
            let existingFiles = 0;
            let newFiles = 0;

            for (const filePatch of filePatches) {
                totalPatchItems += filePatch.patchItems.length;
                
                if (fs.existsSync(filePatch.fullPath)) {
                    existingFiles++;
                } else {
                    newFiles++;
                }

                for (const item of filePatch.patchItems) {
                    if (item.type === 'replace') {
                        replaceOperations++;
                    } else if (item.type === 'insert') {
                        insertOperations++;
                    }
                }
            }

            return {
                totalFiles: filePatches.length,
                existingFiles: existingFiles,
                newFiles: newFiles,
                totalPatchItems: totalPatchItems,
                replaceOperations: replaceOperations,
                insertOperations: insertOperations
            };
        } catch (error) {
            return {
                error: error.message
            };
        }
    }
}

module.exports = AIGenFilePatchParser;