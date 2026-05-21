const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

const GROQ_TTS_URL = 'https://api.groq.com/openai/v1/audio/speech'
const DEFAULT_MODEL = 'canopylabs/orpheus-v1-english'
const DEFAULT_VOICE = 'hannah'
const VOICE_OPTIONS = {
    girl: 'hannah',
    female: 'hannah',
    woman: 'hannah',
    boy: 'troy',
    male: 'troy',
    man: 'troy'
}
const FALLBACK_TTS = [
    { model: 'canopylabs/orpheus-v1-english', voice: 'hannah' },
    { model: 'canopylabs/orpheus-v1-english', voice: 'troy' }
]

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const makeSafeName = (value) => {
    const name = String(value || 'akashsuu').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24)
    return name || 'akashsuu'
}

const requestSpeech = async ({ apiKey, model, voice, text }) => {
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

const createSpeech = async ({ apiKey, model, voice, text }) => {
    const attempts = [
        { model, voice },
        ...FALLBACK_TTS.filter((item) => item.model !== model || item.voice !== voice)
    ]
    let lastError = null

    for (const attempt of attempts) {
        try {
            const audio = await requestSpeech({ apiKey, model: attempt.model, voice: attempt.voice, text })
            return {
                audio,
                model: attempt.model,
                voice: attempt.voice
            }
        } catch (err) {
            lastError = err
        }
    }

    throw lastError || new Error('Groq TTS failed')
}

module.exports = {
    name: 'tts',
    aliases: ['speak', 'voice'],
    category: 'fun',
    premium: true,
    run: async (client, message, args) => {
        const apiKey = process.env.GROQ_API_KEY || client.config.GROQ_API_KEY
        const model = process.env.GROQ_TTS_MODEL || client.config.GROQ_TTS_MODEL || DEFAULT_MODEL
        const voiceMode = args[0]?.toLowerCase()
        const selectedVoice = VOICE_OPTIONS[voiceMode]
        const voice = selectedVoice || process.env.GROQ_TTS_VOICE || client.config.GROQ_TTS_VOICE || DEFAULT_VOICE
        if (selectedVoice) args.shift()
        let text = cleanText(args.join(' '))

        if (!text && message.reference?.messageId) {
            const replied = await message.channel.messages.fetch(message.reference.messageId).catch(() => null)
            text = cleanText(replied?.content)
        }

        if (!apiKey) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Missing \`GROQ_API_KEY\`. Add it to your \`.env\` file and restart the bot.`)
                ]
            })
        }

        if (!text) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${message.guild.prefix}tts girl hello akashsuu\` or \`${message.guild.prefix}tts boy hello akashsuu\`\nYou can also reply to a message with \`${message.guild.prefix}tts girl\`.`)
                ]
            })
        }

        if (text.length > 200) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Please keep TTS text under **200 characters** for Groq voice generation.`)
                ]
            })
        }

        try {
            const result = await createSpeech({ apiKey, model, voice, text })
            const attachment = new AttachmentBuilder(result.audio, {
                name: `${makeSafeName(message.author.username)}-tts.wav`
            })

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Text To Speech')
                .setDescription(`Generated ${selectedVoice ? `**${voiceMode}** ` : ''}voice for ${message.author}.`)
                .addFields(
                    {
                        name: 'Voice',
                        value: `\`${result.voice}\``,
                        inline: true
                    },
                    {
                        name: 'Model',
                        value: `\`${result.model}\``,
                        inline: true
                    }
                )
                .setFooter({
                    text: 'akashsuu voice',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed], files: [attachment] })
        } catch (err) {
            client.logger?.log?.(`tts error: ${err.response?.data?.toString?.() || err.message}`, 'error')
            const errorData = err.response?.data ? Buffer.from(err.response.data).toString('utf8') : ''
            const needsTerms = errorData.includes('model_terms_required')

            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(
                            needsTerms
                                ? `${client.emoji.cross} | Groq TTS needs model terms accepted first.\nOpen: https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english`
                                : `${client.emoji.cross} | TTS api is **currently down** or your Groq key/model/voice is invalid.`
                        )
                ]
            })
        }
    }
}
