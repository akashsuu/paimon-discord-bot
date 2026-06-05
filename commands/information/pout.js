const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'pout',
    title: 'Pout',
    description: (author) => `${author} pouts.`
})
