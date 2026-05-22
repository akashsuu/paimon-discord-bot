const axios = require('axios')

module.exports = {
    name: 'insult',
    aliases: ['insults'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://evilinsult.com/generate_insult.php?lang=en&type=json', {
                timeout: 10000
            })
            const insult = response.data?.insult

            if (!insult) {
                throw new Error('Insult API returned an invalid response')
            }

            const target = message.mentions.users.first()
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle(target ? `Insult for ${target.username}` : 'Insult')
                .setDescription(insult)
                .setFooter({
                    text: 'Insult',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | insult api is **currently down**.`)
                ]
            })
        }
    }
}
