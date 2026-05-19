const axios = require('axios')

module.exports = {
    name: 'wave',
    aliases: ['waves'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/wave', {
                timeout: 10000
            })
            const wave = response.data?.results?.[0]

            if (!wave?.url) {
                throw new Error('Wave API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const description = target
                ? `${message.author} waves at ${target}!`
                : `${message.author} waves!`

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Wave')
                .setDescription(description)
                .setImage(wave.url)
                .setFooter({
                    text: wave.anime_name ? `Anime: ${wave.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | wave api is **currently down**.`)
                ]
            })
        }
    }
}
