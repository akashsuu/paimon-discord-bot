const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'husbando',
    title: 'Husbando',
    description: (author) => `${author} found a husbando!`
})
