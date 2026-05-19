const axios = require('axios')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

module.exports = {
    name: 'fakehack',
    aliases: ['fake-hack', 'hack'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        const target = message.mentions.users.first() || message.author

        try {
            const response = await axios.get('https://randomuser.me/api/', {
                timeout: 10000
            })
            const profile = response.data?.results?.[0]

            if (!profile) {
                throw new Error('Fake hack API returned an invalid response')
            }

            const fakeEmail = profile.email
            const fakeIp = `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
            const fakePassword = `${profile.login.username}_${Math.floor(Math.random() * 9000) + 1000}`

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Fake Hack')
                .setDescription(`Starting fake hack on ${target}...`)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setFooter({
                    text: 'Fake Hack',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            const sent = await message.channel.send({ embeds: [embed] })

            const steps = [
                'Connecting to Discord mainframe...',
                'Bypassing 2FA...',
                'Finding secret Genshin wishes...',
                `Email found: \`${fakeEmail}\``,
                `IP found: \`${fakeIp}\``,
                `Password found: \`${fakePassword}\``,
                'Uploading akashsuu supremacy...',
                `Fake hack complete. ${target} has been totally pranked.`
            ]

            for (const step of steps) {
                await delay(1200)
                embed.setDescription(step)
                await sent.edit({ embeds: [embed] })
            }
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | fake hack api is **currently down**.`)
                ]
            })
        }
    }
}
