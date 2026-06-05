const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'nope',
    title: 'Nope',
    description: (author) => `${author} says nope.`
})
