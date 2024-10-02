const Interface = require('./interface.js');
const components = require('./components.js');

module.exports = {
    Interface : Interface.Interface,
    Blocks : Interface.Blocks,
    ...components
};