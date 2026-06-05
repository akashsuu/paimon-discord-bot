const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'sip',
    title: 'Sip',
    description: (author) => `${author} takes a sip.`
})
