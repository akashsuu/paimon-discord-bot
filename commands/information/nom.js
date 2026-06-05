const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'nom',
    title: 'Nom',
    description: (author, target) => target ? `${author} noms ${target}!` : `${author} noms happily!`
})
