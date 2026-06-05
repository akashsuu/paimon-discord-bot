const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'facepalm',
    title: 'Facepalm',
    description: (author) => `${author} facepalms.`
})
