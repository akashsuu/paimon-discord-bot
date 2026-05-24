const axios = require('axios')
const { AttachmentBuilder, ComponentType } = require('discord.js')

const COMPONENTS_V2_FLAG = 1 << 15
const GROQ_TTS_URL = 'https://api.groq.com/openai/v1/audio/speech'
const DEFAULT_TTS_MODEL = 'canopylabs/orpheus-v1-english'
const DEFAULT_TTS_VOICE = 'hannah'

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
const stripMentions = (value) => cleanText(String(value || '')
    .replace(/<@!?\d{15,25}>/g, '')
    .replace(/<@&\d{15,25}>/g, '')
    .replace(/<#\d{15,25}>/g, '')
    .replace(/@\S+/g, ''))
const clampText = (value, max = 1900) => {
    const text = String(value || '').trim()
    return text.length > max ? `${text.slice(0, max - 3)}...` : text
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

const createSpeech = async ({ apiKey, model, voice, text }) => {
    const response = await axios.post(
        GROQ_TTS_URL,
        {
            model,
            input: text,
            voice,
            response_format: 'wav'
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer',
            timeout: 30000
        }
    )

    if (!response.data || !Buffer.byteLength(response.data)) {
        throw new Error('Groq TTS returned an empty audio response')
    }

    return Buffer.from(response.data)
}

const translateComponents = ({ sourceText, translatedText, detectedLanguage, hasAudio, ttsDisabled = false }) => {
    const audioLine = hasAudio
        ? '\n-# Audio translation attached below.'
        : '\n-# Add `GROQ_API_KEY` to enable WAV audio translation.'

    const children = [
        {
            type: 10,
            content: clampText([
                '## Language Trans',
                `**Detected:** ${getLanguageName(detectedLanguage)} -> English`,
                '',
                `**Original**\n${sourceText}`,
                '',
                `**English**\n${translatedText}`,
                audioLine
            ].join('\n'))
        }
    ]

    children.push({
        type: 1,
        components: [
            {
                type: 2,
                custom_id: 'tr_tts',
                label: 'Speak in Chat',
                style: 2,
                disabled: ttsDisabled
            }
        ]
    })

    return [
        {
            type: 17,
            accent_color: 0xffffff,
            components: children
        }
    ]
}

module.exports = {
    name: 'translator',
    aliases: ['tr', 'translate'],
    category: 'utility',
    premium: true,
    run: async (client, message, args) => {
        let text = stripMentions(args.join(' '))

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
            const files = []
            const apiKey = process.env.GROQ_API_KEY || client.config.GROQ_API_KEY
            let hasAudio = false

            if (apiKey) {
                try {
                    const audio = await createSpeech({
                        apiKey,
                        model: process.env.GROQ_TTS_MODEL || client.config.GROQ_TTS_MODEL || DEFAULT_TTS_MODEL,
                        voice: process.env.GROQ_TTS_VOICE || client.config.GROQ_TTS_VOICE || DEFAULT_TTS_VOICE,
                        text: result.translated
                    })
                    files.push(new AttachmentBuilder(audio, {
                        name: 'translation.wav'
                    }))
                    hasAudio = true
                } catch (err) {
                    client.logger?.log?.(`translator wav tts failed: ${err.response?.data?.toString?.() || err.message}`, 'warn')
                }
            }

            const sent = await message.channel.send({
                flags: COMPONENTS_V2_FLAG,
                components: translateComponents({
                    sourceText: text,
                    translatedText: result.translated,
                    detectedLanguage: result.detectedLanguage,
                    hasAudio
                }),
                files
            })
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
                await sent.edit({
                    components: translateComponents({
                        sourceText: text,
                        translatedText: result.translated,
                        detectedLanguage: result.detectedLanguage,
                        hasAudio,
                        ttsDisabled: true
                    })
                }).catch(() => null)
            })

            return sent
        } catch (err) {
            client.logger?.log?.(`translator error: ${err.stack || err.message}`, 'error')
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
