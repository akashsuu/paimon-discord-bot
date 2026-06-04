const axios = require('axios')

module.exports = {
    name: 'laugh',
    aliases: ['laughs'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/laugh', {
                timeout: 10000
            })
            const laugh = response.data?.results?.[0]

            if (!laugh?.url) {
                throw new Error('Laugh API returned an invalid response')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Laugh')
                .setDescription(`${message.author} is laughing!`)
                .setImage(laugh.url)
                .setFooter({
                    text: laugh.anime_name ? `Anime: ${laugh.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | laugh api is **currently down**.`)
                ]
            })
        }
    }
}
