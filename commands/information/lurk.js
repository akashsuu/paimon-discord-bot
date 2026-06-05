const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'lurk',
    title: 'Lurk',
    description: (author) => `${author} starts lurking.`
})
