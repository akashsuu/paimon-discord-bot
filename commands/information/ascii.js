const axios = require('axios')
const { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const { createCanvas, loadImage } = require('canvas')

const requestHeaders = {
    'User-Agent': 'akashsuu-discord-bot/1.0'
}

const shades = ' .:-=+*#%@'

const getUserFromMention = async (message, mention) => {
    if (!mention) return message.member

    const matches = mention.match(/^<@!?(\d+)>$/)
    if (!matches) return null

    return message.guild.members.fetch(matches[1]).catch(() => null)
}

const createAscii = (avatar, width, height) => {
    const sampleCanvas = createCanvas(width, height)
    const sampleCtx = sampleCanvas.getContext('2d')

    sampleCtx.drawImage(avatar, 0, 0, width, height)
    const pixels = sampleCtx.getImageData(0, 0, width, height).data
    let output = ''

    for (let y = 0; y < height; y++) {
        let line = ''
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4
            const red = pixels[index]
            const green = pixels[index + 1]
            const blue = pixels[index + 2]
            const alpha = pixels[index + 3]

            if (alpha < 80) {
                line += ' '
                continue
            }

            const brightness = (red * 0.299 + green * 0.587 + blue * 0.114) / 255
            const shadeIndex = Math.min(shades.length - 1, Math.floor(brightness * shades.length))
            line += shades[shadeIndex]
        }
        output += `${line}\n`
    }

    return output
}

module.exports = {
    name: 'ascii',
    aliases: ['asciiart', 'textpfp'],
    category: 'fun',
    premium: true,
    run: async (client, message, args) => {
        const member = await getUserFromMention(message, args[0]) ||
            message.guild.members.cache.get(args[0]) ||
            message.member

        try {
            const response = await axios.get(member.user.displayAvatarURL({
                extension: 'png',
                size: 256,
                forceStatic: true
            }), {
                headers: requestHeaders,
                responseType: 'arraybuffer',
                timeout: 10000
            })
            const avatar = await loadImage(Buffer.from(response.data))
            const sampleWidth = 72
            const sampleHeight = 42
            const output = createAscii(avatar, sampleWidth, sampleHeight)
            const copyOutput = createAscii(avatar, 42, 24)

            const fontSize = 12
            const lineHeight = 12
            const padding = 24
            const canvas = createCanvas(760, sampleHeight * lineHeight + padding * 2)
            const ctx = canvas.getContext('2d')

            ctx.fillStyle = '#050505'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.font = `${fontSize}px Consolas, monospace`
            ctx.fillStyle = '#ffffff'
            ctx.textBaseline = 'top'

            output.split('\n').forEach((line, index) => {
                ctx.fillText(line, padding, padding + index * lineHeight)
            })

            const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), {
                name: 'ascii.png'
            })
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('ASCII PFP')
                .setDescription(`**${member.displayName}** as an ASCII image.`)
                .setImage('attachment://ascii.png')
                .setFooter({
                text: 'akashsuu',
                iconURL: client.user.displayAvatarURL({ dynamic: true })
            })
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('copy_ascii')
                    .setLabel('Copy ASCII')
                    .setStyle(ButtonStyle.Secondary)
            )

            const sent = await message.channel.send({ embeds: [embed], files: [attachment], components: [row] })
            const collector = sent.createMessageComponentCollector({
                filter: (interaction) => interaction.user.id === message.author.id && interaction.customId === 'copy_ascii',
                time: 60000
            })

            collector.on('collect', async (interaction) => {
                await interaction.reply({
                    content: `Copy this ASCII:\n\`\`\`\n${copyOutput}\`\`\``,
                    ephemeral: true
                })
            })

            collector.on('end', async () => {
                row.components[0].setDisabled(true)
                await sent.edit({ components: [row] }).catch(() => {})
            })

            return sent
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | ascii generator failed.`)
                ]
            })
        }
    }
}
