const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'peck',
    title: 'Peck',
    description: (author, target) => target ? `${author} pecks ${target}!` : `${author} sends a tiny peck!`
})
