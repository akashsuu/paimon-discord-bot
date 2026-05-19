const axios = require('axios')

module.exports = {
    name: 'sleep',
    aliases: ['sleepy'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/sleep', {
                timeout: 10000
            })
            const sleep = response.data?.results?.[0]

            if (!sleep?.url) {
                throw new Error('Sleep API returned an invalid response')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Sleep')
                .setDescription(`${message.author} is sleepy...`)
                .setImage(sleep.url)
                .setFooter({
                    text: sleep.anime_name ? `Anime: ${sleep.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | sleep api is **currently down**.`)
                ]
            })
        }
    }
}
