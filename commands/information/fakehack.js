const axios = require('axios')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

module.exports = {
    name: 'hack',
    aliases: [],
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
                throw new Error('Hack API returned an invalid response')
            }

            const fakeEmail = profile.email
            const fakeIp = `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
            const fakePassword = `${profile.login.username}_${Math.floor(Math.random() * 9000) + 1000}`
            const fakeName = `${profile.name.first} ${profile.name.last}`
            const fakeUsername = profile.login.username
            const fakePhone = profile.phone
            const fakeLocation = `${profile.location.city}, ${profile.location.country}`
            const fakeToken = Buffer.from(`${fakeUsername}:${Date.now()}`).toString('base64').slice(0, 32)

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Hack')
                .setDescription(`Starting hack on ${target}...`)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setFooter({
                    text: 'Hack',
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
                `Hack complete. ${target} has been totally pranked.`
            ]

            for (const step of steps) {
                await delay(1200)
                embed.setDescription(step)
                await sent.edit({ embeds: [embed] })
            }

            embed
                .setTitle('Hack Complete')
                .setDescription(`${target} has been totally pranked. All details below are generated for fun.`)
                .addFields([
                    { name: 'Target', value: `${target.tag || target.username} (${target.id})`, inline: false },
                    { name: 'Name', value: `\`${fakeName}\``, inline: true },
                    { name: 'Username', value: `\`${fakeUsername}\``, inline: true },
                    { name: 'Email', value: `\`${fakeEmail}\``, inline: false },
                    { name: 'Password', value: `\`${fakePassword}\``, inline: true },
                    { name: 'IP Address', value: `\`${fakeIp}\``, inline: true },
                    { name: 'Phone', value: `\`${fakePhone}\``, inline: true },
                    { name: 'Location', value: `\`${fakeLocation}\``, inline: true },
                    { name: 'Token', value: `\`${fakeToken}\``, inline: false }
                ])

            return sent.edit({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | hack api is **currently down**.`)
                ]
            })
        }
    }
}
