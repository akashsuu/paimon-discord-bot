const axios = require('axios')

module.exports = {
    name: 'tickle',
    aliases: ['tickles'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/tickle', {
                timeout: 10000
            })
            const tickle = response.data?.results?.[0]

            if (!tickle?.url) {
                throw new Error('Tickle API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const description = target
                ? `${message.author} tickles ${target}!`
                : `${message.author} tickles the air!`

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Tickle')
                .setDescription(description)
                .setImage(tickle.url)
                .setFooter({
                    text: tickle.anime_name ? `Anime: ${tickle.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | tickle api is **currently down**.`)
                ]
            })
        }
    }
}
