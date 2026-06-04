const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')
const { execFile } = require('child_process')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const { promisify } = require('util')

const GROQ_TTS_URL = 'https://api.groq.com/openai/v1/audio/speech'
const DEFAULT_MODEL = 'canopylabs/orpheus-v1-english'
const DEFAULT_VOICE = 'hannah'
const execFileAsync = promisify(execFile)
const VOICE_OPTIONS = {
    f1: 'autumn',
    f2: 'diana',
    f3: 'hannah',
    m1: 'austin',
    m2: 'daniel',
    m3: 'troy',
    autumn: 'autumn',
    diana: 'diana',
    hannah: 'hannah',
    austin: 'austin',
    daniel: 'daniel',
    troy: 'troy',
    girl: 'hannah',
    female: 'hannah',
    woman: 'hannah',
    boy: 'troy',
    male: 'troy',
    man: 'troy'
}
const VOICE_LABELS = {
    autumn: 'Autumn female',
    diana: 'Diana female',
    hannah: 'Hannah female',
    austin: 'Austin male',
    daniel: 'Daniel male',
    troy: 'Troy male'
}
const EMOTION_OPTIONS = {
    cheerful: '[cheerful]',
    happy: '[cheerful]',
    whisper: '[whisper]',
    sad: '[sad]',
    angry: '[angry]',
    laugh: '[laughs]',
    laughs: '[laughs]',
    laughing: '[laughs]',
    sigh: '[sighs]',
    sighs: '[sighs]',
    surprised: '[surprised]',
    excited: '[excited]',
    crying: '[crying]',
    cry: '[crying]',
    nervous: '[nervous]'
}
const FALLBACK_TTS = [
    { model: 'canopylabs/orpheus-v1-english', voice: 'hannah' },
    { model: 'canopylabs/orpheus-v1-english', voice: 'troy' },
    { model: 'canopylabs/orpheus-v1-english', voice: 'autumn' }
]
const EFFECT_OPTIONS = new Set(['mic', 'radio', 'walkie', 'alien', 'ghost', 'man', 'moan'])

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const makeSafeName = (value) => {
    const name = String(value || 'akashsuu').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24)
    return name || 'akashsuu'
}

const normalizeEmotion = (value) => {
    const raw = String(value || '').toLowerCase().replace(/^\[|\]$/g, '')
    return EMOTION_OPTIONS[raw] || null
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

const applyAudioEffect = async (audio, effect) => {
    let ffmpegPath
    try {
        ffmpegPath = require('ffmpeg-static')
    } catch (err) {
        throw new Error(`ffmpeg-static is not installed: ${err.message}`)
    }

    if (!ffmpegPath) throw new Error('ffmpeg-static did not provide a binary path')

    const effectFilters = {
        alien: 'asetrate=44100*1.45,aresample=44100,atempo=0.72,highpass=f=520,lowpass=f=5200,aecho=0.75:0.55:45|95:0.35|0.22,tremolo=f=8:d=0.45,acrusher=bits=9:mode=log:aa=1,volume=1.18',
        ghost: 'asetrate=44100*0.82,aresample=44100,atempo=1.08,lowpass=f=4200,bass=g=8:f=120,treble=g=-2,acompressor=threshold=-18dB:ratio=3:attack=12:release=120,volume=1.15',
        man: 'asetrate=44100*0.86,aresample=44100,atempo=1.06,highpass=f=90,lowpass=f=6200,bass=g=10:f=120,treble=g=2:f=3200,acompressor=threshold=-24dB:ratio=6:attack=6:release=90,loudnorm=I=-15:TP=-1.5:LRA=8,volume=1.2',
        moan: 'asetrate=44100*0.92,aresample=44100,atempo=1.04,highpass=f=120,lowpass=f=3600,bass=g=5:f=180,treble=g=-3,acompressor=threshold=-28dB:ratio=5:attack=20:release=180,tremolo=f=3.5:d=0.16,volume=1.12',
        mic: 'highpass=f=320,lowpass=f=3200,acompressor=threshold=-22dB:ratio=8:attack=8:release=80,acrusher=bits=10:mode=log:aa=1,volume=1.25',
        radio: 'highpass=f=320,lowpass=f=3200,acompressor=threshold=-22dB:ratio=8:attack=8:release=80,acrusher=bits=10:mode=log:aa=1,volume=1.25',
        walkie: 'highpass=f=320,lowpass=f=3200,acompressor=threshold=-22dB:ratio=8:attack=8:release=80,acrusher=bits=10:mode=log:aa=1,volume=1.25'
    }
    const filter = effectFilters[effect] || effectFilters.mic
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `akashsuu-tts-${effect}-`))
    const inputPath = path.join(tempDir, 'input.wav')
    const outputPath = path.join(tempDir, `${effect}.wav`)

    try {
        await fs.writeFile(inputPath, audio)
        await execFileAsync(ffmpegPath, [
            '-y',
            '-i',
            inputPath,
            '-af',
            filter,
            '-ar',
            '24000',
            '-ac',
            '1',
            outputPath
        ], { timeout: 20000 })

        const processed = await fs.readFile(outputPath)
        if (!processed.length) throw new Error(`${effect} effect returned an empty audio file`)
        return processed
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
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
        const apiOnlyMode = ['english', 'en', 'api'].includes(args[0]?.toLowerCase())
        if (apiOnlyMode) args.shift()
        const hindiMode = ['hindi', 'hi'].includes(args[0]?.toLowerCase())
        if (hindiMode) args.shift()
        const emotionMode = normalizeEmotion(args[0])
        if (emotionMode) args.shift()
        let effectMode = EFFECT_OPTIONS.has(args[0]?.toLowerCase()) ? args.shift().toLowerCase() : null
        const voiceMode = args[0]?.toLowerCase()
        const selectedGroqVoice = VOICE_OPTIONS[voiceMode]
        const groqVoice = selectedGroqVoice || process.env.GROQ_TTS_VOICE || client.config.GROQ_TTS_VOICE || DEFAULT_VOICE
        if (selectedGroqVoice) {
            if (voiceMode === 'man' && !effectMode) effectMode = 'man'
            args.shift()
        }
        let text = cleanText(args.join(' '))

        if (!text && message.reference?.messageId) {
            const replied = await message.channel.messages.fetch(message.reference.messageId).catch(() => null)
            text = cleanText(replied?.content)
        }
        const ttsInput = emotionMode ? `${emotionMode} ${text}` : text

        if (!text) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(
                            `${client.emoji.cross} | Usage: \`${message.guild.prefix}tts cheerful diana hello akashsuu\`\n` +
                            `Voices: \`f1/autumn\`, \`f2/diana\`, \`f3/hannah\`, \`m1/austin\`, \`m2/daniel\`, \`m3/troy\`\n` +
                            `Emotions: \`cheerful\`, \`whisper\`, \`sad\`, \`angry\`, \`laughs\`, \`sighs\`, \`surprised\`, \`excited\`, \`crying\`, \`nervous\``
                        )
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
            if (!apiKey) {
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | TTS uses API mode. Add \`GROQ_API_KEY\` to your \`.env\` file and restart the bot.`)
                    ]
                })
            }

            const result = await createSpeech({
                apiKey,
                model,
                voice: groqVoice,
                text: ttsInput
            })
            if (effectMode) {
                try {
                    result.audio = await applyAudioEffect(result.audio, effectMode)
                    result.effect = effectMode
                } catch (err) {
                    client.logger?.log?.(`tts ${effectMode} effect skipped: ${err.message}`, 'warn')
                    result.effect = 'normal fallback'
                }
            }
            const attachment = new AttachmentBuilder(result.audio, {
                name: `${makeSafeName(message.author.username)}-tts.${result.extension || 'wav'}`
            })

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Text To Speech')
                .setDescription(`Generated ${effectMode === 'alien' ? '**alien** ' : effectMode === 'ghost' ? '**ghost** ' : effectMode === 'man' ? '**man announcer** ' : effectMode === 'moan' ? '**dramatic groan** ' : effectMode ? '**mic-style** ' : hindiMode ? '**Hindi API** ' : emotionMode ? '**emotional** ' : '**API** '}voice for ${message.author}.`)
                .addFields(
                    {
                        name: 'Voice',
                        value: `\`${VOICE_LABELS[result.voice] || result.voice}\``,
                        inline: true
                    },
                    {
                        name: 'Model',
                        value: `\`${result.model}\``,
                        inline: true
                    },
                    {
                        name: 'Style',
                        value: `\`${[emotionMode ? emotionMode.replace(/\[|\]/g, '') : null, result.effect || null].filter(Boolean).join(' + ') || 'normal'}\``,
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
                                : `${client.emoji.cross} | TTS is **currently down** or the selected voice/model is invalid.`
                        )
                ]
            })
        }
    }
}
