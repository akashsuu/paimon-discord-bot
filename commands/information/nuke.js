const axios = require('axios')

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

module.exports = {
    name: 'nuke',
    aliases: [],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        if (!message.member.permissions.has('Administrator')) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | You must have \`Administrator\` permissions to use this command.`)
                ]
            })
        }

        let fact = 'No real channels were harmed.'

        try {
            const response = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', {
                timeout: 10000
            })
            fact = response.data?.text || fact
        } catch (err) {
            fact = 'API report unavailable, but the nuke simulation is still harmless.'
        }

        const embed = client.util.embed()
            .setColor(client.color)
            .setTitle('Server Nuke')
            .setDescription(`Nuke started by ${message.author}.\nCountdown: **15** seconds`)
            .setFooter({
                text: 'Nuke',
                iconURL: client.user.displayAvatarURL({ dynamic: true })
            })

        const sent = await message.channel.send({ embeds: [embed] })

        for (let seconds = 14; seconds >= 0; seconds--) {
            await wait(1000)
            embed.setDescription(`Nuke started by ${message.author}.\nCountdown: **${seconds}** seconds`)
            await sent.edit({ embeds: [embed] })
        }

        embed
            .setTitle('Server Nuke Complete')
            .setDescription(`Boom. Just kidding.\n\n**Result:** This was a nuke simulation only.\n**API report:** ${fact}`)

        return sent.edit({ embeds: [embed] })
    }
}
