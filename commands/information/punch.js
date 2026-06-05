const createNekosBestCommand = require('../../structures/nekosBestCommand')

module.exports = createNekosBestCommand({
    name: 'punch',
    title: 'Punch',
    description: (author, target) => target ? `${author} punches ${target}!` : `${author} throws a punch!`
})
