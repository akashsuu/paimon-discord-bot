const axios = require('axios')

module.exports = {
    name: 'advice',
    aliases: ['advise'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://api.adviceslip.com/advice', {
                timeout: 10000
            })
            const advice = response.data?.slip?.advice

            if (!advice) {
                throw new Error('Advice API returned an invalid response')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Advice')
                .setDescription(advice)
                .setFooter({
                    text: 'Advice',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | advice api is **currently down**.`)
                ]
            })
        }
    }
}
