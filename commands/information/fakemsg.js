const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')
const { createCanvas, loadImage } = require('canvas')

const requestHeaders = {
    'User-Agent': 'akashsuu-discord-bot/1.0'
}

const loadOptionalImage = async (url) => {
    if (!url) return null

    try {
        const response = await axios.get(url, {
            headers: requestHeaders,
            responseType: 'arraybuffer',
            timeout: 10000
        })
        return loadImage(Buffer.from(response.data))
    } catch {
        return null
    }
}

const getAvatarDecorationUrl = (user) => {
    if (typeof user.avatarDecorationURL === 'function') {
        return user.avatarDecorationURL({ size: 256 })
    }

    const asset = user.avatarDecorationData?.asset
    return asset ? `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png` : null
}

const getBadgeLabels = (user) => {
    const flags = user.flags?.toArray?.() || []
    const badges = []

    if (user.bot) badges.push({ text: 'APP', bg: '#5865f2', fg: '#ffffff' })
    if (flags.includes('ActiveDeveloper')) badges.push({ text: 'DEV', bg: '#3b3d45', fg: '#f2f3f5' })
    if (flags.includes('HypeSquadOnlineHouse1')) badges.push({ text: 'BRV', bg: '#3b3d45', fg: '#f2f3f5' })
    if (flags.includes('HypeSquadOnlineHouse2')) badges.push({ text: 'BRL', bg: '#3b3d45', fg: '#f2f3f5' })
    if (flags.includes('HypeSquadOnlineHouse3')) badges.push({ text: 'BAL', bg: '#3b3d45', fg: '#f2f3f5' })
    if (flags.includes('PremiumEarlySupporter')) badges.push({ text: 'OG', bg: '#3b3d45', fg: '#f2f3f5' })

    return badges.slice(0, 3)
}

const drawBadge = (ctx, x, y, badge) => {
    ctx.font = '700 20px "Segoe UI", Arial'
    const width = Math.max(54, ctx.measureText(badge.text).width + 24)

    ctx.fillStyle = badge.bg
    roundRect(ctx, x, y, width, 28, 7)
    ctx.fill()
    ctx.fillStyle = badge.fg
    ctx.fillText(badge.text, x + 12, y + 21)

    return width
}

const softenCanvas = (ctx, width, height, strength = 0.08) => {
    const image = ctx.getImageData(0, 0, width, height)
    const source = image.data
    const output = new Uint8ClampedArray(source)
    const mix = Math.max(0, Math.min(strength, 0.18))

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const index = (y * width + x) * 4

            for (let channel = 0; channel < 3; channel++) {
                const average = (
                    source[index + channel - 4] +
                    source[index + channel + 4] +
                    source[index + channel - width * 4] +
                    source[index + channel + width * 4]
                ) / 4

                output[index + channel] = source[index + channel] * (1 - mix) + average * mix
            }
        }
    }

    image.data.set(output)
    ctx.putImageData(image, 0, 0)
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

const fitText = (ctx, text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) return text

    let trimmed = text
    while (trimmed.length > 1 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
        trimmed = trimmed.slice(0, -1)
    }

    return `${trimmed}...`
}

const formatDiscordTime = () => {
    const now = new Date()
    let hours = now.getHours()
    const minutes = `${now.getMinutes()}`.padStart(2, '0')
    const suffix = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    return `${hours}:${minutes} ${suffix}`
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
            const user = await client.users.fetch(member.id, { force: true }).catch(() => member.user)
            const avatarUrl = user.displayAvatarURL({
                extension: 'png',
                size: 256,
                forceStatic: true
            })
            const [avatarResponse, decoration] = await Promise.all([
                axios.get(avatarUrl, {
                    headers: requestHeaders,
                    responseType: 'arraybuffer',
                    timeout: 10000
                }),
                loadOptionalImage(getAvatarDecorationUrl(user))
            ])
            const avatar = await loadImage(Buffer.from(avatarResponse.data))

            const canvas = createCanvas(1080, 196)
            const ctx = canvas.getContext('2d')
            const rawDisplayName = member.displayName || user.username
            const nameColor = member.displayHexColor && member.displayHexColor !== '#000000'
                ? member.displayHexColor
                : '#f2f3f5'
            const time = formatDiscordTime()

            ctx.fillStyle = '#313338'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.fillStyle = '#232428'
            ctx.fillRect(0, 0, canvas.width, 1)
            ctx.fillRect(0, canvas.height - 1, canvas.width, 1)

            ctx.fillStyle = 'rgba(255, 255, 255, 0.018)'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            ctx.save()
            ctx.beginPath()
            ctx.arc(88, 84, 50, 0, Math.PI * 2)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(avatar, 38, 34, 100, 100)
            ctx.restore()

            if (decoration) {
                ctx.drawImage(decoration, 22, 18, 132, 132)
            }

            ctx.font = '600 34px "Segoe UI", Arial'
            const displayName = fitText(ctx, rawDisplayName, 460)
            ctx.fillStyle = nameColor
            ctx.fillText(displayName, 176, 64)
            let x = 176 + ctx.measureText(displayName).width + 12

            for (const badge of getBadgeLabels(user)) {
                x += drawBadge(ctx, x, 38, badge) + 10
            }

            ctx.font = '26px "Segoe UI", Arial'
            ctx.fillStyle = '#949ba4'
            ctx.fillText(time, x, 64)

            ctx.font = '40px Arial'
            ctx.fillStyle = '#dbdee1'
            const lines = wrapText(ctx, content, 840).slice(0, 2)
            lines.forEach((line, index) => {
                ctx.fillText(line, 176, 116 + index * 44)
            })

            softenCanvas(ctx, canvas.width, canvas.height)

            const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), {
                name: 'fakemsg.png'
            })
            const embed = client.util.embed()
                .setColor(client.color)
                .setAuthor({
                    name: `Message from ${rawDisplayName}`,
                    iconURL: user.displayAvatarURL({ dynamic: true })
                })
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
                        .setDescription(`${client.emoji.cross} | message generator failed.`)
                ]
            })
        }
    }
}
