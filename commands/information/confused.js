const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'confused',
    title: 'Confused',
    description: (author) => `${author} looks confused.`
})
