const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')
const { createCanvas, loadImage } = require('canvas')
const GIFEncoder = require('gifencoder')
const { parseGIF, decompressFrames } = require('gifuct-js')

const requestHeaders = {
    'User-Agent': 'akashsuu-discord-bot/1.0'
}
const explosionGifUrl = 'https://i.gifer.com/origin/62/623cdcca882db2d7efa8d32424a61d29_w200.gif'

const getUserFromMention = async (message, mention) => {
    if (!mention) return message.member

    const matches = mention.match(/^<@!?(\d+)>$/)
    if (!matches) return null

    return message.guild.members.fetch(matches[1]).catch(() => null)
}

const loadExplosionGifFrames = async () => {
    const response = await axios.get(explosionGifUrl, {
        headers: requestHeaders,
        responseType: 'arraybuffer',
        timeout: 10000
    })
    const buffer = Buffer.from(response.data)
    const gif = parseGIF(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
    const frames = decompressFrames(gif, true).slice(0, 32)
    const width = frames.reduce((max, frame) => Math.max(max, frame.dims.left + frame.dims.width), 1)
    const height = frames.reduce((max, frame) => Math.max(max, frame.dims.top + frame.dims.height), 1)

    return { frames, width, height }
}

const createGifState = ({ width, height }) => {
    const canvas = createCanvas(width, height)
    return {
        canvas,
        ctx: canvas.getContext('2d')
    }
}

const drawExplosionGif = (ctx, explosion, frameIndex) => {
    const frame = explosion.frames[frameIndex % explosion.frames.length]
    const imageData = explosion.state.ctx.createImageData(frame.dims.width, frame.dims.height)
    imageData.data.set(frame.patch)
    explosion.state.ctx.putImageData(imageData, frame.dims.left, frame.dims.top)

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(explosion.state.canvas, 56, 50, 400, 400)
    ctx.restore()

    if (frame.disposalType === 2) {
        explosion.state.ctx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height)
    }
}

module.exports = {
    name: 'explode',
    aliases: ['boom', 'explosion'],
    category: 'fun',
    premium: true,
    run: async (client, message, args) => {
        const member = await getUserFromMention(message, args[0]) ||
            message.guild.members.cache.get(args[0]) ||
            message.member

        try {
            const avatarUrl = member.user.displayAvatarURL({
                extension: 'png',
                size: 512,
                forceStatic: true
            })
            const response = await axios.get(avatarUrl, {
                headers: requestHeaders,
                responseType: 'arraybuffer',
                timeout: 10000
            })
            const avatar = await loadImage(Buffer.from(response.data))
            const explosionSource = await loadExplosionGifFrames()
            const explosion = {
                ...explosionSource,
                state: createGifState(explosionSource)
            }
            const canvas = createCanvas(512, 512)
            const ctx = canvas.getContext('2d')
            const encoder = new GIFEncoder(512, 512)

            encoder.start()
            encoder.setRepeat(0)
            encoder.setDelay(70)
            encoder.setQuality(8)

            for (let frame = 0; frame < 32; frame++) {
                ctx.clearRect(0, 0, 512, 512)
                ctx.fillStyle = '#000000'
                ctx.fillRect(0, 0, 512, 512)

                if (frame < 8) {
                    const shake = frame % 2 === 0 ? 8 : -8
                    ctx.save()
                    ctx.beginPath()
                    ctx.arc(256 + shake, 232, 150, 0, Math.PI * 2)
                    ctx.closePath()
                    ctx.clip()
                    ctx.drawImage(avatar, 106 + shake, 82, 300, 300)
                    ctx.restore()
                }

                if (frame >= 4) {
                    drawExplosionGif(ctx, explosion, frame - 4)
                }

                encoder.addFrame(ctx)
            }

            encoder.finish()

            const attachment = new AttachmentBuilder(encoder.out.getData(), {
                name: 'explode.gif'
            })
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Explode')
                .setDescription(`**${member.displayName}** exploded.`)
                .setImage('attachment://explode.gif')
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
                        .setDescription(`${client.emoji.cross} | explode generator failed.`)
                ]
            })
        }
    }
}
