const {
    mangaSearch,
    mangaSelect,
    mangaChapter
} = require('../../structures/animeMangaSearch')

module.exports = {
    name: 'manga',
    aliases: ['manhwa', 'manhua'],
    category: 'utility',
    cooldown: 5,
    run: async (client, message, args) => {
        const sub = String(args[0] || '').toLowerCase()

        try {
            if (!args.length) {
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`Usage: \`${message.guild.prefix}manga solo leveling\`, \`${message.guild.prefix}manga select 1\`, \`${message.guild.prefix}manga chapter 1\``)
                    ]
                })
            }

            if (sub === 'select') {
                return mangaSelect(client, message, Number.parseInt(args[1], 10))
            }

            if (['ch', 'chapter'].includes(sub)) {
                return mangaChapter(client, message, Number.parseInt(args[1], 10))
            }

            return mangaSearch(client, message, args.join(' '))
        } catch (err) {
            client.logger?.log?.(`manga command error: ${err.stack || err.message}`, 'error')
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | manga api is currently unavailable.`)
                ]
            })
        }
    }
}
