// chat/ex_command/parseClipboardFilesCommand.js
const vscode = require('vscode');
const AIGenFileParser = require('./AIGenFileParser');

async function parseClipboardFilesCommand(uri) {
    try {
        // 读取剪贴板内容
        const clipboardText = await vscode.env.clipboard.readText();
        
        // 检查剪贴板是否为空
        if (!clipboardText || clipboardText.trim() === '') {
            vscode.window.showWarningMessage('剪贴板内容为空');
            return;
        }

        // 获取当前工作区根路径（用于错误报告中的相对路径显示）
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('没有打开的工作区文件夹');
            return;
        }
        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        // 确定项目根路径（优先使用选中的文件夹，否则使用工作区根路径）
        let projectRoot;
        if (uri && uri.fsPath) {
            projectRoot = uri.fsPath;
        } else {
            projectRoot = workspaceRoot;
        }

        // 创建 AIGenFileParser 实例
        const parser = new AIGenFileParser(projectRoot);
        
        // 设置工作区根路径用于错误报告
        parser.workspaceRoot = workspaceRoot;

        // 1. 验证输入格式
        const validation = parser.validate(clipboardText);
        if (!validation.valid) {
            const issuesMessage = validation.issues.join('\n');
            vscode.window.showErrorMessage(`输入格式验证失败:\n${issuesMessage}`);
            return;
        }

        // 2. 预览将要处理的文件
        const preview = parser.preview(clipboardText);
        const stats = parser.getStats(clipboardText);
        
        // 显示预览信息并询问用户是否确认
        const previewMessage = `将要处理 ${stats.totalFiles} 个文件:\n` +
            `- 新建文件: ${stats.newFiles} 个\n` +
            `- 更新文件: ${stats.existingFiles} 个\n` +
            `- 总内容长度: ${stats.totalContentLength} 字符\n\n` +
            `文件列表:\n` +
            preview.map(file => `${file.exists ? '📝' : '📄'} ${file.path}`).join('\n');

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

        // 3. 执行解析和文件替换
        const results = parser.parseAndReplace(clipboardText);

        // 4. 显示结果
        let resultMessage = `文件处理完成!\n`;
        resultMessage += `总计处理: ${results.stats.filesProcessed} 个文件\n`;
        resultMessage += `新建: ${results.stats.filesCreated} 个\n`;
        resultMessage += `更新: ${results.stats.filesUpdated} 个\n`;

        if (results.success.length > 0) {
            resultMessage += `\n✅ 成功处理的文件:\n`;
            resultMessage += results.success.map(item => {
                const relativePath = path.relative(workspaceRoot, path.resolve(projectRoot, item.path));
                return `${item.action === 'created' ? '📄' : '📝'} ${relativePath}`;
            }).join('\n');
        }

        if (results.errors.length > 0) {
            resultMessage += `\n❌ 处理失败的文件:\n`;
            resultMessage += results.errors.map(item => {
                const relativePath = path.relative(workspaceRoot, path.resolve(projectRoot, item.path));
                return `${relativePath}: ${item.error}`;
            }).join('\n');
        }

        if (results.errors.length > 0) {
            vscode.window.showWarningMessage(resultMessage);
        } else {
            vscode.window.showInformationMessage(resultMessage);
        }

        // 如果成功处理了文件，询问是否要刷新资源管理器
        if (results.stats.filesProcessed > 0) {
            const refreshChoice = await vscode.window.showInformationMessage(
                '是否刷新资源管理器以查看新创建的文件？',
                '刷新',
                '不刷新'
            );
            
            if (refreshChoice === '刷新') {
                vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
            }
        }

    } catch (error) {
        console.error('处理剪贴板文件时出错:', error);
        vscode.window.showErrorMessage(`处理失败: ${error.message}`);
    }
}

module.exports = parseClipboardFilesCommand;