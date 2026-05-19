const axios = require('axios')

module.exports = {
    name: 'dog',
    aliases: ['cooldog', 'dogimage', 'woof'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://dog.ceo/api/breeds/image/random', {
                timeout: 10000
            })
            const image = response.data?.message

            if (!image) {
                throw new Error('Dog API returned no image URL')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Cool Dog')
                .setDescription('A cool dog has appeared.')
                .setImage(image)
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
                        .setDescription(`${client.emoji.cross} | dog api is **currently down**.`)
                ]
            })
        }
    }
}
