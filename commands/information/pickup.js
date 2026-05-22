const axios = require('axios')

module.exports = {
    name: 'pickup',
    aliases: ['pickupline'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://vinuxd.vercel.app/api/pickup', {
                timeout: 10000
            })
            const line = response.data?.pickup || response.data?.line || response.data?.text

            if (!line) {
                throw new Error('Pickup API returned an invalid response')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Pickup Line')
                .setDescription(line)
                .setFooter({
                    text: 'Pickup',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | pickup api is **currently down**.`)
                ]
            })
        }
    }
}
