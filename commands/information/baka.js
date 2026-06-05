const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'baka',
    title: 'Baka',
    description: (author, target) => target ? `${author} calls ${target} baka!` : `${author} says baka!`
})
