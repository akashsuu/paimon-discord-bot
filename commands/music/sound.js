const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

const DEFAULT_AUDIOCRAFT_API_URL = 'http://127.0.0.1:7868'
const DEFAULT_SOUND_DURATION = 4
const DEFAULT_AUDIOCRAFT_TIMEOUT_MS = 900000

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const makeSafeName = (value) => {
    const name = cleanText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)

    return `${name || 'akashsuu-sound'}.wav`
}

const audioExtension = (contentType = '') => {
    if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3'
    if (contentType.includes('ogg')) return 'ogg'
    if (contentType.includes('flac')) return 'flac'
    return 'wav'
}

const getAudioCraftUrl = (client) => {
    const url = process.env.AUDIOCRAFT_API_URL || client.config.AUDIOCRAFT_API_URL || DEFAULT_AUDIOCRAFT_API_URL
    return String(url).replace(/\/+$/, '')
}

const createSoundPrompt = (input) => [
    input,
    'realistic sound effect, field recording, no music'
].join(' ')

const generateSound = async ({ baseUrl, prompt, duration }) => {
    const timeout = Number(process.env.AUDIOCRAFT_TIMEOUT_MS || DEFAULT_AUDIOCRAFT_TIMEOUT_MS)
    const response = await axios.post(
        `${baseUrl}/generate-sound`,
        {
            prompt,
            duration
        },
        {
            headers: {
                Accept: 'audio/wav',
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer',
            timeout,
            validateStatus: () => true
        }
    )

    const contentType = String(response.headers?.['content-type'] || '')
    if (!response.status || response.status >= 400 || contentType.includes('application/json')) {
        const errorText = Buffer.from(response.data || '').toString('utf8')
        let message = errorText || `AudioCraft returned status ${response.status}`
        try {
            const parsed = JSON.parse(errorText)
            message = parsed.error || parsed.message || message
        } catch {}
        throw new Error(message)
    }

    const audio = Buffer.from(response.data)
    if (!audio.length) throw new Error('AudioCraft returned an empty audio file')

    return {
        audio,
        extension: audioExtension(contentType)
    }
}

module.exports = {
    name: 'sound',
    aliases: ['sfx', 'effect'],
    category: 'music',
    cooldown: 20,
    run: async (client, message, args) => {
        const input = cleanText(args.join(' '))
        const prefix = message.guild.prefix || client.config.PREFIX

        if (!input) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${prefix}sound rain\`, \`${prefix}sound cat meow\`, or \`${prefix}sound thunderstorm\``)
                ]
            })
        }

        if (input.length > 300) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Keep sound prompts under **300 characters**.`)
                ]
            })
        }

        const audioCraftUrl = getAudioCraftUrl(client)
        const duration = Number(process.env.AUDIOCRAFT_SOUND_DURATION || process.env.AUDIOCRAFT_DURATION || client.config.AUDIOCRAFT_SOUND_DURATION || DEFAULT_SOUND_DURATION)
        const prompt = createSoundPrompt(input)

        const loading = await message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setTitle('Sound Generator')
                    .setDescription(`${client.emoji.tick} | Creating sound with local AudioCraft. This can take 1-2 minutes on CPU...`)
                    .addFields(
                        { name: 'Sound', value: `\`${input.slice(0, 80)}\``, inline: true },
                        { name: 'Duration', value: `\`${duration}s\``, inline: true },
                        { name: 'Server', value: `\`${audioCraftUrl}\``, inline: true }
                    )
            ]
        })

        try {
            const result = await generateSound({ baseUrl: audioCraftUrl, prompt, duration })
            const filename = makeSafeName(input).replace(/\.wav$/, `.${result.extension}`)
            const attachment = new AttachmentBuilder(result.audio, { name: filename })

            return loading.edit({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setTitle('Sound Created')
                        .setDescription(`${client.emoji.tick} | Generated sound for ${message.author}.`)
                        .addFields(
                            { name: 'Prompt', value: input.slice(0, 300) },
                            { name: 'Generator', value: '`AudioCraft local`', inline: true },
                            { name: 'Duration', value: `\`${duration}s\``, inline: true }
                        )
                        .setFooter({
                            text: 'akashsuu sound generator',
                            iconURL: client.user.displayAvatarURL({ dynamic: true })
                        })
                ],
                files: [attachment]
            })
        } catch (err) {
            client.logger?.log?.(`sound generator error: ${err.message}`, 'error')
            const offline = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN'].includes(err.code) || /connect|ECONNREFUSED|ENOTFOUND|timed out/i.test(String(err.message))
            return loading.edit({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(offline
                            ? `${client.emoji.cross} | AudioCraft is not running at \`${audioCraftUrl}\`. Start it from \`C:\\Users\\akash\\Desktop\\audiocraft\` with \`.venv-audiocraft\\Scripts\\python.exe scripts\\audiocraft_server.py\`, then try again.`
                            : `${client.emoji.cross} | AudioCraft failed: \`${String(err.message || err).slice(0, 180)}\``)
                ]
            })
        }
    }
}
