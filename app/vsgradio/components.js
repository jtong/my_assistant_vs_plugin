function TextInput(options = {}) {
    return {
        type: 'text',
        label: options.label || 'Text Input',
        default: options.default || ''
    };
}

function Button(options = {}) {
    return {
        type: 'button',
        label: options.label || 'Button'
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