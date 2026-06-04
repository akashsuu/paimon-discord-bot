const axios = require('axios')

module.exports = {
    name: 'slap',
    aliases: ['slaps'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/slap', {
                timeout: 10000
            })
            const slap = response.data?.results?.[0]

            if (!slap?.url) {
                throw new Error('Slap API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const description = target
                ? `${message.author} slaps ${target}!`
                : `${message.author} slaps the air!`

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Slap')
                .setDescription(description)
                .setImage(slap.url)
                .setFooter({
                    text: slap.anime_name ? `Anime: ${slap.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | slap api is **currently down**.`)
                ]
            })
        }
    }
}
