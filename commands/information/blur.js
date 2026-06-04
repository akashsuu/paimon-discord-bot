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
    name: 'blur',
    aliases: ['blurpfp', 'blurry'],
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
            const blurAmount = Math.min(Math.max(parseInt(args[1], 10) || 10, 2), 30)
            const scale = Math.max(8, 46 - blurAmount)
            const smallCanvas = createCanvas(scale, scale)
            const smallCtx = smallCanvas.getContext('2d')

            smallCtx.imageSmoothingEnabled = true
            smallCtx.drawImage(avatar, 0, 0, scale, scale)

            ctx.imageSmoothingEnabled = true
            ctx.drawImage(smallCanvas, 0, 0, scale, scale, 0, 0, 512, 512)

            ctx.globalAlpha = 0.18
            ctx.drawImage(avatar, 0, 0, 512, 512)
            ctx.globalAlpha = 1

            ctx.fillStyle = 'rgba(0, 0, 0, 0.16)'
            ctx.fillRect(0, 0, 512, 512)

            const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), {
                name: 'blur.png'
            })
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Blur PFP')
                .setDescription(`**${member.displayName}** got blurred.`)
                .setImage('attachment://blur.png')
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
                        .setDescription(`${client.emoji.cross} | blur generator failed.`)
                ]
            })
        }
    }
}
