const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')
const { createCanvas, loadImage } = require('canvas')
const GIFEncoder = require('gifencoder')
const { parseGIF, decompressFrames } = require('gifuct-js')

const fireGifUrl = 'http://clipart-library.com/img1/1563572.gif'
const requestHeaders = {
    'User-Agent': 'akashsuu-discord-bot/1.0'
}

const getUserFromMention = async (message, mention) => {
    if (!mention) return message.member

    const matches = mention.match(/^<@!?(\d+)>$/)
    if (!matches) return null

    return message.guild.members.fetch(matches[1]).catch(() => null)
}

const loadFireGifFrames = async () => {
    const response = await axios.get(fireGifUrl, {
        headers: requestHeaders,
        responseType: 'arraybuffer',
        timeout: 10000
    })
    const buffer = Buffer.from(response.data)
    const gif = parseGIF(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
    const frames = decompressFrames(gif, true).slice(0, 28)
    const width = frames.reduce((max, frame) => Math.max(max, frame.dims.left + frame.dims.width), 1)
    const height = frames.reduce((max, frame) => Math.max(max, frame.dims.top + frame.dims.height), 1)

    return { frames, width, height }
}

const createFireState = ({ width, height }) => {
    const canvas = createCanvas(width, height)
    return {
        canvas,
        ctx: canvas.getContext('2d')
    }
}

const drawRealFire = (ctx, fire, frameIndex) => {
    const frame = fire.frames[frameIndex % fire.frames.length]
    const imageData = fire.state.ctx.createImageData(frame.dims.width, frame.dims.height)
    imageData.data.set(frame.patch)
    fire.state.ctx.putImageData(imageData, frame.dims.left, frame.dims.top)

    ctx.save()
    ctx.globalAlpha = 0.96
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(fire.state.canvas, -42, 156, 596, 386)
    ctx.drawImage(fire.state.canvas, 56, -18, 400, 250)
    ctx.restore()

    if (frame.disposalType === 2) {
        fire.state.ctx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height)
    }
}

const drawFrame = (ctx, avatar, fire, frame) => {
    ctx.clearRect(0, 0, 512, 512)

    const background = ctx.createRadialGradient(256, 260, 40, 256, 256, 360)
    background.addColorStop(0, '#3a1008')
    background.addColorStop(0.45, '#160806')
    background.addColorStop(1, '#050505')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, 512, 512)

    drawRealFire(ctx, fire, frame)

    ctx.save()
    ctx.beginPath()
    ctx.arc(256, 214, 154, 0, Math.PI * 2)
    ctx.closePath()
    ctx.shadowColor = '#ff5a00'
    ctx.shadowBlur = 34 + Math.sin(frame * 0.8) * 10
    ctx.fillStyle = '#ff6b00'
    ctx.fill()
    ctx.clip()
    ctx.drawImage(avatar, 102, 60, 308, 308)
    ctx.restore()

    ctx.beginPath()
    ctx.arc(256, 214, 158, 0, Math.PI * 2)
    ctx.lineWidth = 10
    ctx.strokeStyle = frame % 2 ? '#ffbf2e' : '#ff7900'
    ctx.shadowColor = '#ff3d00'
    ctx.shadowBlur = 18
    ctx.stroke()
    ctx.shadowBlur = 0

    drawRealFire(ctx, fire, frame + 7)

    const heat = ctx.createLinearGradient(0, 120, 0, 512)
    heat.addColorStop(0, 'rgba(255, 210, 90, 0.08)')
    heat.addColorStop(0.55, `rgba(255, 77, 0, ${0.18 + Math.sin(frame * 0.7) * 0.08})`)
    heat.addColorStop(1, 'rgba(0, 0, 0, 0.2)')
    ctx.fillStyle = heat
    ctx.fillRect(0, 0, 512, 512)

    ctx.font = 'bold 34px Sans'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = '#ff4a00'
    ctx.shadowBlur = 12 + Math.sin(frame) * 4
    ctx.fillText('ON FIRE', 256, 455)
    ctx.shadowBlur = 0
}

module.exports = {
    name: 'fire',
    aliases: ['firepfp', 'fireavatar', 'burnpfp', 'catchfire'],
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
            const fireSource = await loadFireGifFrames()
            const fire = {
                ...fireSource,
                state: createFireState(fireSource)
            }

            const canvas = createCanvas(512, 512)
            const ctx = canvas.getContext('2d')
            const encoder = new GIFEncoder(512, 512)

            encoder.start()
            encoder.setRepeat(0)
            encoder.setDelay(80)
            encoder.setQuality(10)

            for (let frame = 0; frame < 24; frame++) {
                drawFrame(ctx, avatar, fire, frame)
                encoder.addFrame(ctx)
            }

            encoder.finish()

            const attachment = new AttachmentBuilder(encoder.out.getData(), {
                name: 'firepfp.gif'
            })

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Fire PFP')
                .setDescription(`**${member.displayName}** caught real animated fire.`)
                .setImage('attachment://firepfp.gif')
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
                        .setDescription(`${client.emoji.cross} | fire pfp generator failed.`)
                ]
            })
        }
    }
}
