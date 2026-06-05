const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'neko',
    title: 'Neko',
    description: (author) => `${author} found a neko!`
})
