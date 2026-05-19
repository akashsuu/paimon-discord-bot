const axios = require('axios')

module.exports = {
    name: 'dance',
    aliases: ['dances'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/dance', {
                timeout: 10000
            })
            const dance = response.data?.results?.[0]

            if (!dance?.url) {
                throw new Error('Dance API returned an invalid response')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Dance')
                .setDescription(`${message.author} starts dancing!`)
                .setImage(dance.url)
                .setFooter({
                    text: dance.anime_name ? `Anime: ${dance.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | dance api is **currently down**.`)
                ]
            })
        }
    }
}
