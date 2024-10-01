## todo

- [x] 刷新chatlist
- [x] 重新加载agents
- [x] 打印日志
- [x] 把输出路径从ai_helper改成.ai_helper
- [ ] filter 掉virtualMessage不生成chat`

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
