# My Assistant 插件使用指南

**My Assistant**是一款为 Visual Studio Code 设计的插件，集成了聊天助手和作业（Job）管理功能。其目的是为用户提供一个安全、私密且高度可定制的 AI 助手体验。只需拥有 AI 服务的 API 密钥，您就可以在本地环境中使用社区开发的各种 Agent，与 AI 进行深度交互，同时确保所有数据和信息都安全地存储在您的本地设备上。

## 核心优势

- **本地化和隐私保护**：所有数据和交互历史都存储在本地，不用担心信息泄露或被在线服务绑架。
- **高度可定制**：在打开的任意目录的 `.ai_helper/agent` 下，您可以自定义和加载不同的 AI Aegnt，以满足特定需求。
- **简单易用**：只需一个 AI 服务的 API 密钥，即可开启强大的 AI 辅助功能。
- **开放生态**：鼓励社区贡献新的 Agent，持续扩展插件的功能。

## 安装指南

### 前置条件

- **Visual Studio Code**：请确保已安装最新版本的 VSCode。
- **Node.js**：插件依赖于 Node.js，请确保已安装 Node.js 环境。（主要是 agent 需要）

### 安装步骤

1. **搜索插件**

在vscode extensions marketplace搜索 my-assitant ：

![search-plugin](https://jtong-pic.obs.cn-north-4.myhuaweicloud.com/doc/my-assistant/search-plugin.png)

点击 install 即可。

## 配置 API 密钥

插件依赖于不同的 AI 服务来提供智能功能。在使用之前，请确保在 VSCode 的配置中添加相应的 API 密钥。

1. **打开设置**

点击左下角的齿轮图标，选择 `设置`，或者使用快捷键 `Ctrl+,`。

2. **找到插件配置**

在设置搜索栏中输入 `myAssistant.apiKey`。

3. **配置 API 密钥**

根据您使用的 AI 服务，添加相应的 API 密钥：

![setup_apikey](https://jtong-pic.obs.cn-north-4.myhuaweicloud.com/doc/my-assistant/setup_apikey.png)

## 使用指南

### 聊天助手

#### 新建聊天

1. **打开聊天侧边栏**

点击活动栏（通常在 VSCode 左侧）中的聊天图标，打开聊天侧边栏。

2. **创建新聊天**

在聊天列表的标题栏中，点击 `+` 按钮。

1. **选择 Agent**

输入聊天名称，然后从可用 Agent 列表中选择一个 Agent 。Agent 列表来自于项目目录下 `.ai_helper/agent/agents.json` 中的配置，您可以根据需要选择适合的 Agent。

2. **开始对话**

双击聊天名称，打开聊天窗口。您现在可以在输入框中输入消息，与 AI 助手进行交互。

#### 管理聊天

- **重命名聊天**：右键点击聊天名称，选择 `Rename Chat`，然后输入新的名称。
- **删除聊天**：右键点击聊天名称，选择 `Delete Chat`，确认删除该聊天。

### 自定义 Aegnt

`.ai_helper/agent` 组件允许您自定义和加载不同的 AI Agent。

#### 体验样例 Agent

要快速体验样例 Agent （仓库地址： [https://github.com/jtong/my_assistant_agent_examples](https://github.com/jtong/my_assistant_agent_examples)），请按以下步骤操作：

1. 在任意目录中打开 Visual Studio Code。

2. 打开终端（Terminal），并执行以下初始化命令：

```bash
git clone https://github.com/jtong/my_assistant_agent_examples.git .ai_helper/agent
cd .ai_helper/agent
npm install
```

3. 在 Chat List上点击刷新按钮，即可重新加载所有Agent。或者在 VSCode 中重新加载窗口，或者重启插件，使新的 Agent 生效。

#### 添加新的 Agent

1. **编辑 Agent 配置**

Agent 配置文件位于 `.ai_helper/agent/agents.json`。打开该文件，按照格式添加新的 Agent 配置。例如：

```json
{
    "name": "YourCustomAgent",
    "path": "./yourCustomAgent.js",
    "metadata": {
    "llm": {
        "apiKey": "yourApiKeyName",
        "model": "your-model-name"
    }
    }
}
```

2. **编写 Agent 代码**

在 `.ai_helper/agent` 目录下，创建 `yourCustomAgent.js`，并按照 Agent 模板实现必要的方法。

3. **加载 Agent**

在 Chat List上点击刷新按钮，即可重新加载所有Agent。或者在 VSCode 中重新加载窗口，或者重启插件，使新的 Agent 生效。

### 聊天设置

如果Agent支持用户自定义每个聊天专属的设置，用户可以给每个聊天可以单独配置设置特定的 Agent 参数。

1. **打开聊天设置**

右键点击聊天名称，选择 `Edit Settings`。

2. **编辑设置**

设置文件使用 YAML 格式，您可以根据 Agent 支持的配置项进行修改。

3. **保存设置**

编辑完成后，保存文件，设置会自动应用。

注意：如果 Agent 不支持，那么设置了也不会有任何效果。

### 常见问题

#### 无法加载 Aegnt？

- 确保 `agents.json` 中的路径和文件名正确。
- 检查 Aegnt 代码是否有语法错误。

#### API 请求失败？

- 确认已在设置中配置了正确的 API 密钥。
- 检查网络连接，是否需要配置 Aegnt。

## 贡献

欢迎对 My Assistant 插件进行贡献。您可以提交 Issue 或 Pull Request。

### 开发模式运行

1. **克隆仓库**

```bash
git clone https://github.com/jtong/my_assistant_vs_plugin.git
```

2. **进入插件目录**

```bash
cd my_assistant_vs_plugin
```

3. **安装依赖**

```bash
npm install
```

4. **在 VSCode 中打开**

打开 VSCode，选择 `文件` > `打开文件夹...`，然后选择插件所在的目录。

5. **启动插件**

按下 `F5` 键，启动插件的调试模式。这样会打开一个新的 VSCode 窗口，其中加载了 My Assistant 插件。