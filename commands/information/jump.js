const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'jump',
    title: 'Jump',
    description: (author) => `${author} jumps!`
})
