const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')
const { createCanvas, loadImage } = require('canvas')

const requestHeaders = {
    'User-Agent': 'akashsuu-discord-bot/1.0'
}

const getUserFromMention = async (message, mention) => {
    if (!mention) return message.member

    const matches = mention.match(/^<@!?(\d+)>$/)
    if (!matches) return null

    return message.guild.members.fetch(matches[1]).catch(() => null)
}

module.exports = {
    name: 'pixle',
    aliases: ['pixel', 'pixelate', 'pixelpfp'],
    category: 'fun',
    premium: true,
    run: async (client, message, args) => {
        const member = await getUserFromMention(message, args[0]) ||
            message.guild.members.cache.get(args[0]) ||
            message.member

        try {
            const response = await axios.get(member.user.displayAvatarURL({
                extension: 'png',
                size: 512,
                forceStatic: true
            }), {
                headers: requestHeaders,
                responseType: 'arraybuffer',
                timeout: 10000
            })
            const avatar = await loadImage(Buffer.from(response.data))
            const canvas = createCanvas(512, 512)
            const ctx = canvas.getContext('2d')
            const pixelSize = Math.min(Math.max(parseInt(args[1], 10) || 18, 6), 48)
            const smallSize = Math.ceil(512 / pixelSize)
            const smallCanvas = createCanvas(smallSize, smallSize)
            const smallCtx = smallCanvas.getContext('2d')

            smallCtx.imageSmoothingEnabled = true
            smallCtx.drawImage(avatar, 0, 0, smallSize, smallSize)

            ctx.imageSmoothingEnabled = false
            ctx.drawImage(smallCanvas, 0, 0, smallSize, smallSize, 0, 0, 512, 512)

            ctx.lineWidth = 1
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
            for (let i = 0; i <= 512; i += pixelSize) {
                ctx.beginPath()
                ctx.moveTo(i, 0)
                ctx.lineTo(i, 512)
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(0, i)
                ctx.lineTo(512, i)
                ctx.stroke()
            }

            const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), {
                name: 'pixle.png'
            })
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Pixle PFP')
                .setDescription(`**${member.displayName}** turned into pixels.`)
                .setImage('attachment://pixle.png')
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
                        .setDescription(`${client.emoji.cross} | pixle generator failed.`)
                ]
            })
        }
    }
}
