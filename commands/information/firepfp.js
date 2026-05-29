const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')
const { PNG } = require('pngjs')
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

    return { frames, width, height, pixels: Buffer.alloc(width * height * 4) }
}

const setPixel = (data, width, x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= width || y >= data.length / 4 / width) return
    const index = (y * width + x) * 4
    data[index] = r
    data[index + 1] = g
    data[index + 2] = b
    data[index + 3] = a
}

const blendPixel = (data, width, x, y, r, g, b, a, mode = 'normal') => {
    if (x < 0 || y < 0 || x >= width || y >= data.length / 4 / width || a <= 0) return
    const index = (y * width + x) * 4
    const alpha = a / 255

    if (mode === 'lighter') {
        data[index] = Math.min(255, data[index] + r * alpha)
        data[index + 1] = Math.min(255, data[index + 1] + g * alpha)
        data[index + 2] = Math.min(255, data[index + 2] + b * alpha)
        data[index + 3] = Math.max(data[index + 3], a)
        return
    }

    data[index] = Math.round(r * alpha + data[index] * (1 - alpha))
    data[index + 1] = Math.round(g * alpha + data[index + 1] * (1 - alpha))
    data[index + 2] = Math.round(b * alpha + data[index + 2] * (1 - alpha))
    data[index + 3] = Math.max(data[index + 3], a)
}

const fillBackground = (data, frame) => {
    for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
            const dx = x - 256
            const dy = y - 256
            const distance = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 360)
            const pulse = 10 + Math.sin(frame * 0.65) * 8
            setPixel(
                data,
                512,
                x,
                y,
                Math.round(10 + (58 + pulse) * (1 - distance)),
                Math.round(5 + 18 * (1 - distance)),
                Math.round(4 + 5 * (1 - distance)),
                255
            )
        }
    }
}

const updateGifState = (source, frameIndex) => {
    const frame = source.frames[frameIndex % source.frames.length]
    source.pixels.fill(0)

    for (let y = 0; y < frame.dims.height; y++) {
        for (let x = 0; x < frame.dims.width; x++) {
            const src = (y * frame.dims.width + x) * 4
            const dest = ((frame.dims.top + y) * source.width + frame.dims.left + x) * 4
            source.pixels[dest] = frame.patch[src]
            source.pixels[dest + 1] = frame.patch[src + 1]
            source.pixels[dest + 2] = frame.patch[src + 2]
            source.pixels[dest + 3] = frame.patch[src + 3]
        }
    }
}

const drawScaled = (dest, source, sourceWidth, sourceHeight, dx, dy, dw, dh, mode = 'normal') => {
    for (let y = 0; y < dh; y++) {
        const sy = Math.floor((y / dh) * sourceHeight)
        for (let x = 0; x < dw; x++) {
            const sx = Math.floor((x / dw) * sourceWidth)
            const src = (sy * sourceWidth + sx) * 4
            blendPixel(dest, 512, dx + x, dy + y, source[src], source[src + 1], source[src + 2], source[src + 3], mode)
        }
    }
}

const drawCircularAvatar = (dest, avatar, frame) => {
    const centerX = 256
    const centerY = 214
    const radius = 154
    const size = 308
    const startX = centerX - radius
    const startY = centerY - radius

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const px = startX + x
            const py = startY + y
            const dx = px - centerX
            const dy = py - centerY
            if (dx * dx + dy * dy > radius * radius) continue

            const sx = Math.floor((x / size) * avatar.width)
            const sy = Math.floor((y / size) * avatar.height)
            const src = (sy * avatar.width + sx) * 4
            blendPixel(dest, 512, px, py, avatar.data[src], avatar.data[src + 1], avatar.data[src + 2], avatar.data[src + 3])
        }
    }

    const pulse = Math.sin(frame * 0.75)
    for (let y = -164; y <= 164; y++) {
        for (let x = -164; x <= 164; x++) {
            const distance = Math.sqrt(x * x + y * y)
            if (distance >= 154 && distance <= 164) {
                blendPixel(dest, 512, centerX + x, centerY + y, 255, pulse > 0 ? 191 : 121, 36, 220, 'lighter')
            }
        }
    }
}

const drawFrame = (avatar, fire, frame) => {
    const data = Buffer.alloc(512 * 512 * 4)
    fillBackground(data, frame)
    updateGifState(fire, frame)
    drawScaled(data, fire.pixels, fire.width, fire.height, -42, 156, 596, 386, 'lighter')
    drawScaled(data, fire.pixels, fire.width, fire.height, 56, -18, 400, 250, 'lighter')
    drawCircularAvatar(data, avatar, frame)
    drawScaled(data, fire.pixels, fire.width, fire.height, -42, 156, 596, 386, 'lighter')
    drawScaled(data, fire.pixels, fire.width, fire.height, 56, -18, 400, 250, 'lighter')
    return data
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
            const avatar = PNG.sync.read(Buffer.from(response.data))
            const fire = await loadFireGifFrames()
            const encoder = new GIFEncoder(512, 512)

            encoder.start()
            encoder.setRepeat(0)
            encoder.setDelay(80)
            encoder.setQuality(10)

            for (let frame = 0; frame < 24; frame++) {
                encoder.addFrame(drawFrame(avatar, fire, frame))
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
            client.logger?.log?.(`fire pfp failed: ${err.message}`, 'error')
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
