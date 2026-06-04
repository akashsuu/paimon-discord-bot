const axios = require('axios')

module.exports = {
    name: 'joke',
    aliases: ['jokes'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://official-joke-api.appspot.com/random_joke', {
                timeout: 10000
            })
            const joke = response.data

            if (!joke?.setup || !joke?.punchline) {
                throw new Error('Joke API returned an invalid response')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle(joke.setup)
                .setDescription(`**${joke.punchline}**`)
                .setFooter({
                    text: 'Joke',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | joke api is **currently down**.`)
                ]
            })
        }
    }
}
