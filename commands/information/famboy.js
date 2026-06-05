const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

const getCanvas = () => {
    try {
        return require('canvas')
    } catch (err) {
        return null
    }
}

const templates = [
    {
        id: 'classic',
        url: 'https://www.outfitsuggest.com/storage/uploads/1c22601faa04b69f6826a8ed78c6abe2-1678707768.jpg',
        face: { x: 333, y: 63, size: 196 }
    },
    {
        id: 'reddit-1',
        url: 'https://i.redd.it/43jo13owrncc1.jpeg',
        face: { x: 177, y: 43, size: 204 }
    },
    {
        id: 'reddit-2',
        url: 'https://i.redd.it/g67xnjh54ihc1.jpeg',
        face: { x: 315, y: 12, size: 315 }
    },
    {
        id: 'reddit-3',
        url: 'https://preview.redd.it/1h5q5qiz5fdb1.jpg?auto=webp&s=d90c01b84c70393d82454f8076710b4b46d3e857',
        face: { x: 356, y: 55, size: 395 }
    }
]
const requestHeaders = {
    'User-Agent': 'akashsuu-discord-bot/1.0'
}

const cachedTemplates = new Map()

const getUserFromMention = async (message, mention) => {
    if (!mention) return message.member

    const matches = mention.match(/^<@!?(\d+)>$/)
    if (!matches) return null

    return message.guild.members.fetch(matches[1]).catch(() => null)
}

const loadTemplate = async (template, loadImage) => {
    if (cachedTemplates.has(template.id)) return cachedTemplates.get(template.id)

    const response = await axios.get(template.url, {
        headers: requestHeaders,
        responseType: 'arraybuffer',
        timeout: 10000
    })

    const image = await loadImage(Buffer.from(response.data))
    cachedTemplates.set(template.id, image)
    return image
}

const pickWorkingTemplate = async (loadImage) => {
    const shuffled = [...templates].sort(() => Math.random() - 0.5)
    let lastError

    for (const template of shuffled) {
        try {
            return {
                selectedTemplate: template,
                template: await loadTemplate(template, loadImage)
            }
        } catch (err) {
            lastError = err
        }
    }

    throw lastError || new Error('No template image could be loaded')
}

module.exports = {
    name: 'femboy',
    aliases: ['famboy'],
    category: 'fun',
    premium: true,
    run: async (client, message, args) => {
        const member = await getUserFromMention(message, args[0]) ||
            message.guild.members.cache.get(args[0]) ||
            message.member

        try {
            const canvasLib = getCanvas()
            if (!canvasLib) {
                throw new Error('canvas package is not installed or failed to load')
            }

            const { createCanvas, loadImage } = canvasLib
            const templateData = await pickWorkingTemplate(loadImage)
            const { selectedTemplate, template } = templateData
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
            const canvas = createCanvas(template.width, template.height)
            const ctx = canvas.getContext('2d')

            ctx.drawImage(template, 0, 0, template.width, template.height)

            const { x, y, size } = selectedTemplate.face
            const radius = size / 2

            ctx.save()
            ctx.beginPath()
            ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(avatar, x, y, size, size)
            ctx.restore()

            ctx.beginPath()
            ctx.arc(x + radius, y + radius, radius + 2, 0, Math.PI * 2)
            ctx.lineWidth = 5
            ctx.strokeStyle = '#ffffff'
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
            ctx.shadowBlur = 8
            ctx.stroke()
            ctx.shadowBlur = 0

            const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), {
                name: 'femboy.png'
            })

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Femboy')
                .setDescription(`**${member.displayName}** got the look.`)
                .setImage('attachment://femboy.png')
                .setFooter({
                    text: 'akashsuu',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed], files: [attachment] })
        } catch (err) {
            client.logger?.log?.(`femboy command failed: ${err.message}`, 'error')
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | femboy image generator failed: ${err.message}`)
                ]
            })
        }
    }
}
