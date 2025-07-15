## todo

- [x] 刷新chatlist
- [x] 重新加载agents
- [x] 打印日志
- [x] 把输出路径从ai_helper改成.ai_helper
- [x] filter 掉virtualMessage不生成chat history
- [ ] 刷新的时候，删除所有已经require的agent的缓存，避免重启
- [ ] 列表改成倒序排，最新的在最上面
- [ ] 下面的operations应该替代的是 /xxx 的体验
- [x] 加一个async的初始化函数
- [ ] filePath不要在发送时复制，而应该在init时复制
- [ ] 复制和展示选中应该是一个功能，当然复制这个环节可以切换为其他Action，而展示选中也可以换成其他展示策略
- [ ] 文件部分应该专门写个文档，可以用的地方有三个：手动上传、自动更新、引用标记
- [x] 默认走executeTask的文档
- [ ] 重试的文档跟新，加入meta里 _ui_action
- [ ] markdown的文档
- [x] 支持转字符串的命令
- [ ] operation并不是setting里有值了都会用

## known issue

- [ ] 发送消息时会再复制一次，因为源文件和目标文件路径一致，所以啥也没发生。但这个逻辑有问题
- [ ] 

## bug

- [ ] 任务点击按钮后，删除并保留带按钮的气泡，然后再点击重试，不会发送生成按钮的消息，反而会发送点击过按钮的消息，而且并不执行按钮对应的任务。


## parkinglot

- [x] response加一个plan response，plan response里有一个task list和规划的安排，每个Task都匹配了对应的要按照Task List去调用的对应的Agent的名字。这个名字是AgentAPP的内部名字，外部不可见，不需要配置到agent.json里。然后再分为两种:
  - [x] 一种是顺序调用，就是顺序的调用agent，生成后续的reponse并响应输出。
  - [ ] 一种是递归调用，就是每次把其中一个响应生成完之后，把生成后的响应和旧的PlanResponse自带的提示词都给扔回大模型，让它看看要不要改。
- [ ] previouse meta处理有问题，之前一个任务的meta应该单独存储为一组数组，而不是跟当前的meta合并，避免发生覆盖，暂不处理，但这是个known issue。
- [ ] 应该有三类available task
  - [ ] capability，持续存在，对整个thread有意义。比如根据全文生成patch。
    - [ ] 思考：重试是不是一种capability
  - [ ] Response Action，对某一个response有意义，感觉应该显示在某个response下面，这个response不是最新的，那就把它隐藏起来。(或者下面有一个新的user message后，就隐藏。)
  - [ ] job，点击就会消失，一次性，但有地方记录状态，可以重试。
