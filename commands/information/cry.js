const axios = require('axios')

module.exports = {
    name: 'cry',
    aliases: ['cries'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/cry', {
                timeout: 10000
            })
            const cry = response.data?.results?.[0]

            if (!cry?.url) {
                throw new Error('Cry API returned an invalid response')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Cry')
                .setDescription(`${message.author} is crying...`)
                .setImage(cry.url)
                .setFooter({
                    text: cry.anime_name ? `Anime: ${cry.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | cry api is **currently down**.`)
                ]
            })
        }
    }
}
