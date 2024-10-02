function TextInput(options = {}) {
    return {
        type: 'text',
        id: options.id || '',
        role: options.role || 'input',
        label: options.label || 'Text Input',
        default: options.default || '',
        events: options.events || {}
    };
}

function Button(options = {}) {
    return {
        type: 'button',
        id: options.id || '',
        role: options.role || 'action',
        label: options.label || 'Button',
        events: options.events || {}
    };
}

function TextOutput(options = {}) {
    return {
        type: 'text',
        id: options.id || '',
        role: options.role || 'output',
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