const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'think',
    title: 'Think',
    description: (author) => `${author} starts thinking.`
})
