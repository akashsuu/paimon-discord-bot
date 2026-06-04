const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

const gifUrls = [
    'https://media.tenor.com/x8v1oNUOmg4AAAAd/rickroll-roll.gif',
    'https://c.tenor.com/x8v1oNUOmg4AAAAd/rickroll-roll.gif'
]

const loadGif = async () => {
    for (const url of gifUrls) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 10000
            })

            return Buffer.from(response.data)
        } catch (err) {}
    }

    return null
}

module.exports = {
    name: 'rickroll',
    aliases: ['rick', 'never gonna give you up'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        const gif = await loadGif()
        const embed = client.util.embed()
            .setColor(client.color)
            .setTitle('Never Gonna Give You Up')
            .setDescription('[You know the rules.](https://www.youtube.com/watch?v=dQw4w9WgXcQ)')
            .setFooter({
                text: 'akashsuu',
                iconURL: client.user.displayAvatarURL({ dynamic: true })
            })

        if (!gif) {
            return message.channel.send({ embeds: [embed] })
        }

        const attachment = new AttachmentBuilder(gif, {
            name: 'rickroll.gif'
        })

        embed.setImage('attachment://rickroll.gif')

        return message.channel.send({ embeds: [embed], files: [attachment] })
    }
}
