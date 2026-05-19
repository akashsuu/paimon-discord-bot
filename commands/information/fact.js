const axios = require('axios')

module.exports = {
    name: 'fact',
    aliases: ['facts'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', {
                timeout: 10000
            })
            const fact = response.data

            if (!fact?.text) {
                throw new Error('Fact API returned an invalid response')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Random Fact')
                .setDescription(fact.text)
                .setFooter({
                    text: 'Fact',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | fact api is **currently down**.`)
                ]
            })
        }
    }
}
