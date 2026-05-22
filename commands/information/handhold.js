const axios = require('axios')

module.exports = {
    name: 'handhold',
    aliases: ['holdhands'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/handhold', {
                timeout: 10000
            })
            const handhold = response.data?.results?.[0]

            if (!handhold?.url) {
                throw new Error('Handhold API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const description = target
                ? `${message.author} holds hands with ${target}!`
                : `${message.author} wants to hold hands!`

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Handhold')
                .setDescription(description)
                .setImage(handhold.url)
                .setFooter({
                    text: handhold.anime_name ? `Anime: ${handhold.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | handhold api is **currently down**.`)
                ]
            })
        }
    }
}
