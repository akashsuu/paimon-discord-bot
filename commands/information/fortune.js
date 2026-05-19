const axios = require('axios')

module.exports = {
    name: 'fortune',
    aliases: ['fortunecookie'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            let fortune

            try {
                const response = await axios.get('https://yerkee.com/api/fortune', {
                    timeout: 10000
                })
                fortune = response.data?.fortune
            } catch (err) {
                const response = await axios.get('https://api.adviceslip.com/advice', {
                    timeout: 10000
                })
                fortune = response.data?.slip?.advice
            }

            if (!fortune) {
                throw new Error('Fortune API returned an invalid response')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Fortune')
                .setDescription(fortune)
                .setFooter({
                    text: 'Fortune',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | fortune api is **currently down**.`)
                ]
            })
        }
    }
}
