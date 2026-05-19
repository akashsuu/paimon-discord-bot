const axios = require('axios')

module.exports = {
    name: 'bite',
    aliases: ['bites'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/bite', {
                timeout: 10000
            })
            const bite = response.data?.results?.[0]

            if (!bite?.url) {
                throw new Error('Bite API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const description = target
                ? `${message.author} bites ${target}!`
                : `${message.author} bites the air!`

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Bite')
                .setDescription(description)
                .setImage(bite.url)
                .setFooter({
                    text: bite.anime_name ? `Anime: ${bite.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | bite api is **currently down**.`)
                ]
            })
        }
    }
}
