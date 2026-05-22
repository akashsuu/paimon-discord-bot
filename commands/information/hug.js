const axios = require('axios')

module.exports = {
    name: 'hug',
    aliases: ['hugs'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://api.waifu.pics/sfw/hug', {
                timeout: 10000
            })
            const image = response.data?.url

            if (!image) {
                throw new Error('Hug API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const description = target
                ? `${message.author} hugs ${target}!`
                : `${message.author} sends a hug!`

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Hug')
                .setDescription(description)
                .setImage(image)
                .setFooter({
                    text: 'Hug',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | hug api is **currently down**.`)
                ]
            })
        }
    }
}
