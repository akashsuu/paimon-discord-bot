const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'smug',
    title: 'Smug',
    description: (author) => `${author} looks smug.`
})
