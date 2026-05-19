const axios = require('axios')

module.exports = {
    name: 'dadjoke',
    aliases: ['dadjokes'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://icanhazdadjoke.com/', {
                headers: {
                    Accept: 'application/json'
                },
                timeout: 10000
            })
            const joke = response.data?.joke

            if (!joke) {
                throw new Error('Dad joke API returned an invalid response')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Dad Joke')
                .setDescription(joke)
                .setFooter({
                    text: 'Dad Joke',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | dad joke api is **currently down**.`)
                ]
            })
        }
    }
}
