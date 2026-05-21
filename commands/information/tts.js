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
const KOKORO_BIN = path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'Scripts', 'kokoro-tts.exe')
const KOKORO_MODEL = path.join(process.cwd(), '.kokoro', 'kokoro-v1.0.onnx')
const KOKORO_VOICES = path.join(process.cwd(), '.kokoro', 'voices-v1.0.bin')
const execFileAsync = promisify(execFile)
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
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akashsuu-kokoro-'))
    const inputPath = path.join(tempDir, 'input.txt')
    const outputPath = path.join(tempDir, 'output.wav')

    try {
        await fs.writeFile(inputPath, text, 'utf8')
        try {
            await execFileAsync(KOKORO_BIN, [
                inputPath,
                outputPath,
                '--lang',
                'en-us',
                '--voice',
                voice,
                '--format',
                'wav',
                '--model',
                KOKORO_MODEL,
                '--voices',
                KOKORO_VOICES
            ], {
                timeout: 30000,
                windowsHide: true,
                env: {
                    ...process.env,
                    PYTHONIOENCODING: 'utf-8'
                }
            })
        } catch (err) {
            const detail = [err.stderr, err.stdout, err.message].filter(Boolean).join('\n')
            throw new Error(detail || 'Kokoro failed to generate audio')
        }

        const audio = await fs.readFile(outputPath)
        if (!audio.length) throw new Error('Kokoro returned an empty audio file')

        return {
            audio,
            model: 'kokoro-v1.0',
            voice
        }
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
    }
}

const createEnglishSpeech = async ({ apiKey, model, text, kokoroVoice, groqVoice }) => {
    try {
        return await createKokoroEnglishSpeech({ text, voice: kokoroVoice })
    } catch (err) {
        if (!apiKey) throw err
        return createSpeech({ apiKey, model, voice: groqVoice, text })
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
        const selectedVoice = kokoroMode ? KOKORO_VOICE_OPTIONS[voiceMode] : VOICE_OPTIONS[voiceMode]
        const voice = selectedVoice || process.env.GROQ_TTS_VOICE || client.config.GROQ_TTS_VOICE || DEFAULT_VOICE
        if (selectedVoice) args.shift()
        let text = cleanText(args.join(' '))

        if (!text && message.reference?.messageId) {
            const replied = await message.channel.messages.fetch(message.reference.messageId).catch(() => null)
            text = cleanText(replied?.content)
        }

        if (!apiKey && !kokoroMode) {
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
                ? await createEnglishSpeech({
                    apiKey,
                    model,
                    text,
                    kokoroVoice: selectedVoice || 'af_heart',
                    groqVoice: VOICE_OPTIONS[voiceMode] || DEFAULT_VOICE
                })
                : await createSpeech({ apiKey, model, voice, text })
            const attachment = new AttachmentBuilder(result.audio, {
                name: `${makeSafeName(message.author.username)}-tts.${result.extension || 'wav'}`
            })

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Text To Speech')
                .setDescription(`Generated ${kokoroMode ? '**English** ' : selectedVoice ? `**${voiceMode}** ` : ''}voice for ${message.author}.`)
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
                                : `${client.emoji.cross} | TTS is **currently down** or the selected voice/model is invalid.`
                        )
                ]
            })
        }
    }
}
