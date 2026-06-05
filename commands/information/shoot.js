const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'shoot',
    title: 'Shoot',
    description: (author, target) => target ? `${author} shoots at ${target}!` : `${author} takes a shot!`
})
