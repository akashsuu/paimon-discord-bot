const axios = require('axios')

module.exports = {
    name: 'poke',
    aliases: ['pokes'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://nekos.best/api/v2/poke', {
                timeout: 10000
            })
            const poke = response.data?.results?.[0]

            if (!poke?.url) {
                throw new Error('Poke API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const description = target
                ? `${message.author} pokes ${target}!`
                : `${message.author} pokes the air!`

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Poke')
                .setDescription(description)
                .setImage(poke.url)
                .setFooter({
                    text: poke.anime_name ? `Anime: ${poke.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | poke api is **currently down**.`)
                ]
            })
        }
    }
}
