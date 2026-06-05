const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'happy',
    title: 'Happy',
    description: (author) => `${author} looks happy!`
})
