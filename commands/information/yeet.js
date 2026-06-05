const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'yeet',
    title: 'Yeet',
    description: (author, target) => target ? `${author} yeets ${target}!` : `${author} yeets something away!`
})
