const axios = require('axios')

module.exports = {
    name: 'angry',
    aliases: ['mad'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/angry', {
                timeout: 10000
            })
            const angry = response.data?.results?.[0]

            if (!angry?.url) {
                throw new Error('Angry API returned an invalid response')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Angry')
                .setDescription(`${message.author} is angry!`)
                .setImage(angry.url)
                .setFooter({
                    text: angry.anime_name ? `Anime: ${angry.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | angry api is **currently down**.`)
                ]
            })
        }
    }
}
