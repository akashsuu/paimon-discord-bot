const axios = require('axios')

module.exports = {
    name: 'compliment',
    aliases: ['compliments'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://complimentr.com/api', {
                timeout: 10000
            })
            const compliment = response.data?.compliment

            if (!compliment) {
                throw new Error('Compliment API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle(target ? `Compliment for ${target.username}` : 'Compliment')
                .setDescription(compliment)
                .setFooter({
                    text: 'Compliment',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | compliment api is **currently down**.`)
                ]
            })
        }
    }
}
