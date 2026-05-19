const axios = require('axios')

module.exports = {
    name: '404',
    aliases: ['notfound', 'lost'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const imageUrl = 'https://http.cat/404'
            const response = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', {
                timeout: 10000
            })
            const fact = response.data?.text || 'The page ran away before akashsuu could catch it.'

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('404 Not Found')
                .setDescription(`Something disappeared.\n\n**Random report:** ${fact}`)
                .setImage(imageUrl)
                .setFooter({
                    text: 'akashsuu',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | 404 api is **currently down**.`)
                ]
            })
        }
    }
}
