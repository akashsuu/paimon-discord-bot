const axios = require('axios')

module.exports = {
    name: 'kiss',
    aliases: ['kisses'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/kiss', {
                timeout: 10000
            })
            const kiss = response.data?.results?.[0]

            if (!kiss?.url) {
                throw new Error('Kiss API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const description = target
                ? `${message.author} kisses ${target}!`
                : `${message.author} sends a kiss!`

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Kiss')
                .setDescription(description)
                .setImage(kiss.url)
                .setFooter({
                    text: kiss.anime_name ? `Anime: ${kiss.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | kiss api is **currently down**.`)
                ]
            })
        }
    }
}
