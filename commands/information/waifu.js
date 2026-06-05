const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'waifu',
    title: 'Waifu',
    description: (author) => `${author} found a waifu!`
})
