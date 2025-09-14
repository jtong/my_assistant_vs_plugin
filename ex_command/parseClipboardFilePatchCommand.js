// ex_command/parseClipboardFilePatchCommand.js
const vscode = require('vscode');
const AIGenFilePatchParser = require('./AIGenFilePatchParser');

async function parseClipboardFilePatchCommand() {
    try {
        // 读取剪贴板内容
        const clipboardText = await vscode.env.clipboard.readText();
        
        // 检查剪贴板是否为空
        if (!clipboardText || clipboardText.trim() === '') {
            vscode.window.showWarningMessage('剪贴板内容为空');
            return;
        }

        // 获取当前工作区根路径
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('没有打开的工作区文件夹');
            return;
        }
        const projectRoot = workspaceFolders[0].uri.fsPath;

        // 创建 AIGenFilePatchParser 实例
        const parser = new AIGenFilePatchParser(projectRoot);

        // 1. 验证输入格式
        const validation = parser.validate(clipboardText);
        if (!validation.valid) {
            const issuesMessage = validation.issues.join('\n');
            vscode.window.showErrorMessage(`文件补丁格式验证失败:\n${issuesMessage}`);
            return;
        }

        // 2. 预览将要处理的文件
        const preview = parser.preview(clipboardText);
        const stats = parser.getStats(clipboardText);
        
        // 显示预览信息并询问用户是否确认
        const previewMessage = `将要处理 ${stats.totalFiles} 个文件:\n` +
            `- 新建文件: ${stats.newFiles} 个\n` +
            `- 更新文件: ${stats.existingFiles} 个\n` +
            `- 补丁操作: ${stats.totalPatchItems} 个\n` +
            `  - 替换操作: ${stats.replaceOperations} 个\n` +
            `  - 插入操作: ${stats.insertOperations} 个\n\n` +
            `文件列表:\n` +
            preview.map(file => {
                const statusIcon = file.exists ? '📝' : '📄';
                const operationsDesc = file.operations.map(op => 
                    op.type === 'replace' ? 'R' : 'I'
                ).join('');
                return `${statusIcon} ${file.path} (${operationsDesc})`;
            }).join('\n');

        const choice = await vscode.window.showInformationMessage(
            previewMessage,
            { modal: true },
            '确认执行',
            '取消'
        );

        if (choice !== '确认执行') {
            vscode.window.showInformationMessage('操作已取消');
            return;
        }

        // 3. 执行解析和文件补丁应用
        const results = parser.parseAndApply(clipboardText);

        // 4. 显示结果
        let resultMessage = `文件补丁处理完成!\n`;
        resultMessage += `总计处理: ${results.stats.filesProcessed} 个文件\n`;
        resultMessage += `新建: ${results.stats.filesCreated} 个\n`;
        resultMessage += `更新: ${results.stats.filesUpdated} 个\n`;
        resultMessage += `应用补丁: ${results.stats.patchItemsApplied} 个\n`;

        if (results.success.length > 0) {
            resultMessage += `\n✅ 成功处理的文件:\n`;
            resultMessage += results.success.map(item => 
                `${item.action === 'created' ? '📄' : '📝'} ${item.path} (${item.patchItemsApplied} 个补丁)`
            ).join('\n');
        }

        if (results.errors.length > 0) {
            resultMessage += `\n❌ 处理失败的文件:\n`;
            resultMessage += results.errors.map(item => `${item.path}: ${item.error}`).join('\n');
        }

        if (results.errors.length > 0) {
            vscode.window.showWarningMessage(resultMessage);
        } else {
            vscode.window.showInformationMessage(resultMessage);
        }

        // 如果成功处理了文件，询问是否要刷新资源管理器
        if (results.stats.filesProcessed > 0) {
            const refreshChoice = await vscode.window.showInformationMessage(
                '是否刷新资源管理器以查看修改后的文件？',
                '刷新',
                '不刷新'
            );
            
            if (refreshChoice === '刷新') {
                vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
            }
        }

    } catch (error) {
        console.error('处理剪贴板文件补丁时出错:', error);
        vscode.window.showErrorMessage(`处理失败: ${error.message}`);
    }
}

module.exports = parseClipboardFilePatchCommand;