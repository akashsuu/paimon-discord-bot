const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    PermissionsBitField,
    Collection,
    WebhookClient,
    ButtonStyle
} = require('discord.js')
const axios = require('axios')
const {
    AudioPlayerStatus,
    NoSubscriberBehavior,
    StreamType,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    getVoiceConnection,
    joinVoiceChannel
} = require('@discordjs/voice')
const { execFile } = require('child_process')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const { promisify } = require('util')
const config = require(`${process.cwd()}/config.json`)

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'
const DEFAULT_LOCAL_URL = 'http://127.0.0.1:1234'
const execFileAsync = promisify(execFile)
const voiceChatPlayers = new Map()

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const limitVoiceText = (value) => cleanText(value).slice(0, 240)
const cleanLocalReply = (value) => {
    let text = String(value || '')
    text = text.replace(/<reserved_\d+>[\s\S]*?(?=<reserved_\d+>)/g, '')
    text = text.replace(/<reserved_\d+>/g, '')
    return cleanText(text)
}

const getLocalBaseUrl = (client) => {
    return (
        process.env.LOCAL_CHATBOT_URL ||
        process.env.OLLAMA_URL ||
        client.config.LOCAL_CHATBOT_URL ||
        client.config.OLLAMA_URL ||
        DEFAULT_LOCAL_URL
    ).replace(/\/+$/, '')
}

const getLocalApiMode = (baseUrl) => {
    return process.env.LOCAL_CHATBOT_API || (/:(1234)$/.test(baseUrl) ? 'lmstudio' : 'ollama')
}

const isOpenAICompatibleLocalApi = (baseUrl) => ['openai', 'lmstudio'].includes(getLocalApiMode(baseUrl))

const getLocalApiHeaders = (client) => {
    const apiKey = process.env.LOCAL_CHATBOT_API_KEY || client.config.LOCAL_CHATBOT_API_KEY
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
}

const extractLocalModelIds = (data) => {
    const models = data?.data || data?.models || []
    return models
        .map((model) => model.id || model.name || model.path)
        .filter(Boolean)
}

const getLocalMemoryKey = (guildId, channelId) => `local_chatbot_memory_${guildId}_${channelId}`
const getLocalPromptKey = (guildId, channelId) => `local_chatbot_prompt_${guildId}_${channelId}`

const getLocalMemory = async (client, guildId, channelId) => {
    return (await client.db.get(getLocalMemoryKey(guildId, channelId))) || []
}

const saveLocalMemoryTurn = async (client, message, userText, botText) => {
    const key = getLocalMemoryKey(message.guild.id, message.channel.id)
    const memory = await getLocalMemory(client, message.guild.id, message.channel.id)
    memory.push({
        user: message.author.username,
        input: cleanText(userText).slice(0, 500),
        output: cleanText(botText).slice(0, 700),
        at: Date.now()
    })
    await client.db.set(key, memory.slice(-8))
}

const createWindowsVoiceFile = async (text) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akashsuu-voicechat-'))
    const outputPath = path.join(tempDir, 'voice.wav')
    const script = `
        & {
        Add-Type -AssemblyName System.Speech
        $Text = $env:AKASHSUU_VOICE_TEXT
        $OutputPath = $env:AKASHSUU_VOICE_OUTPUT
        $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $speaker.Rate = 1
        $speaker.Volume = 100
        $speaker.SetOutputToWaveFile($OutputPath)
        $speaker.Speak($Text)
        $speaker.Dispose()
        }
    `

    try {
        await execFileAsync('powershell.exe', [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            script
        ], {
            timeout: 30000,
            windowsHide: true,
            env: {
                ...process.env,
                AKASHSUU_VOICE_TEXT: limitVoiceText(text),
                AKASHSUU_VOICE_OUTPUT: outputPath
            }
        })

        const stat = await fs.stat(outputPath)
        if (!stat.size) throw new Error('Windows TTS returned an empty audio file')
        return { outputPath, tempDir }
    } catch (err) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
        throw err
    }
}

const speakVoiceChatReply = async (client, message, voiceChannel, text) => {
    if (!voiceChannel?.joinable) throw new Error('I cannot join that voice channel.')
    if (!voiceChannel?.speakable) throw new Error('I cannot speak in that voice channel.')

    let state = voiceChatPlayers.get(message.guild.id)
    if (!state) {
        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play
            }
        })
        player.on('error', (err) => client.logger?.log?.(`voicechat player error: ${err.message}`, 'error'))
        state = { player, busy: false }
        voiceChatPlayers.set(message.guild.id, state)
    }

    if (state.busy) state.player.stop(true)
    state.busy = true

    let tempDir = null
    try {
        const generated = await createWindowsVoiceFile(text)
        tempDir = generated.tempDir

        const adapterCreator = message.guild.voiceAdapterCreator
        if (typeof adapterCreator !== 'function') {
            throw new Error('Discord voice adapter is missing. Restart the bot and make sure @discordjs/voice is installed.')
        }

        const voiceGroup = `akashsuu-${message.guild.id}`
        let connection = getVoiceConnection(message.guild.id, voiceGroup)
        if (connection && connection.joinConfig.channelId !== voiceChannel.id) {
            connection.destroy()
            connection = null
        }

        connection ||= joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator,
            selfDeaf: false,
            selfMute: false,
            group: voiceGroup
        })

        connection.removeAllListeners('debug')
        connection.removeAllListeners('error')
        connection.on('debug', (debug) => client.logger?.log?.(`voicechat connection debug: ${debug}`, 'log'))
        connection.on('error', (err) => client.logger?.log?.(`voicechat connection error: ${err.message}`, 'error'))

        await entersState(connection, VoiceConnectionStatus.Ready, 60000).catch((err) => {
            const status = connection.state?.status || 'unknown'
            throw new Error(`Voice connection did not become ready. Status: ${status}. ${err.message}`)
        })
        const subscription = connection.subscribe(state.player)
        if (!subscription) throw new Error('Discord voice subscription failed.')

        state.player.stop(true)
        const resource = createAudioResource(generated.outputPath, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true
        })
        resource.volume?.setVolume(1)
        state.player.play(resource)
        await entersState(state.player, AudioPlayerStatus.Playing, 60000).catch((err) => {
            const status = state.player.state?.status || 'unknown'
            throw new Error(`Audio player did not start. Status: ${status}. ${err.message}`)
        })
        await new Promise((resolve, reject) => {
            const cleanup = () => {
                clearTimeout(timer)
                state.player.off(AudioPlayerStatus.Idle, onIdle)
                state.player.off('error', onError)
            }
            const onIdle = () => {
                cleanup()
                resolve()
            }
            const onError = (err) => {
                cleanup()
                reject(err)
            }
            const timer = setTimeout(() => {
                cleanup()
                reject(new Error('Voice audio timed out before finishing playback'))
            }, 120000)

            state.player.once(AudioPlayerStatus.Idle, onIdle)
            state.player.once('error', onError)
        })
        return true
    } finally {
        state.busy = false
        if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
    }
}

global.__akashsuuSpeakVoiceChatReply = speakVoiceChatReply

const buildLocalMemoryMessages = (memory) => {
    return memory.flatMap((entry) => [
        {
            role: 'user',
            content: `${entry.user}: ${entry.input}`
        },
        {
            role: 'assistant',
            content: entry.output
        }
    ])
}

const getConfiguredLocalPrompt = async (client, guildId, channelId) => {
    return cleanText(
        await client.db.get(getLocalPromptKey(guildId, channelId)) ||
        process.env.LOCAL_CHATBOT_SYSTEM_PROMPT ||
        client.config.LOCAL_CHATBOT_SYSTEM_PROMPT
    )
}

const getLocalSystemMessages = (systemPrompt) => {
    const prompt = cleanText(systemPrompt)
    const wordRule = cleanText(process.env.LOCAL_CHATBOT_REPLY_WORDS)
    const parts = []

    if (prompt) parts.push(prompt)
    if (wordRule) parts.push(`Always reply in ${wordRule} words only.`)

    return parts.length ? [{ role: 'system', content: parts.join('\n') }] : []
}

const getFirstLocalModel = async (client, baseUrl) => {
    if (getLocalApiMode(baseUrl) === 'lmstudio') {
        const response = await axios.get(`${baseUrl}/api/v1/models`, {
            headers: getLocalApiHeaders(client),
            timeout: 8000
        })
        return extractLocalModelIds(response.data)[0] || null
    }

    if (isOpenAICompatibleLocalApi(baseUrl)) {
        const response = await axios.get(`${baseUrl}/v1/models`, {
            headers: getLocalApiHeaders(client),
            timeout: 8000
        })
        return extractLocalModelIds(response.data)[0] || null
    }

    const response = await axios.get(`${baseUrl}/api/tags`, {
        timeout: 8000
    })
    return response.data?.models?.[0]?.name || null
}

const saveOllamaUsage = async (client, guildId, usage) => {
    const key = `ollama_usage_${guildId}`
    const current = await client.db.get(key) || {
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        lastModel: null,
        lastDurationMs: 0,
        updatedAt: null
    }

    current.requests += 1
    current.promptTokens += usage.promptTokens
    current.completionTokens += usage.completionTokens
    current.totalTokens += usage.promptTokens + usage.completionTokens
    current.lastModel = usage.model
    current.lastDurationMs = usage.durationMs
    current.updatedAt = Date.now()

    await client.db.set(key, current)
}

const askAutoLocalChatbot = async ({ client, baseUrl, model, content, username, guildName, memory = [], systemPrompt = '' }) => {
    const started = Date.now()
    const systemMessages = getLocalSystemMessages(systemPrompt)
    const memoryMessages = buildLocalMemoryMessages(memory)

    if (getLocalApiMode(baseUrl) === 'lmstudio') {
        const response = await axios.post(
            `${baseUrl}/api/v1/chat`,
            {
                model,
                messages: [
                    ...systemMessages,
                    ...memoryMessages,
                    {
                        role: 'user',
                        content: `${username}: ${content}`
                    }
                ],
                temperature: 0.8,
                max_tokens: 220,
                stream: false
            },
            {
                headers: getLocalApiHeaders(client),
                timeout: 60000
            }
        )

        const reply = response.data?.choices?.[0]?.message?.content || response.data?.message?.content || response.data?.content
        if (!reply) throw new Error('LM Studio API returned an invalid response')

        return {
            reply: cleanText(reply).slice(0, 1900),
            promptTokens: Number(response.data?.usage?.prompt_tokens) || 0,
            completionTokens: Number(response.data?.usage?.completion_tokens) || 0,
            durationMs: Date.now() - started
        }
    }

    if (isOpenAICompatibleLocalApi(baseUrl)) {
        const response = await axios.post(
            `${baseUrl}/v1/chat/completions`,
            {
                model,
                messages: [
                    ...systemMessages,
                    ...memoryMessages,
                    {
                        role: 'user',
                        content: `${username}: ${content}`
                    }
                ],
                temperature: 0.8,
                max_tokens: 220
            },
            {
                headers: getLocalApiHeaders(client),
                timeout: 60000
            }
        )

        const reply = response.data?.choices?.[0]?.message?.content
        if (!reply) throw new Error('Local API returned an invalid response')

        return {
            reply: cleanText(reply).slice(0, 1900),
            promptTokens: Number(response.data?.usage?.prompt_tokens) || 0,
            completionTokens: Number(response.data?.usage?.completion_tokens) || 0,
            durationMs: Date.now() - started
        }
    }

    const response = await axios.post(
        `${baseUrl}/api/chat`,
        {
            model,
            stream: false,
            messages: [
                ...systemMessages,
                ...memoryMessages,
                {
                    role: 'user',
                    content: `${username}: ${content}`
                }
            ],
            options: {
                temperature: 0.8,
                num_predict: 220
            }
        },
        {
            timeout: 60000
        }
    )

    const reply = response.data?.message?.content
    if (!reply) throw new Error('Ollama returned an invalid response')

    return {
        reply: cleanText(reply).slice(0, 1900),
        promptTokens: Number(response.data?.prompt_eval_count) || 0,
        completionTokens: Number(response.data?.eval_count) || 0,
        durationMs: Math.round((Number(response.data?.total_duration) || 0) / 1000000)
    }
}

const askAutoChatbot = async ({ apiKey, model, content, username, guildName }) => {
    const response = await axios.post(
        GROQ_CHAT_URL,
        {
            model,
            messages: [
                {
                    role: 'system',
                    content:
                        `You are akashsuu, a cool savage Discord chatbot in ${guildName}. ` +
                        'Reply in plain text only. Keep replies short, funny, casual, and helpful. ' +
                        'Do not use embeds, markdown tables, slurs, threats, harassment, sexual content, or private data. ' +
                        'If asked for harmful content, refuse with a playful harmless joke.'
                },
                {
                    role: 'user',
                    content: `${username}: ${content}`
                }
            ],
            temperature: 0.9,
            max_tokens: 160,
            top_p: 0.9
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 20000
        }
    )

    const reply = response.data?.choices?.[0]?.message?.content
    if (!reply) throw new Error('Groq chatbot returned an invalid response')

    return cleanText(reply).slice(0, 1800)
}

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild || message.system) return
        try {          
            const autodelUsers = (await client.db.get(`autodel_${message.guild.id}`)) || []
            if (autodelUsers.includes(message.author.id)) {
                if (message.deletable) {
                    await message.delete().catch(() => {})
                }
                return
            }

            let uprem = await client.db.get(`uprem_${message.author.id}`)

            let upremend = await client.db.get(`upremend_${message.author.id}`)
            //user premiums scopes ^^

            let sprem = await client.db.get(`sprem_${message.guild.id}`)

            let spremend = await client.db.get(`spremend_${message.guild.id}`)

            //server premium scopes ^^
            let scot = 0
            let slink = `${client.config.invite}`
            if (upremend && Date.now() >= upremend) {
                let upremcount = (await client.db.get(
                    `upremcount_${message.author.id}`
                ))
                    ? await client.db.get(`upremcount_${message.author.id}`)
                    : 0

                let upremserver = (await client.db.get(
                    `upremserver_${message.author.id}`
                ))
                    ? await client.db.get(`upremserver_${message.author.id}`)
                    : []

                let spremown = await client.db.get(
                    `spremown_${message.guild.id}`
                )

                await client.db.delete(`upremcount_${message.author.id}`)
                await client.db.delete(`uprem_${message.author.id}`)
                await client.db.delete(`upremend_${message.author.id}`)
                await client.db.pull(`noprefix_${client.user.id}`,message.author.id)
                if (upremserver.length > 0) {
                    for (let i = 0; i < upremserver.length; i++) {
                        scot += 1
                        await client.db.delete(`sprem_${upremserver[i]}`)
                        await client.db.delete(`spremend_${upremserver[i]}`)
                        await client.db.delete(`spremown_${upremserver[i]}`)
                    }
                }
                await client.db.delete(`upremserver_${message.author.id}`)
                message.author
                    .send({
                        embeds: [
                            client.util.embed()
                                .setColor(client.color)
                                .setDescription(
                                    `Your Premium Has Got Expired.\nTotal **\`${scot}\`** Servers [Premium](${client.config.invite}) was removed.\nClick [here](${client.config.invite}) To Buy [Premium](${client.config.invite}).`
                                )
                        ],
                        components: [premrow]
                    })
                    .catch((err) => { })
            }

            if (spremend && Date.now() >= spremend) {
                let scount = 0

                let us = await client.db.get(`spremown_${message.guild.id}`)

                let upremserver = (await client.db.get(`upremserver_${us}`))
                    ? await client.db.get(`upremserver_${us}`)
                    : []

                let upremcount = (await client.db.get(`upremcount_${us}`))
                    ? await client.db.get(`upremcount_${us}`)
                    : 0

                let spremown = await client.db
                    .get(`spremown_${message.guild.id}`)
                    .then((r) => client.db.get(`upremend_${r}`))

                await client.db.delete(`sprem_${message.guild.id}`)
                await client.db.delete(`spremend_${message.guild.id}`)

                if (spremown && Date.now() > spremown) {
                    await client.db.delete(`upremcount_${us}`)
                    await client.db.delete(`uprem_${us}`)
                    await client.db.delete(`upremend_${us}`)

                    for (let i = 0; i < upremserver.length; i++) {
                        scount += 1
                        await client.db.delete(`sprem_${upremserver[i]}`)
                        await client.db.delete(`spremend_${upremserver[i]}`)
                        await client.db.delete(`spremown_${upremserver[i]}`)
                    }
                    try {
                        await client.users.cache
                            .get(`${us}`)
                            .send({
                                embeds: [
                                    client.util.embed()
                                        .setColor(client.color)
                                        .setDescription(
                                            `Your Premium Has Got Expired.\nTotal **\`${scount}\`** Servers [Premium](${client.config.invite}) was removed.\nClick [here](${client.config.invite}) To Buy [Premium](${client.config.invite}).`
                                        )
                                ],
                                components: [premrow]
                            })
                            .catch((er) => { })
                    } catch (errors) { }
                }
                await client.db.delete(`upremserver_${us}`)
                await client.db.delete(`spremown_${message.guild.id}`)
                message.channel
                    .send({
                        embeds: [
                            client.util.embed()
                                .setColor(client.color)
                                .setDescription(
                                    `The Premium Of This Server Has Got Expired.\nClick [here](${client.config.invite}) To Buy [Premium](${client.config.invite}).`
                                )
                        ],
                        components: [premrow]
                    })
                    .catch((err) => { })
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel(`Invite Me`)
                    .setStyle(ButtonStyle.Link)
                    .setURL(
                        `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`
                    ),
                new ButtonBuilder()
                    .setLabel(`Support`)
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${client.config.invite}`)
            )
            await client.util.setPrefix(message, client)
            await client.util.noprefix()
            await client.util.blacklist()

            let blacklistdb = client.blacklist || []
            if (
                blacklistdb.includes(message.author.id) &&
                !client.config.owner.includes(message.author.id)
            ) {
                return
            }

            if (message.content === `<@${client.user.id}>`) {
                await client.util.setPrefix(message, client)
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setTitle(message.guild.name)
                            .setDescription(
                                `Hey ${message.author},\nMy Prefix here is: \`${message.guild.prefix}\`\nServer Id: \`${message.guild.id}\`\n\nType \`${message.guild.prefix}\`**help** To Get The Command List.`
                            )
                            .setFooter({
                                text: `Made by akashsuu`,
                                iconURL: client.user.displayAvatarURL({ dynamic: true })
                            })
                    ],
                    components: [row]
                })
            }
            let prefix = message.guild.prefix || client.config.PREFIX
            const mentionRegexPrefix = RegExp(`^<@!?${client.user.id}>`)
            const prefix1 = message.content.match(mentionRegexPrefix) ? message.content.match(mentionRegexPrefix)[0] : prefix;

            const voiceChatbotChannelId = await client.db.get(`voice_chatbot_channel_${message.guild.id}`)
            if (
                voiceChatbotChannelId === message.channel.id &&
                !message.content.startsWith(prefix1) &&
                !message.content.match(mentionRegexPrefix)
            ) {
                const prompt = cleanText(message.content)
                if (!prompt) return

                client.voiceChatbotCooldowns ??= new Collection()
                const cooldownKey = `${message.guild.id}:${message.author.id}`
                const lastUsed = client.voiceChatbotCooldowns.get(cooldownKey) || 0
                if (Date.now() - lastUsed < 5000) return
                client.voiceChatbotCooldowns.set(cooldownKey, Date.now())

                const voiceChannel = message.member?.voice?.channel
                if (!voiceChannel) {
                    return message.reply({
                        content: 'Join a voice channel first, then chat here and I will speak there.',
                        allowedMentions: { repliedUser: false }
                    }).catch(() => null)
                }

                const botMember = message.guild.members.me
                const voicePermissions = voiceChannel.permissionsFor(botMember)
                if (!voicePermissions?.has(PermissionsBitField.Flags.Connect) || !voicePermissions?.has(PermissionsBitField.Flags.Speak)) {
                    return message.reply({
                        content: 'I need **Connect** and **Speak** permission in your voice channel.',
                        allowedMentions: { repliedUser: false }
                    }).catch(() => null)
                }

                const baseUrl = getLocalBaseUrl(client)
                await message.channel.sendTyping().catch(() => null)

                try {
                    const model = process.env.LOCAL_CHATBOT_MODEL || process.env.OLLAMA_MODEL || client.config.LOCAL_CHATBOT_MODEL || client.config.OLLAMA_MODEL || await getFirstLocalModel(client, baseUrl)
                    if (!model) {
                        return message.reply({
                            content: 'No local model found. Start LM Studio, load a model, then try again.',
                            allowedMentions: { repliedUser: false }
                        }).catch(() => null)
                    }

                    const memoryDisabled = await client.db.get(`local_chatbot_memory_disabled_${message.guild.id}_${message.channel.id}`)
                    const memory = memoryDisabled ? [] : await getLocalMemory(client, message.guild.id, message.channel.id)
                    const systemPrompt = await getConfiguredLocalPrompt(client, message.guild.id, message.channel.id)
                    const result = await askAutoLocalChatbot({
                        client,
                        baseUrl,
                        model,
                        content: prompt.slice(0, 900),
                        username: message.author.username,
                        guildName: message.guild.name,
                        memory,
                        systemPrompt: cleanText(`${systemPrompt}\nReply in one short sentence. This reply will be spoken in a voice channel.`)
                    })

                    const replyText = cleanLocalReply(result.reply) || 'Hi.'

                    await saveOllamaUsage(client, message.guild.id, { ...result, model })
                    if (!memoryDisabled) {
                        await saveLocalMemoryTurn(client, message, prompt, replyText)
                    }

                    await message.reply({
                        content: replyText,
                        allowedMentions: { repliedUser: false, parse: [] }
                    }).catch(() => null)

                    try {
                        const played = await speakVoiceChatReply(client, message, voiceChannel, replyText)
                        if (!played) {
                            await message.channel.send({
                                content: 'I am still speaking the last reply. Try again in a moment.',
                                allowedMentions: { parse: [] }
                            }).catch(() => null)
                        }
                    } catch (voiceErr) {
                        client.logger?.log?.(`voicechat speak error: ${voiceErr.stack || voiceErr.message}`, 'error')
                        await message.channel.send({
                            content: `I got the local model reply, but voice speaking failed: \`${cleanText(voiceErr.message).slice(0, 180)}\``,
                            allowedMentions: { parse: [] }
                        }).catch(() => null)
                    }
                    return
                } catch (err) {
                    client.logger?.log?.(`voicechat error: ${err.response?.data?.error || err.message}`, 'error')
                    const unauthorized = err.response?.status === 401
                    return message.reply({
                        content: unauthorized
                            ? 'LM Studio rejected the request with 401 Unauthorized. Disable API key auth in LM Studio or set `LOCAL_CHATBOT_API_KEY` in `.env`.'
                            : 'Voice chatbot failed. Make sure LM Studio is running, a model is loaded, and FFmpeg/voice dependencies are installed.',
                        allowedMentions: { repliedUser: false }
                    }).catch(() => null)
                }
            }

            const localChatbotChannelId = await client.db.get(`local_chatbot_channel_${message.guild.id}`)
            if (
                localChatbotChannelId === message.channel.id &&
                !message.content.startsWith(prefix1) &&
                !message.content.match(mentionRegexPrefix)
            ) {
                const prompt = cleanText(message.content)
                if (!prompt) return

                client.localChatbotCooldowns ??= new Collection()
                const cooldownKey = `${message.guild.id}:${message.author.id}`
                const lastUsed = client.localChatbotCooldowns.get(cooldownKey) || 0
                if (Date.now() - lastUsed < 3500) return
                client.localChatbotCooldowns.set(cooldownKey, Date.now())

                const baseUrl = getLocalBaseUrl(client)
                await message.channel.sendTyping().catch(() => null)

                try {
                    const model = process.env.LOCAL_CHATBOT_MODEL || process.env.OLLAMA_MODEL || client.config.LOCAL_CHATBOT_MODEL || client.config.OLLAMA_MODEL || await getFirstLocalModel(client, baseUrl)
                    if (!model) {
                        return message.reply({
                            content: 'No local model found. Start your local API and load a model first.',
                            allowedMentions: { repliedUser: false }
                        }).catch(() => null)
                    }

                    const memoryDisabled = await client.db.get(`local_chatbot_memory_disabled_${message.guild.id}_${message.channel.id}`)
                    const memory = memoryDisabled ? [] : await getLocalMemory(client, message.guild.id, message.channel.id)
                    const systemPrompt = await getConfiguredLocalPrompt(client, message.guild.id, message.channel.id)
                    const result = await askAutoLocalChatbot({
                        client,
                        baseUrl,
                        model,
                        content: prompt.slice(0, 1000),
                        username: message.author.username,
                        guildName: message.guild.name,
                        memory,
                        systemPrompt
                    })
                    await saveOllamaUsage(client, message.guild.id, { ...result, model })
                    if (!memoryDisabled) {
                        await saveLocalMemoryTurn(client, message, prompt, result.reply)
                    }

                    return message.reply({
                        content: result.reply,
                        allowedMentions: { repliedUser: false, parse: [] }
                    })
                } catch (err) {
                    client.logger?.log?.(`local auto-chatbot error: ${err.response?.data?.error || err.message}`, 'error')
                    const unauthorized = err.response?.status === 401
                    return message.reply({
                        content: unauthorized
                            ? 'LM Studio rejected the request with 401 Unauthorized. Set `LOCAL_CHATBOT_API_KEY` in `.env`, or disable API key auth in LM Studio.'
                            : `Local API is not responding at \`${baseUrl}\`, or the selected model is invalid.`,
                        allowedMentions: { repliedUser: false }
                    }).catch(() => null)
                }
            }

            const chatbotChannelId = await client.db.get(`chatbot_channel_${message.guild.id}`)
            if (
                chatbotChannelId === message.channel.id &&
                !message.content.startsWith(prefix1) &&
                !message.content.match(mentionRegexPrefix)
            ) {
                const apiKey = process.env.GROQ_API_KEY || client.config.GROQ_API_KEY
                const model = process.env.GROQ_MODEL || client.config.GROQ_MODEL || DEFAULT_GROQ_MODEL
                const prompt = cleanText(message.content)

                if (!apiKey) {
                    return message.reply({
                        content: 'GROQ_API_KEY missing in .env. Add it and restart me.',
                        allowedMentions: { repliedUser: false }
                    }).catch(() => null)
                }

                if (!prompt) return

                client.chatbotCooldowns ??= new Collection()
                const cooldownKey = `${message.guild.id}:${message.author.id}`
                const lastUsed = client.chatbotCooldowns.get(cooldownKey) || 0
                if (Date.now() - lastUsed < 3500) return
                client.chatbotCooldowns.set(cooldownKey, Date.now())

                await message.channel.sendTyping().catch(() => null)

                try {
                    const reply = await askAutoChatbot({
                        apiKey,
                        model,
                        content: prompt.slice(0, 900),
                        username: message.author.username,
                        guildName: message.guild.name
                    })

                    return message.reply({
                        content: reply,
                        allowedMentions: { repliedUser: false, parse: [] }
                    })
                } catch (err) {
                    client.logger?.log?.(`chatbot error: ${err.response?.data?.error?.message || err.message}`, 'error')
                    return message.reply({
                        content: 'chatbot api is down or the Groq key/model is invalid.',
                        allowedMentions: { repliedUser: false }
                    }).catch(() => null)
                }
            }

            let datab = client.noprefix || []
            if (!datab.includes(message.author.id)) {
                if (!message.content.startsWith(prefix1)) return
            }

            const args =
                datab.includes(message.author.id) == false
                    ? message.content.slice(prefix1.length).trim().split(/ +/)
                    : message.content.startsWith(prefix1) == true
                        ? message.content.slice(prefix1.length).trim().split(/ +/)
                        : message.content.trim().split(/ +/)

            const cmd = args.shift().toLowerCase()

            const command =
                client.commands.get(cmd.toLowerCase()) ||
                client.commands.find((c) =>
                    c.aliases?.includes(cmd.toLowerCase())
                )

  

            let customdata = await client.db.get(
                `customrole_${message.guild.id}`
            )
            if (customdata) {
                for (const [index, data] of customdata.names.entries()) {
                    if (
                        (!datab.includes(message.author.id) && message.content.startsWith(prefix1) && cmd === data) ||
                        (datab.includes(message.author.id) && !message.content.startsWith(prefix1) && cmd === data) ||
                        (datab.includes(message.author.id) && message.content.startsWith(prefix1) && cmd === data)
                    ) {
                        const ignore = (await client.db?.get(`ignore_${message.guild.id}`)) ?? { channel: [], role: [] };
                        if (
                            ignore.channel.includes(message.channel.id) &&
                            !message.member.roles.cache.some((role) => ignore.role.includes(role.id))
                        ) {
                            const msg = await message.channel.send({
                                embeds: [
                                    client.util.embed()
                                        .setColor(client.color)
                                        .setDescription(
                                            `This channel is currently in my ignore list, so commands can't be executed here. Please try another channel or reach out to the server Administrator for assistance.`
                                        )
                                ]
                            });
                            setTimeout(() => msg.delete(), 3000);
                            return;
                        }
            
                        let role = await message.guild.roles.fetch(customdata.roles[index]);
                        if (!customdata.reqrole) {
                            await message.channel.send({
                                content: `**Attention:** Before using custom commands, please set up the required role.`,
                                embeds: [
                                    client.util.embed()
                                        .setColor(client.color)
                                        .setTitle('Required Role Setup')
                                        .setDescription(
                                            `To enable custom commands, you need to set up a specific role that users must have to access these commands.\nUse the command to set the required role: \n\`${message.guild.prefix}setup reqrole @YourRequiredRole/id\``
                                        )
                                        .setTimestamp()
                                ]
                            });
                            return;
                        }
            
                        if (!message.guild.roles.cache.has(customdata.reqrole)) {
                            customdata.reqrole = null;
                            await client.db?.set(`customrole_${message.guild.id}`, customdata);
                            await message.channel.send({
                                content: `**Warning:** The required role may have been deleted from the server. I am clearing the associated data from the database.`,
                                embeds: [
                                    client.util.embed()
                                        .setColor(client.color)
                                        .setTitle('Database Update')
                                        .setDescription(
                                            `This action is taken to maintain consistency. Please ensure that server roles are managed appropriately.`
                                        )
                                        .setFooter({ text: 'If you encounter issues, contact a server Administrator.' })
                                ]
                            });
                            return;
                        }
            
                        if (!message.member.roles.cache.has(customdata.reqrole)) {
                            await message.channel.send({
                                content: `**Access Denied!**`,
                                embeds: [
                                    client.util.embed()
                                        .setColor(client.color)
                                        .setTitle('Permission Error')
                                        .setDescription(`You do not have the required role to use custom commands.`)
                                        .addFields({ name: 'Required Role:', value: `<@&${customdata.reqrole}>` })
                                        .setFooter({ text: 'Please contact a server Administrator for assistance.' })
                                ]
                            });
                            return;
                        }
            
                        if (!role) {
                            customdata.names.splice(index, 1);
                            customdata.roles.splice(index, 1);
                            await client.db?.set(`customrole_${message.guild.id}`, customdata);
                            await message.channel.send({
                                content: `**Warning:** The specified role was not found, possibly deleted. I am removing associated data from the database.`,
                                embeds: [
                                    client.util.embed()
                                        .setColor(client.color)
                                        .setTitle('Database Cleanup')
                                        .setDescription(
                                            `To maintain accurate records, the associated data is being removed. Ensure roles are managed properly to prevent future issues.`
                                        )
                                        .setFooter({ text: 'Contact a server Administrator if you encounter any problems.' })
                                ]
                            });
                            return;
                        } else if (
                            role.permissions.has(PermissionsBitField.Flags.KickMembers) ||
                            role.permissions.has(PermissionsBitField.Flags.BanMembers) ||
                            role.permissions.has(PermissionsBitField.Flags.Administrator) ||
                            role.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
                            role.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
                            role.permissions.has(PermissionsBitField.Flags.MentionEveryone) ||
                            role.permissions.has(PermissionsBitField.Flags.ManageRoles) ||
                            role.permissions.has(PermissionsBitField.Flags.ManageWebhooks) ||
                            role.permissions.has(PermissionsBitField.Flags.ManageEvents) ||
                            role.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
                            role.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)
                        ) {
                            const restrictedPermissions = [
                                PermissionsBitField.Flags.KickMembers,
                                PermissionsBitField.Flags.BanMembers,
                                PermissionsBitField.Flags.Administrator,
                                PermissionsBitField.Flags.ManageChannels,
                                PermissionsBitField.Flags.ManageGuild,
                                PermissionsBitField.Flags.MentionEveryone,
                                PermissionsBitField.Flags.ManageRoles,
                                PermissionsBitField.Flags.ManageWebhooks,
                                PermissionsBitField.Flags.ManageEvents,
                                PermissionsBitField.Flags.ModerateMembers,
                                PermissionsBitField.Flags.ManageEmojisAndStickers
                            ];
            
                            const removePermissionsButton = new ButtonBuilder()
                                .setLabel('Remove Permissions')
                                .setStyle(ButtonStyle.Danger)
                                .setCustomId('remove_permissions');
            
                            const row = new ActionRowBuilder().addComponents(removePermissionsButton);
                            const initialMessage = await message.channel.send({
                                embeds: [
                                    client.util.embed()
                                        .setColor(client.color)
                                        .setDescription(
                                            `${client.emoji.cross} | **Permission Denied**\nI cannot add <@&${role.id}> to anyone because it possesses the following restricted permissions:\n${role.permissions.toArray()
                                                .filter(permission => restrictedPermissions.includes(permission))
                                                .map(permission => `• \`${PermissionsBitField.Flags[permission]}\``)
                                                .join('\n')}\nPlease review and adjust the role permissions accordingly.`
                                        )
                                ],
                                components: [row]
                            });
            
                            const filter = interaction => interaction.customId === 'remove_permissions' && interaction.user.id === message.author.id;
            
                            const collector = message.channel.createMessageComponentCollector({ filter, time: 15000 });
            
                            collector.on('collect', async (interaction) => {
                                if (interaction.user.id !== message.author.id) {
                                    await interaction.reply({
                                        embeds: [
                                            client.util.embed()
                                                .setColor(client.color)
                                                .setDescription(`${client.emoji.cross} | Only ${message.author} can use this button.`)
                                        ],
                                        ephemeral: true // Only visible to the user who clicked the button
                                    });
                                } else if (role.editable) {
                                    await role.setPermissions([], `Action Done By ${interaction.user.username} Removed dangerous permissions from role`);
                                    await interaction.reply({
                                        embeds: [
                                            client.util.embed()
                                                .setColor(client.color)
                                                .setDescription(`${client.emoji.tick} | Permissions removed successfully.`)
                                        ],
                                        ephemeral: true // Only visible to the user who clicked the button
                                    });
                                } else {
                                    await interaction.reply({
                                        embeds: [
                                            client.util.embed()
                                                .setColor(client.color)
                                                .setDescription(
                                                    `${client.emoji.cross} | I don't have sufficient permissions to clear permissions from the role. Please make sure my role position is higher than the role you're trying to modify.`
                                                )
                                        ],
                                        ephemeral: true // Only visible to the user who clicked the button
                                    });
                                }
                            });
            
                            collector.on('end', () => {
                                removePermissionsButton.setDisabled(true);
                                initialMessage.edit({
                                    components: [new ActionRowBuilder().addComponents(removePermissionsButton)]
                                });
                            });
                        } else {
                            let member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
                            if (!member) {
                                await message.channel.send({
                                    embeds: [
                                        client.util.embed()
                                            .setColor(client.color)
                                            .setTitle('Invalid Member')
                                            .setDescription(`Make sure to mention a valid member or provide their ID.`)
                                    ]
                                });
                                return;
                            }
                            if (!role.editable) {
                                await message.channel.send({
                                    embeds: [
                                        client.util.embed()
                                            .setColor(client.color)
                                            .setDescription(
                                                `${client.emoji.cross} | I can't provide this role as my highest role is either below or equal to the provided role.`
                                            )
                                    ]
                                });
                            } else if (member.roles.cache.has(role.id)) {
                                await member.roles.remove(role.id, `${message.author.tag} | ${message.author.id}`);
                                await message.channel.send({
                                    embeds: [
                                        client.util.embed()
                                            .setColor(client.color)
                                            .setDescription(`${client.emoji.tick} | The role ${role} has been successfully removed from ${member}`)
                                    ]
                                });
                            } else {
                                await member.roles.add(role.id, `${message.author.tag} | ${message.author.id}`);
                                await message.channel.send({
                                    embeds: [
                                        client.util.embed()
                                            .setColor(client.color)
                                            .setDescription(`${client.emoji.tick} | The role ${role} has been successfully added to ${member}`)
                                    ]
                                });
                            }
                        }
                    }
                }
            }
            /* if (command.premium || true) {
                if (!client.config.owner.includes(message.author.id) && !uprem && !sprem) {
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('Premium')
                            .setStyle(ButtonStyle.Link)
                            .setEmoji('<a:akashsuu_premium:1092098944131137536>')
                            .setURL(`${client.config.invite}`),
                    )
                    const embeds = client.util.embed()
                    embeds
                        .setDescription(
                            `[Click here to buy Premium](${client.config.invite}) so that you can use this command.`
                        )
                        .setColor(client.color)
                    return message.channel.send({
                        content : `Hey ${message.author.displayName},\nYou just found up a **Premium** Command, which can be used only in servers where there's an **Active Premium Subscription.**`,
                        embeds: [embeds],
                        components: [row]
                    })
                }
            }*/
            if (!command) return
            let maintain = await client.db.get(`maintanance_${client.user.id}`)
            if (maintain && !client.config.admin.includes(message.author.id)) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(`Invite Me`)
                        .setStyle(ButtonStyle.Link)
                        .setURL(
                            `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`
                        ),
                    new ButtonBuilder()
                        .setLabel(`Support`)
                        .setStyle(ButtonStyle.Link)
                        .setURL(`https://discord.com/invite/${client.config.invite}`)
                )
                return message.channel.send({ embeds: [client.util.embed().setColor(client.color).setTitle("Notice: Bot Functionality Globally Disabled by Developers").setDescription(`Dear Discord Community Members,\n\nWe regret to inform you that the functionality of the bot has been globally disabled by the developers. We understand the inconvenience this may cause and appreciate your understanding as we work to resolve the issue.\n\nThank you for your patience and continued support.\nSincerely,\n[𝑻𝒆𝒓𝒎𝒊𝒏𝒂𝒕𝒐𝒓 </>](${client.config.invite})`)], components: [row] })
            }
            const ignore = (await client.db?.get(
                `ignore_${message.guild.id}`
            )) ?? { channel: [], role: [] }
            if (!client.config.owner.includes(message.author.id) &&
                ignore.channel.includes(message.channel.id) &&
                !message.member.roles.cache.some((role) =>
                    ignore.role.includes(role.id)
                )
            ) {
                return await message.channel
                    .send({
                        embeds: [
                            client.util.embed()
                                .setColor(client.color)
                                .setDescription(
                                    `This channel is currently in my ignore list, so commands can't be executed here. Please try another channel or reach out to the server Administrator for assistance.`
                                )
                        ]
                    })
                    .then((x) => {
                        setTimeout(() => x.delete(), 3000)
                    })
            }

                   
const commandLimit = 5

if (
    client.config.cooldown &&
    !client.config.owner.includes(message.author.id)
) {
    if (!client.cooldowns.has(command.name)) {
        client.cooldowns.set(command.name, new Collection())
    }
    const now = Date.now()
    const timestamps = client.cooldowns.get(command.name)
    const cooldownAmount = (command.cooldown ? command.cooldown : 5) * 1000;

    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000

            let commandCount = timestamps.get(`${message.author.id}_count`) || 0
            commandCount++
            timestamps.set(`${message.author.id}_count`, commandCount)

            if (commandCount > commandLimit) {
                let blacklistedUsers = (await client.db.get(`blacklist_${client.user.id}`)) || []
                if (!blacklistedUsers.includes(message.author.id)) {
                    blacklistedUsers.push(message.author.id)
                    await client.db.set(`blacklist_${client.user.id}`, blacklistedUsers)
                    client.util.blacklist()
                }
                const saixd = client.util.embed()
                    .setColor(client.color)
                    .setTitle('Blacklisted for Spamming')
                    .setDescription(`You have been blacklisted for spamming commands. Please refrain from such behavior.`)
                    .addFields({ name : 'Support Server', value : '[Join our support server](https://discord.gg/S7Ju9RUpbT)'}, true)
                    .setTimestamp()

                return message.channel.send({ embeds: [saixd] })
            }
            

            if (!timestamps.has(`${message.author.id}_cooldown_message_sent`)) {
                message.channel.send({
                    embeds: [client.util.embed()
                        .setColor(client.color)
                        .setDescription(`Please wait, this command is on cooldown for \`${timeLeft.toFixed(1)}s\``)
                    ]
                }).then((msg) => {
                    setTimeout(() => msg.delete().catch((e) => { }), 5000)
                })

                timestamps.set(`${message.author.id}_cooldown_message_sent`, true)
            }
            
            return;
        }
    }

    timestamps.set(message.author.id, now)
    timestamps.set(`${message.author.id}_count`, 1) 
    setTimeout(() => {
        timestamps.delete(message.author.id)
        timestamps.delete(`${message.author.id}_count`)
        timestamps.delete(`${message.author.id}_cooldown_message_sent`) 
    }, cooldownAmount)
}
            await command.run(client, message, args)
            if (command) {
               const web = new WebhookClient({
    url: `https://discord.com/api/webhooks/1297057322333638728/Gt0NEEzV5k6HOv45OBLvUUxca3Yc1Gt78Nmc0Xb8ASHxm-dYo2uzMgdaz3LUhNyOM_l9`
});

const commandlog = client.util.embed()
    .setAuthor({
        name: message.author.tag,
        iconURL: message.author.displayAvatarURL({ dynamic: true })
    })
    .setColor(client.color)
    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
    .setTimestamp()
    .setDescription(
        `Command Ran In: \`${message.guild.name} | ${message.guild.id}\`\n` +
        `Command Ran In Channel: \`${message.channel.name} | ${message.channel.id}\`\n` +
        `Command Name: \`${command.name}\`\n` +
        `Command Executor: \`${message.author.tag} | ${message.author.id}\`\n` +
        `Command Content: \`${message.content}\``
    );

const queue = [];
let isSending = false;

function processQueue() {
    if (queue.length === 0 || isSending) return;

    isSending = true;
    const embed = queue.shift();

    web.send({ embeds: [embed] })
        .then(() => {
            setTimeout(() => {
                isSending = false;
                processQueue();
            }, 2000);
        })
        .catch();
}

queue.push(commandlog);
processQueue();
            }
        } catch(err) {
            if (err.code === 429) {
                await client.util.handleRateLimit()
            }
            client.logger.log(`messageCreate error: ${err.stack || err.message || err}`, 'error')
            return
        }
    })
}

