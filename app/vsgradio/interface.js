class Blocks {
    constructor(blocks) {
        this.blocks = blocks;
        this.events = {};
    }

    getConfig() {
        return {
            blocks: this.blocks.map(this.mapBlockConfig.bind(this))
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
                events: block.events ? Object.keys(block.events) : []
            };
        }
    }

    registerEventHandlers() {
        this.traverseBlocks(this.blocks, (block) => {
            if (block.events) {
                Object.entries(block.events).forEach(([eventName, handler]) => {
                    // 使用 block.id 而不是 path
                    const key = `${block.id}_${eventName}`;
                    this.events[key] = handler;
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

    handleEvent(componentId, eventName, value, allInputs) {
        const key = `${componentId}_${eventName}`;
        if (this.events[key]) {
            return this.events[key](value, allInputs);
        }
    }
}

class Interface extends Blocks {
    constructor(config) {
        // 将 inputs 转换为 blocks 结构
        const blocks = [
            {
                type: 'column',
                children: config.inputs
            }
        ];
        super(blocks);
        
        this.fn = config.fn;
        this.outputs = config.outputs;
        this.title = config.title;
    }

    getConfig() {
        const blocksConfig = super.getConfig();
        return {
            ...blocksConfig,
            outputs: this.outputs,
            title: this.title
        };
    }

    execute(inputs) {
        return this.fn(...inputs);
    }
}

module.exports = {
    Blocks: function(blocks) {
        return new Blocks(blocks);
    },
    Interface: function(config) {
        return new Interface(config);
    }
};