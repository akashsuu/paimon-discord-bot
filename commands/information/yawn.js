const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'yawn',
    title: 'Yawn',
    description: (author) => `${author} yawns.`
})
