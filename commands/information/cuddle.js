const axios = require('axios')

module.exports = {
    name: 'cuddle',
    aliases: ['cuddles'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/cuddle', {
                timeout: 10000
            })
            const cuddle = response.data?.results?.[0]

            if (!cuddle?.url) {
                throw new Error('Cuddle API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const description = target
                ? `${message.author} cuddles ${target}!`
                : `${message.author} wants cuddles!`

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Cuddle')
                .setDescription(description)
                .setImage(cuddle.url)
                .setFooter({
                    text: cuddle.anime_name ? `Anime: ${cuddle.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | cuddle api is **currently down**.`)
                ]
            })
        }
    }
}
