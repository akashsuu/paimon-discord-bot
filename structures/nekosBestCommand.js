const axios = require('axios')

const titleCase = (value) => String(value || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

module.exports = ({ name, endpoint = name, title = titleCase(name), description }) => ({
    name,
    aliases: [],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get(`https://nekos.best/api/v2/${endpoint}`, {
                timeout: 10000
            })
            const result = response.data?.results?.[0]

            if (!result?.url) {
                throw new Error(`${title} API returned an invalid response`)
            }

            const target = message.mentions.users.first()
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle(title)
                .setDescription(description(message.author, target))
                .setImage(result.url)
                .setFooter({
                    text: result.anime_name ? `Anime: ${result.anime_name}` : 'Anime: Unknown',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | ${name} api is **currently down**.`)
                ]
            })
        }
    }
})
