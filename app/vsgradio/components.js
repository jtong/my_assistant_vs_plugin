function TextInput(options = {}) {
    return {
        type: 'text',
        label: options.label || 'Text Input',
        default: options.default || '',
        events: options.events || {}
    };
}

function Button(options = {}) {
    return {
        type: 'button',
        label: options.label || 'Button',
        events: options.events || {}
    };
}

function TextOutput(options = {}) {
    return {
        type: 'text',
        label: options.label || 'Output'
    };
}

function Row(options = {}) {
    return {
        type: 'row',
        children: options.children || []
    };
}

function Column(options = {}) {
    return {
        type: 'column',
        children: options.children || []
    };
}


module.exports = {
    TextInput,
    Button,
    TextOutput,
    Row,
    Column
};