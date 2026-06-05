const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'smile',
    title: 'Smile',
    description: (author) => `${author} smiles!`
})
