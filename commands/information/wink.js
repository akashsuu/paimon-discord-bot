const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'wink',
    title: 'Wink',
    description: (author, target) => target ? `${author} winks at ${target}!` : `${author} winks!`
})
