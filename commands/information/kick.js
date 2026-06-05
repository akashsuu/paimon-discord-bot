const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'kick',
    title: 'Kick',
    description: (author, target) => target ? `${author} kicks ${target}!` : `${author} kicks the air!`
})
