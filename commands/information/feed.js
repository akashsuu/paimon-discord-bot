const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'feed',
    title: 'Feed',
    description: (author, target) => target ? `${author} feeds ${target}!` : `${author} shares some food!`
})
