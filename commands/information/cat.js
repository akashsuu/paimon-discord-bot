const axios = require('axios')

module.exports = {
    name: 'cat',
    aliases: ['coolcat', 'catimage', 'meow'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://api.thecatapi.com/v1/images/search', {
                timeout: 10000
            })
            const image = response.data?.[0]?.url

            if (!image) {
                throw new Error('Cat API returned no image URL')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Cool Cat')
                .setDescription('A cool cat has appeared.')
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
                        .setDescription(`${client.emoji.cross} | cat api is **currently down**.`)
                ]
            })
        }
    }
}
