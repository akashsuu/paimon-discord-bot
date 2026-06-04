const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

module.exports = {
    name: 'alien',
    aliases: ['aliencat', 'glorp'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://media1.tenor.com/m/iO59x1wpj5sAAAAd/glorp-dance-alien-cat.gif', {
                responseType: 'arraybuffer',
                timeout: 10000
            })
            const attachment = new AttachmentBuilder(Buffer.from(response.data), {
                name: 'alien.gif'
            })
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('zip zip zap zup zip')
                .setImage('attachment://alien.gif')
                .setFooter({
                    text: 'akashsuu',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed], files: [attachment] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | alien gif failed to load.`)
                ]
            })
        }
    }
}
