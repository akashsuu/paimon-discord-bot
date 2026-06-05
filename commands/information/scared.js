const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'scared',
    title: 'Scared',
    description: (author) => `${author} looks scared.`
})
