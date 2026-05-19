const axios = require('axios')

module.exports = {
    name: 'thumbups',
    aliases: ['thumbsup', 'thumbsups', 'thumbs_up'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/thumbsup', {
                timeout: 10000
            })
            const thumbups = response.data?.results?.[0]

            if (!thumbups?.url) {
                throw new Error('Thumbups API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const description = target
                ? `${message.author} gives ${target} a thumbs up!`
                : `${message.author} gives a thumbs up!`

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Thumbups')
                .setDescription(description)
                .setImage(thumbups.url)
                .setFooter({
                    text: thumbups.anime_name ? `Anime: ${thumbups.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | thumbups api is **currently down**.`)
                ]
            })
        }
    }
}
