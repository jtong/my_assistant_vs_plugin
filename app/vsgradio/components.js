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

module.exports = {
    TextInput,
    Button,
    TextOutput
};