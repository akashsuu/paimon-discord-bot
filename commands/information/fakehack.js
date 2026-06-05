const axios = require('axios')
const crypto = require('crypto')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const randomTokenPart = (length) => crypto.randomBytes(length)
    .toString('base64url')
    .slice(0, length)
const randomUpper = () => String.fromCharCode(65 + Math.floor(Math.random() * 26))
const fakeDiscordToken = () => {
    const prefix = `${Math.random() < 0.5 ? 'MT' : 'OD'}${randomUpper()}`
    return `${prefix}${randomTokenPart(21)}.${randomTokenPart(6)}.${randomTokenPart(38)}`
}

const cleanEmailName = (username, fallback) => {
    const clean = String(username || '')
        .toLowerCase()
        .replace(/[^a-z0-9._]/g, '')
        .replace(/^\.+|\.+$/g, '')
    return clean || fallback
}

module.exports = {
    name: 'hack',
    aliases: [],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        const target = message.mentions.users.first() || message.author
        const targetMember = message.mentions.members.first() || message.member
        const targetDisplayName = targetMember?.displayName || target.globalName || target.username
        const targetUsername = target.username
        const targetEmailName = cleanEmailName(targetUsername, target.id)

        try {
            const response = await axios.get('https://randomuser.me/api/', {
                timeout: 10000
            }).catch(() => null)
            const profile = response?.data?.results?.[0]

            const fakeEmail = `${targetEmailName}@gmail.com`
            const fakeIp = `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
            const fakePassword = `${targetUsername}_${Math.floor(Math.random() * 9000) + 1000}`
            const fakeName = targetDisplayName
            const fakeUsername = targetUsername
            const fakePhone = profile?.phone || `+91 ${Math.floor(Math.random() * 90000) + 10000}-${Math.floor(Math.random() * 90000) + 10000}`
            const fakeLocation = profile?.location
                ? `${profile.location.city}, ${profile.location.country}`
                : 'Unknown Discord sector'
            const fakeToken = fakeDiscordToken()

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
