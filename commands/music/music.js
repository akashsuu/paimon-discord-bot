const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

const DEFAULT_AUDIOCRAFT_API_URL = 'http://127.0.0.1:7868'

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const makeSafeName = (value) => {
    const name = cleanText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)

    return `${name || 'akashsuu-music'}.wav`
}

const audioExtension = (contentType = '') => {
    if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3'
    if (contentType.includes('ogg')) return 'ogg'
    if (contentType.includes('flac')) return 'flac'
    return 'wav'
}

const buildMusicPrompt = ({ mode, input }) => {
    if (mode === 'lyrics') {
        return [
            'Create a complete song from these lyrics.',
            'Style: modern, catchy, polished, full instrumental arrangement with vocal melody.',
            'Lyrics:',
            input
        ].join('\n')
    }

    return input
}

const getAudioCraftUrl = (client) => {
    const url = process.env.AUDIOCRAFT_API_URL || client.config.AUDIOCRAFT_API_URL || DEFAULT_AUDIOCRAFT_API_URL
    return String(url).replace(/\/+$/, '')
}

const createMusicWithAudioCraft = async ({ baseUrl, prompt, duration }) => {
    const response = await axios.post(
        `${baseUrl}/generate`,
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
            timeout: 300000,
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
        extension: audioExtension(contentType),
        provider: 'AudioCraft'
    }
}

module.exports = {
    name: 'music',
    aliases: ['musichelp'],
    category: 'music',
    cooldown: 15,
    run: async (client, message, args) => {
        const action = args[0]?.toLowerCase()
        const creatorActions = ['lyrics', 'lyric', 'create', 'generate', 'make']

        if (creatorActions.includes(action)) {
            const audioCraftUrl = getAudioCraftUrl(client)
            const duration = Number(process.env.AUDIOCRAFT_DURATION || client.config.AUDIOCRAFT_DURATION || 20)
            const input = cleanText(args.slice(1).join(' '))
            const mode = ['lyrics', 'lyric'].includes(action) ? 'lyrics' : 'create'
            const prefix = message.guild.prefix || client.config.PREFIX

            if (!input) {
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | Usage: \`${prefix}music lyrics <lyrics>\` or \`${prefix}music create cyberpunk song theme with lyrics\``)
                    ]
                })
            }

            if (input.length > 900) {
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | Keep music prompts under **900 characters**.`)
                    ]
                })
            }

            const prompt = buildMusicPrompt({ mode, input })
            const loading = await message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setTitle('Music Creator')
                        .setDescription(`${client.emoji.tick} | Creating music with local AudioCraft. This can take 1-5 minutes...`)
                        .addFields(
                            { name: 'Mode', value: `\`${mode}\``, inline: true },
                            { name: 'Generator', value: '`AudioCraft local`', inline: true },
                            { name: 'Server', value: `\`${audioCraftUrl}\``, inline: true }
                        )
                ]
            })

            try {
                const result = await createMusicWithAudioCraft({ baseUrl: audioCraftUrl, prompt, duration })
                const filename = makeSafeName(input).replace(/\.wav$/, `.${result.extension}`)
                const attachment = new AttachmentBuilder(result.audio, { name: filename })

                return loading.edit({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setTitle('Music Created')
                            .setDescription(`${client.emoji.tick} | Generated music for ${message.author}.`)
                            .addFields(
                                { name: 'Prompt', value: input.slice(0, 900) },
                                { name: 'Generator', value: '`AudioCraft local`', inline: true },
                                { name: 'Server', value: `\`${audioCraftUrl}\``, inline: true }
                            )
                            .setFooter({
                                text: 'akashsuu music creator',
                                iconURL: client.user.displayAvatarURL({ dynamic: true })
                            })
                    ],
                    files: [attachment]
                })
            } catch (err) {
                client.logger?.log?.(`music creator error: ${err.message}`, 'error')
                const offline = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN'].includes(err.code) || /connect|ECONNREFUSED|ENOTFOUND|timed out/i.test(String(err.message))
                return loading.edit({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(offline
                                ? `${client.emoji.cross} | AudioCraft is not running at \`${audioCraftUrl}\`. Start it with \`python scripts/audiocraft_server.py\`, then try again.`
                                : `${client.emoji.cross} | AudioCraft failed: \`${String(err.message || err).slice(0, 180)}\``)
                    ]
                })
            }
        }

        if (action && !['help', 'commands', 'cmds'].includes(action)) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${message.guild.prefix}music help\`, \`${message.guild.prefix}music lyrics <lyrics>\`, or \`${message.guild.prefix}music create <prompt>\``)
                ]
            })
        }

        const lavalinkStatus = client.lavalink
            ? client.lavalink.initiated
                ? '`ready`'
                : '`starting`'
            : '`not configured`'

        const commands = [
            `\`${message.guild.prefix}play <song/url>\` - Play a song or playlist`,
            `\`${message.guild.prefix}skip\` - Skip the current song`,
            `\`${message.guild.prefix}stop\` - Stop music and leave voice`,
            `\`${message.guild.prefix}pause\` - Pause the player`,
            `\`${message.guild.prefix}resume\` - Resume the player`,
            `\`${message.guild.prefix}queue [page]\` - Show the queue`,
            `\`${message.guild.prefix}nowplaying\` - Show current song`,
            `\`${message.guild.prefix}volume <1-150>\` - Change volume`,
            `\`${message.guild.prefix}music lyrics <lyrics>\` - Generate music from lyrics with local AudioCraft`,
            `\`${message.guild.prefix}music create <prompt>\` - Generate music from a prompt with local AudioCraft`
        ]

        return message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setTitle('Music Help')
                    .setDescription('Join a voice channel, then use the commands below.')
                    .addFields(
                        {
                            name: 'Commands',
                            value: commands.join('\n')
                        },
                        {
                            name: 'Examples',
                            value:
                                `\`${message.guild.prefix}play faded alan walker\`\n` +
                                `\`${message.guild.prefix}play https://youtu.be/...\`\n` +
                                `\`${message.guild.prefix}volume 80\`\n` +
                                `\`${message.guild.prefix}music create cyberpunk song theme with lyrics\`\n` +
                                `\`${message.guild.prefix}music lyrics I am lost in neon lights\``
                        },
                        {
                            name: 'Lavalink',
                            value: `Status: ${lavalinkStatus}`,
                            inline: true
                        }
                    )
                    .setFooter({
                        text: 'akashsuu music',
                        iconURL: client.user.displayAvatarURL({ dynamic: true })
                    })
            ]
        })
    }
}
