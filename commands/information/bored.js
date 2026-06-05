const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'bored',
    title: 'Bored',
    description: (author) => `${author} is bored.`
})
