const {
    animeSearch,
    animeSelect,
    animeEpisode
} = require('../../structures/animeMangaSearch')

module.exports = {
    name: 'anime',
    aliases: ['ani'],
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
                            .setDescription(`Usage: \`${message.guild.prefix}anime demon slayer\`, \`${message.guild.prefix}anime select 1\`, \`${message.guild.prefix}anime ep 1\``)
                    ]
                })
            }

            if (sub === 'select') {
                return animeSelect(client, message, Number.parseInt(args[1], 10))
            }

            if (['ep', 'episode'].includes(sub)) {
                return animeEpisode(client, message, Number.parseInt(args[1], 10))
            }

            return animeSearch(client, message, args.join(' '))
        } catch (err) {
            client.logger?.log?.(`anime command error: ${err.stack || err.message}`, 'error')
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | anime api is currently unavailable.`)
                ]
            })
        }
    }
}
