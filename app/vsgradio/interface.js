class Blocks {
    constructor(blocks) {
        this.blocks = blocks;
        this.events = {};
        this.title = "";
    }

    getConfig() {
        return {
            blocks: this.blocks.map(this.mapBlockConfig.bind(this)),
            title: this.title
        };
    }

    mapBlockConfig(block) {
        if (block.type === 'row' || block.type === 'column') {
            return {
                ...block,
                children: block.children.map(this.mapBlockConfig.bind(this))
            };
        } else {
            return {
                ...block,
                events: block.events ? block.events : {}
            };
        }
    }

    registerEventHandlers() {
        this.traverseBlocks(this.blocks, (block) => {
            if (block.events) {
                Object.entries(block.events).forEach(([eventName, eventDetails]) => {
                    const key = `${block.id}_${eventName}`;
                    this.events[key] = {
                        handler: eventDetails.handler,
                        inputs: eventDetails.inputs,
                        outputs: eventDetails.outputs
                    };
                });
            }
        });
    }

    traverseBlocks(blocks, callback, parentPath = '') {
        blocks.forEach((block, index) => {
            const currentPath = parentPath ? `${parentPath}_${index}` : `block_${index}`;
            callback(block, currentPath);
            if (block.children) {
                this.traverseBlocks(block.children, callback, currentPath);
            }
        });
    }

    handleEvent(componentId, eventName, value, inputsFromFrontend) {
        const key = `${componentId}_${eventName}`;
        const eventObj = this.events[key];
        if (eventObj) {
            const { handler, inputs: inputIds, outputs: outputIds } = eventObj;
            // 从输入中获取指定的输入值
            const inputs = {};
            inputIds.forEach(id => {
                inputs[id] = inputsFromFrontend[id];
            });
            // 执行处理函数
            const result = handler(inputs);
            // 准备更新指令
            if (outputIds && result !== undefined) {
                return {
                    type: 'updateComponents',
                    updates: outputIds.map(outputId => ({ id: outputId, value: result }))
                };
            }
            return result;
        }
    }
}

module.exports = {
    Blocks: function(blocks) {
        return new Blocks(blocks);
    }
};