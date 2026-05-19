const axios = require('axios')

module.exports = {
    name: 'pat',
    aliases: ['pats'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/pat', {
                timeout: 10000
            })
            const pat = response.data?.results?.[0]

            if (!pat?.url) {
                throw new Error('Pat API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const description = target
                ? `${message.author} pats ${target}!`
                : `${message.author} gives a gentle pat!`

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Pat')
                .setDescription(description)
                .setImage(pat.url)
                .setFooter({
                    text: pat.anime_name ? `Anime: ${pat.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | pat api is **currently down**.`)
                ]
            })
        }
    }
}
