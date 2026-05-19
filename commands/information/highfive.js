const axios = require('axios')

module.exports = {
    name: 'highfive',
    aliases: ['high5'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/highfive', {
                timeout: 10000
            })
            const highfive = response.data?.results?.[0]

            if (!highfive?.url) {
                throw new Error('Highfive API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const description = target
                ? `${message.author} high-fives ${target}!`
                : `${message.author} wants a high-five!`

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Highfive')
                .setDescription(description)
                .setImage(highfive.url)
                .setFooter({
                    text: highfive.anime_name ? `Anime: ${highfive.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | highfive api is **currently down**.`)
                ]
            })
        }
    }
}
