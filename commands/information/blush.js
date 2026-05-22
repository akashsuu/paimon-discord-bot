const axios = require('axios')

module.exports = {
    name: 'blush',
    aliases: ['blushing'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/blush', {
                timeout: 10000
            })
            const blush = response.data?.results?.[0]

            if (!blush?.url) {
                throw new Error('Blush API returned an invalid response')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Blush')
                .setDescription(`${message.author} is blushing!`)
                .setImage(blush.url)
                .setFooter({
                    text: blush.anime_name ? `Anime: ${blush.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | blush api is **currently down**.`)
                ]
            })
        }
    }
}
