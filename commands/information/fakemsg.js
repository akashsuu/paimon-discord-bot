const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')
const { createCanvas, loadImage } = require('canvas')

const requestHeaders = {
    'User-Agent': 'akashsuu-discord-bot/1.0'
}

const getUserFromMention = async (message, mention) => {
    if (!mention) return null

    const matches = mention.match(/^<@!?(\d+)>$/)
    if (!matches) return null

    return message.guild.members.fetch(matches[1]).catch(() => null)
}

const wrapText = (ctx, text, maxWidth) => {
    const words = text.split(/\s+/)
    const lines = []
    let line = ''

    for (const word of words) {
        const testLine = line ? `${line} ${word}` : word
        if (ctx.measureText(testLine).width > maxWidth && line) {
            lines.push(line)
            line = word
        } else {
            line = testLine
        }
    }

    if (line) lines.push(line)
    return lines
}

const roundRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
}

module.exports = {
    name: 'fakemsg',
    aliases: ['fakemessage', 'fm'],
    category: 'fun',
    premium: true,
    run: async (client, message, args) => {
        const member = await getUserFromMention(message, args[0])
        const content = args.slice(1).join(' ').trim()

        if (!member || !content) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${message.guild.prefix}fakemsg @user your message\``)
                ]
            })
        }

        try {
            const avatarResponse = await axios.get(member.user.displayAvatarURL({
                extension: 'png',
                size: 256,
                forceStatic: true
            }), {
                headers: requestHeaders,
                responseType: 'arraybuffer',
                timeout: 10000
            })
            const avatar = await loadImage(Buffer.from(avatarResponse.data))

            const canvas = createCanvas(920, 260)
            const ctx = canvas.getContext('2d')
            const displayName = member.displayName || member.user.username
            const nameColor = member.displayHexColor && member.displayHexColor !== '#000000'
                ? member.displayHexColor
                : '#f2f3f5'
            const time = new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            })

            ctx.fillStyle = '#313338'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            ctx.fillStyle = '#2b2d31'
            roundRect(ctx, 28, 28, 864, 204, 10)
            ctx.fill()

            ctx.save()
            ctx.beginPath()
            ctx.arc(82, 86, 34, 0, Math.PI * 2)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(avatar, 48, 52, 68, 68)
            ctx.restore()

            ctx.font = 'bold 22px Arial'
            ctx.fillStyle = nameColor
            ctx.fillText(displayName, 132, 72)
            let x = 132 + ctx.measureText(displayName).width + 10

            if (member.user.bot) {
                ctx.fillStyle = '#5865f2'
                roundRect(ctx, x, 52, 42, 23, 5)
                ctx.fill()
                ctx.font = 'bold 13px Arial'
                ctx.fillStyle = '#ffffff'
                ctx.fillText('APP', x + 8, 68)
                x += 52
            }

            if (member.id === message.guild.ownerId) {
                ctx.fillStyle = '#f0b232'
                roundRect(ctx, x, 52, 68, 23, 5)
                ctx.fill()
                ctx.font = 'bold 12px Arial'
                ctx.fillStyle = '#1e1f22'
                ctx.fillText('OWNER', x + 10, 68)
                x += 78
            }

            ctx.font = '16px Arial'
            ctx.fillStyle = '#949ba4'
            ctx.fillText(`Today at ${time}`, x, 70)

            ctx.font = '22px Arial'
            ctx.fillStyle = '#dbdee1'
            const lines = wrapText(ctx, content, 720).slice(0, 5)
            lines.forEach((line, index) => {
                ctx.fillText(line, 132, 112 + index * 30)
            })

            ctx.font = '12px Arial'
            ctx.fillStyle = '#6d7380'
            ctx.fillText('simulated message by akashsuu', 704, 218)

            const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), {
                name: 'fakemsg.png'
            })
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Fake Message')
                .setImage('attachment://fakemsg.png')
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
                        .setDescription(`${client.emoji.cross} | fake message generator failed.`)
                ]
            })
        }
    }
}
