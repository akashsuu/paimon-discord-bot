const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')

const GROQ_TTS_URL = 'https://api.groq.com/openai/v1/audio/speech'
const DEFAULT_MODEL = 'canopylabs/orpheus-v1-english'
const DEFAULT_VOICE = 'hannah'
const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const KOKORO_SPEED = 0.55
let kokoroModelPromise = null
const VOICE_OPTIONS = {
    girl: 'hannah',
    female: 'hannah',
    woman: 'hannah',
    boy: 'troy',
    male: 'troy',
    man: 'troy'
}
const KOKORO_VOICE_OPTIONS = {
    girl: 'af_heart',
    female: 'af_heart',
    woman: 'af_heart',
    boy: 'am_adam',
    male: 'am_adam',
    man: 'am_adam'
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

const createKokoroEnglishSpeech = async ({ text, voice }) => {
    let tts
    try {
        const { KokoroTTS } = require('kokoro-js')
        kokoroModelPromise ||= KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
            dtype: 'q8',
            device: 'cpu'
        })
        tts = await kokoroModelPromise
    } catch (err) {
        kokoroModelPromise = null
        throw new Error(`Kokoro model load failed: ${err.message}`)
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akashsuu-kokoro-'))
    const outputPath = path.join(tempDir, 'output.wav')

    try {
        const audioOutput = await tts.generate(cleanText(text), {
            voice,
            speed: KOKORO_SPEED
        })
        await audioOutput.save(outputPath)
        const audio = await fs.readFile(outputPath)
        if (!audio.length) throw new Error('Kokoro returned an empty audio file')

        return {
            audio,
            model: 'kokoro-js-q8',
            voice
        }
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
    }
}

const createLocalFirstSpeech = async ({ apiKey, model, groqVoice, kokoroVoice, text }) => {
    try {
        return await createKokoroEnglishSpeech({
            text,
            voice: kokoroVoice
        })
    } catch (kokoroErr) {
        if (!apiKey) {
            throw new Error(`Local Kokoro failed and no Groq API key is set: ${kokoroErr.message}`)
        }

        const result = await createSpeech({
            apiKey,
            model,
            voice: groqVoice,
            text
        })

        return {
            ...result,
            model: `${result.model} (api fallback)`
        }
    }
}

module.exports = {
    name: 'tts',
    aliases: ['speak', 'voice'],
    category: 'fun',
    premium: true,
    run: async (client, message, args) => {
        const apiKey = process.env.GROQ_API_KEY || client.config.GROQ_API_KEY
        const model = process.env.GROQ_TTS_MODEL || client.config.GROQ_TTS_MODEL || DEFAULT_MODEL
        const kokoroMode = ['english', 'en', 'kokoro'].includes(args[0]?.toLowerCase())
        if (kokoroMode) args.shift()
        const voiceMode = args[0]?.toLowerCase()
        const selectedGroqVoice = VOICE_OPTIONS[voiceMode]
        const selectedKokoroVoice = KOKORO_VOICE_OPTIONS[voiceMode]
        const groqVoice = selectedGroqVoice || process.env.GROQ_TTS_VOICE || client.config.GROQ_TTS_VOICE || DEFAULT_VOICE
        const kokoroVoice = selectedKokoroVoice || 'af_heart'
        if (selectedGroqVoice || selectedKokoroVoice) args.shift()
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
                        .setDescription(`${client.emoji.cross} | Usage: \`${message.guild.prefix}tts girl hello akashsuu\`, \`${message.guild.prefix}tts boy hello\`, or \`${message.guild.prefix}tts english girl hello akashsuu\`.`)
                ]
            })
        }

        if (text.length > 200) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Please keep TTS text under **200 characters**.`)
                ]
            })
        }

        try {
            const result = kokoroMode
                ? await createKokoroEnglishSpeech({
                    text,
                    voice: kokoroVoice
                })
                : await createLocalFirstSpeech({
                    apiKey,
                    model,
                    groqVoice,
                    kokoroVoice,
                    text
                })
            const attachment = new AttachmentBuilder(result.audio, {
                name: `${makeSafeName(message.author.username)}-tts.${result.extension || 'wav'}`
            })

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Text To Speech')
                .setDescription(`Generated ${kokoroMode ? '**Kokoro local** ' : '**local-first** '}voice for ${message.author}.`)
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
                                : kokoroMode
                                    ? `${client.emoji.cross} | Local Kokoro TTS failed: \`${String(err.message || err).slice(0, 220)}\``
                                : `${client.emoji.cross} | TTS is **currently down** or the selected voice/model is invalid.`
                        )
                ]
            })
        }
    }
}
