const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'shrug',
    title: 'Shrug',
    description: (author) => `${author} shrugs.`
})
