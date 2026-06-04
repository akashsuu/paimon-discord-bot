const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

const paimonLines = [
    'Emergency food has arrived.',
    'Paimon is here to guide the Traveler.',
    'Hey! Paimon is not emergency food.',
    'Paimon heard snacks and appeared instantly.',
    'Best guide in Teyvat reporting for duty.'
]

const paimonImageUrl = 'https://upload.wikimedia.org/wikipedia/en/a/af/Paimon_%28Genshin_Impact%29.png'
const requestHeaders = {
    'User-Agent': 'akashsuu-discord-bot/1.0'
}

module.exports = {
    name: 'summon',
    aliases: ['paimon', 'summonpaimon'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const [characterResponse, imageResponse] = await Promise.all([
                axios.get('https://genshin.jmp.blue/characters', {
                    headers: requestHeaders,
                    timeout: 10000
                }).catch(() => axios.get('https://api.genshin.dev/characters', {
                    headers: requestHeaders,
                    timeout: 10000
                })).catch(() => ({ data: [] })),
                axios.get(paimonImageUrl, {
                    headers: requestHeaders,
                    responseType: 'arraybuffer',
                    timeout: 10000
                })
            ])
            const characterCount = Array.isArray(characterResponse.data) ? characterResponse.data.length : 'many'
            const line = paimonLines[Math.floor(Math.random() * paimonLines.length)]
            const attachment = new AttachmentBuilder(Buffer.from(imageResponse.data), {
                name: 'paimon.png'
            })

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Paimon Summoned')
                .setDescription(
                    `**${line}**\n\n` +
                    `Teyvat signal synced with **${characterCount}** known character records.`
                )
                .setImage('attachment://paimon.png')
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
                        .setDescription(`${client.emoji.cross} | paimon summon api is **currently down**.`)
                ]
            })
        }
    }
}
