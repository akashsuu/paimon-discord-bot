const axios = require('axios')

module.exports = {
    name: 'quote',
    aliases: ['quotes'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://api.quotable.io/random', {
                timeout: 10000
            })
            const quote = response.data

            if (!quote?.content) {
                throw new Error('Quote API returned an invalid response')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Random Quote')
                .setDescription(`"${quote.content}"`)
                .setFooter({
                    text: quote.author ? `- ${quote.author}` : 'Quote',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | quote api is **currently down**.`)
                ]
            })
        }
    }
}
