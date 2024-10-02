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
                events: block.events ? Object.keys(block.events) : []
            };
        }
    }

    registerEventHandlers() {
        this.traverseBlocks(this.blocks, (block) => {
            if (block.events) {
                Object.entries(block.events).forEach(([eventName, handler]) => {
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

module.exports = {
    Blocks: function(blocks) {
        return new Blocks(blocks);
    }
};