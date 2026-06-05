const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'kitsune',
    title: 'Kitsune',
    description: (author) => `${author} found a kitsune!`
})
