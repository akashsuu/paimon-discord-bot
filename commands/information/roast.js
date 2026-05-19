const axios = require('axios')

module.exports = {
    name: 'roast',
    aliases: ['burn'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://evilinsult.com/generate_insult.php?lang=en&type=json', {
                timeout: 10000
            })
            const roast = response.data?.insult

            if (!roast) {
                throw new Error('Roast API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle(target ? `Roast for ${target.username}` : 'Roast')
                .setDescription(roast)
                .setFooter({
                    text: 'Roast',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | roast api is **currently down**.`)
                ]
            })
        }
    }
}
