const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'stare',
    title: 'Stare',
    description: (author, target) => target ? `${author} stares at ${target}.` : `${author} stares.`
})
