const axios = require('axios')
const { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js')
const { createCanvas } = require('canvas')

const languageNames = {
    auto: 'Auto Detect',
    af: 'Afrikaans',
    ar: 'Arabic',
    bn: 'Bengali',
    de: 'German',
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    gu: 'Gujarati',
    hi: 'Hindi',
    id: 'Indonesian',
    it: 'Italian',
    ja: 'Japanese',
    ko: 'Korean',
    mr: 'Marathi',
    ne: 'Nepali',
    pa: 'Punjabi',
    pt: 'Portuguese',
    ru: 'Russian',
    ta: 'Tamil',
    te: 'Telugu',
    tr: 'Turkish',
    ur: 'Urdu',
    zh: 'Chinese'
}

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

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

const wrapText = (ctx, text, maxWidth, maxLines) => {
    const words = text.split(/\s+/)
    const lines = []
    let line = ''

    for (const word of words) {
        const next = line ? `${line} ${word}` : word
        if (ctx.measureText(next).width > maxWidth && line) {
            lines.push(line)
            line = word
        } else {
            line = next
        }

        if (lines.length === maxLines) break
    }

    if (line && lines.length < maxLines) lines.push(line)
    if (words.length && lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
        lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\.*$/, '')}...`
    }

    return lines
}

const drawPanelText = (ctx, { label, language, text, x, y, width, height, accent }) => {
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, x, y, width, height, 18)
    ctx.fill()

    ctx.fillStyle = accent
    roundRect(ctx, x, y, width, 58, 18)
    ctx.fill()
    ctx.fillRect(x, y + 28, width, 30)

    ctx.font = '700 24px "Segoe UI", Arial'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, x + 26, y + 38)

    ctx.font = '600 20px "Segoe UI", Arial'
    ctx.fillStyle = '#5f6368'
    ctx.fillText(language, x + 26, y + 92)

    ctx.font = '29px "Segoe UI", Arial'
    ctx.fillStyle = '#202124'
    const lines = wrapText(ctx, text, width - 52, 5)
    lines.forEach((line, index) => {
        ctx.fillText(line, x + 26, y + 138 + index * 42)
    })
}

const createTranslateImage = ({ sourceText, translatedText, detectedLanguage }) => {
    const canvas = createCanvas(1180, 600)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#f8fafd'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#4285f4'
    roundRect(ctx, 44, 36, 1092, 96, 24)
    ctx.fill()

    ctx.font = '700 38px "Segoe UI", Arial'
    ctx.fillStyle = '#ffffff'
    ctx.fillText('Language Trans', 84, 96)

    ctx.font = '600 22px "Segoe UI", Arial'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.fillText(`${getLanguageName(detectedLanguage)} -> English`, 842, 96)

    ctx.fillStyle = 'rgba(60, 64, 67, 0.16)'
    roundRect(ctx, 45, 160, 1090, 358, 22)
    ctx.fill()

    drawPanelText(ctx, {
        label: 'Original',
        language: getLanguageName(detectedLanguage),
        text: sourceText,
        x: 64,
        y: 148,
        width: 514,
        height: 350,
        accent: '#1a73e8'
    })

    drawPanelText(ctx, {
        label: 'English',
        language: 'Translation',
        text: translatedText,
        x: 602,
        y: 148,
        width: 514,
        height: 350,
        accent: '#34a853'
    })

    ctx.font = '600 22px "Segoe UI", Arial'
    ctx.fillStyle = '#5f6368'
    ctx.fillText('akashsuu translator', 64, 558)
    ctx.fillStyle = '#1a73e8'
    ctx.fillText('Auto detected language', 848, 558)

    return canvas.toBuffer('image/png')
}

const getLanguageName = (code) => {
    if (!code) return 'Unknown'
    return languageNames[code] || code.toUpperCase()
}

const translateToEnglish = async (text) => {
    const response = await axios.get('https://translate.googleapis.com/translate_a/single', {
        params: {
            client: 'gtx',
            sl: 'auto',
            tl: 'en',
            dt: 't',
            q: text
        },
        timeout: 10000
    })

    const translated = response.data?.[0]
        ?.map((part) => part?.[0])
        .filter(Boolean)
        .join('')

    const detectedLanguage = response.data?.[2] || 'auto'

    if (!translated) {
        throw new Error('Translate API returned an invalid response')
    }

    return {
        translated: cleanText(translated),
        detectedLanguage
    }
}

module.exports = {
    name: 'translator',
    aliases: ['tr', 'translate'],
    category: 'utility',
    premium: true,
    run: async (client, message, args) => {
        let text = cleanText(args.join(' '))

        if (!text && message.reference?.messageId) {
            const replied = await message.channel.messages.fetch(message.reference.messageId).catch(() => null)
            text = cleanText(replied?.content)
        }

        if (!text) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${message.guild.prefix}tr hola amigo\`\nReply to a message with \`${message.guild.prefix}tr\` to translate it.`)
                ]
            })
        }

        if (text.length > 900) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Please translate **900 characters or less** at once.`)
                ]
            })
        }

        try {
            const result = await translateToEnglish(text)
            const image = createTranslateImage({
                sourceText: text,
                translatedText: result.translated,
                detectedLanguage: result.detectedLanguage
            })
            const attachment = new AttachmentBuilder(image, {
                name: 'translation.png'
            })
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Language Trans')
                .setImage('attachment://translation.png')
                .setFooter({
                    text: 'akashsuu translator',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('tr_tts')
                    .setLabel('TTS')
                    .setStyle(ButtonStyle.Secondary)
            )

            const sent = await message.channel.send({ embeds: [embed], files: [attachment], components: [row] })
            let ttsUses = 0
            const collector = sent.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            })

            collector.on('collect', async (interaction) => {
                if (interaction.customId !== 'tr_tts') return

                await interaction.deferUpdate()
                ttsUses += 1
                await interaction.channel.send({
                    content: result.translated.slice(0, 1900),
                    tts: true,
                    allowedMentions: { parse: [] }
                })

                if (ttsUses >= 2) {
                    collector.stop('limit')
                }
            })

            collector.on('end', async () => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(row.components[0]).setDisabled(true)
                )

                await sent.edit({ components: [disabledRow] }).catch(() => null)
            })

            return sent
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | translator api is **currently down**.`)
                ]
            })
        }
    }
}
