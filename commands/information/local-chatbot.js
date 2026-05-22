const axios = require('axios')
const { PermissionsBitField } = require('discord.js')

const DEFAULT_LOCAL_URL = 'http://127.0.0.1:1234'

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

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

const isOpenAIComwtible = (baseUrl) => ['openai', 'lmstudio'].includes(getLocalApiMode(baseUrl))

const getLocalApiHeaders = (client) => {
    const apiKey = process.env.LOCAL_CHATBOT_API_KEY || client.config.LOCAL_CHATBOT_API_KEY
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
}

const getSafeApiLabel = (baseUrl) => {
    try {
        const parsed = new URL(baseUrl)
        return `${parsed.hostname}:${parsed.port || (parsed.protocol === 'https:' ? '443' : '80')}`
    } catch {
        return 'local server'
    }
}

const extractModelIds = (data) => {
    const models = data?.data || data?.models || []
    return models
        .map((model) => model.id || model.name || model.path)
        .filter(Boolean)
}

const getChannel = (message, value) => {
    if (!value) return null
    const id = value.match(/^<#(\d+)>$/)?.[1] || value
    return message.guild.channels.cache.get(id) || null
}

const getMemoryKey = (guildId, channelId) => `local_chatbot_memory_${guildId}_${channelId}`
const getPromptKey = (guildId, channelId) => `local_chatbot_prompt_${guildId}_${channelId}`

const getMemory = async (client, guildId, channelId) => {
    return (await client.db.get(getMemoryKey(guildId, channelId))) || []
}

const saveMemoryTurn = async (client, message, userText, botText) => {
    const key = getMemoryKey(message.guild.id, message.channel.id)
    const memory = await getMemory(client, message.guild.id, message.channel.id)
    memory.push({
        user: message.author.username,
        input: cleanText(userText).slice(0, 500),
        output: cleanText(botText).slice(0, 700),
        at: Date.now()
    })
    await client.db.set(key, memory.slice(-8))
}

const buildMemoryMessages = (memory) => {
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

const getConfiguredPrompt = async (client, guildId, channelId) => {
    return cleanText(
        await client.db.get(getPromptKey(guildId, channelId)) ||
        process.env.LOCAL_CHATBOT_SYSTEM_PROMPT ||
        client.config.LOCAL_CHATBOT_SYSTEM_PROMPT
    )
}

const getSystemMessages = (systemPrompt) => {
    const prompt = cleanText(systemPrompt)
    const wordRule = cleanText(process.env.LOCAL_CHATBOT_REPLY_WORDS)
    const parts = []

    if (prompt) parts.push(prompt)
    if (wordRule) parts.push(`Always reply in ${wordRule} words only.`)

    return parts.length ? [{ role: 'system', content: parts.join('\n') }] : []
}

const getFirstModel = async (client, baseUrl) => {
    if (getLocalApiMode(baseUrl) === 'lmstudio') {
        const response = await axios.get(`${baseUrl}/api/v1/models`, {
            headers: getLocalApiHeaders(client),
            timeout: 8000
        })
        return extractModelIds(response.data)[0] || null
    }

    if (isOpenAICompatible(baseUrl)) {
        const response = await axios.get(`${baseUrl}/v1/models`, {
            headers: getLocalApiHeaders(client),
            timeout: 8000
        })
        return extractModelIds(response.data)[0] || null
    }

    const response = await axios.get(`${baseUrl}/api/tags`, {
        timeout: 8000
    })
    return response.data?.models?.[0]?.name || null
}

const listModels = async (client, baseUrl) => {
    if (getLocalApiMode(baseUrl) === 'lmstudio') {
        const response = await axios.get(`${baseUrl}/api/v1/models`, {
            headers: getLocalApiHeaders(client),
            timeout: 8000
        })
        return extractModelIds(response.data)
    }

    if (isOpenAICompatible(baseUrl)) {
        const response = await axios.get(`${baseUrl}/v1/models`, {
            headers: getLocalApiHeaders(client),
            timeout: 8000
        })
        return extractModelIds(response.data)
    }

    const response = await axios.get(`${baseUrl}/api/tags`, {
        timeout: 8000
    })
    return response.data?.models?.map((model) => model.name).filter(Boolean) || []
}

const askOllama = async ({ client, baseUrl, model, prompt, username, memory = [], systemPrompt = '' }) => {
    const started = Date.now()
    const systemMessages = getSystemMessages(systemPrompt)
    const memoryMessages = buildMemoryMessages(memory)

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
                        content: `${username}: ${prompt}`
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

    if (isOpenAICompatible(baseUrl)) {
        const response = await axios.post(
            `${baseUrl}/v1/chat/completions`,
            {
                model,
                messages: [
                    ...systemMessages,
                    ...memoryMessages,
                    {
                        role: 'user',
                        content: `${username}: ${prompt}`
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
                    content: `${username}: ${prompt}`
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

const saveUsage = async (client, guildId, usage) => {
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
    return current
}

module.exports = {
    name: 'local-chatbot',
    aliases: ['localchatbot', 'ollama', 'localai'],
    category: 'utility',
    premium: true,
    run: async (client, message, args) => {
        const baseUrl = getLocalBaseUrl(client)
        const subcommand = args[0]?.toLowerCase()
        const channelKey = `local_chatbot_channel_${message.guild.id}`
        const enableActions = ['on', 'enable', 'start', 'set']
        const disableActions = ['off', 'disable', 'reset', 'remove']
        const memoryKey = getMemoryKey(message.guild.id, message.channel.id)
        const promptKey = getPromptKey(message.guild.id, message.channel.id)

        if (enableActions.includes(subcommand) || disableActions.includes(subcommand) || subcommand === 'status') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | You need **Administrator** permission to setup local chatbot channel.`)
                    ]
                })
            }

            if (subcommand === 'status') {
                const channelId = await client.db.get(channelKey)
                const apiLabel = getSafeApiLabel(baseUrl)
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setTitle('Local Chatbot Channel')
                            .setDescription(channelId ? `Local API chatbot is enabled in <#${channelId}>.\nChannel ID: \`${channelId}\`\nAPI: \`${apiLabel}\`` : 'Local API chatbot is currently disabled.')
                            .setFooter({
                                text: `${message.guild.prefix}local-chatbot enable | ${message.guild.prefix}local-chatbot off`,
                                iconURL: client.user.displayAvatarURL({ dynamic: true })
                            })
                    ]
                })
            }

            if (disableActions.includes(subcommand)) {
                await client.db.delete(channelKey)
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.tick} | Local API chatbot auto reply has been disabled.`)
                    ]
                })
            }

            const channel = getChannel(message, args[1]) || message.channel
            if (!channel || !channel.isTextBased()) {
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | Usage: \`${message.guild.prefix}local-chatbot enable\` or \`${message.guild.prefix}local-chatbot enable #channel\``)
                    ]
                })
            }

            await client.db.set(channelKey, channel.id)
            const apiLabel = getSafeApiLabel(baseUrl)
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.tick} | Local API chatbot enabled in ${channel}.\nAPI: \`${apiLabel}\`\nMessages there will get plain text replies without prefix or embed.`)
                ]
            })
        }

        if (subcommand === 'prompt') {
            const action = args[1]?.toLowerCase()
            const needsAdmin = ['set', 'clear', 'reset', 'remove'].includes(action)

            if (needsAdmin && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | You need **Administrator** permission to change local chatbot prompt.`)
                    ]
                })
            }

            if (action === 'set') {
                const prompt = cleanText(args.slice(2).join(' '))
                if (!prompt) {
                    return message.channel.send({
                        embeds: [
                            client.util.embed()
                                .setColor(client.color)
                                .setDescription(`${client.emoji.cross} | Usage: \`${message.guild.prefix}local-chatbot prompt set your prompt here\``)
                        ]
                    })
                }

                if (prompt.length > 1800) {
                    return message.channel.send({
                        embeds: [
                            client.util.embed()
                                .setColor(client.color)
                                .setDescription(`${client.emoji.cross} | Keep local chatbot prompt under **1800 characters**.`)
                        ]
                    })
                }

                await client.db.set(promptKey, prompt)
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.tick} | Local chatbot prompt saved for this channel.\nRun \`${message.guild.prefix}local-chatbot memory clear\` if old replies still affect behavior.`)
                    ]
                })
            }

            if (['clear', 'reset', 'remove'].includes(action)) {
                await client.db.delete(promptKey)
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.tick} | Local chatbot prompt cleared for this channel.`)
                    ]
                })
            }

            const prompt = await getConfiguredPrompt(client, message.guild.id, message.channel.id)
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setTitle('Local Chatbot Prompt')
                        .setDescription(prompt ? `\`\`\`\n${prompt.slice(0, 1800)}\n\`\`\`` : 'No bot-side prompt is set for this channel.')
                        .setFooter({
                            text: `${message.guild.prefix}local-chatbot prompt set <prompt> | prompt clear`,
                            iconURL: client.user.displayAvatarURL({ dynamic: true })
                        })
                ]
            })
        }

        if (subcommand === 'memory') {
            const action = args[1]?.toLowerCase()

            if (action === 'clear' || action === 'reset') {
                await client.db.delete(memoryKey)
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.tick} | Local chatbot memory cleared for this channel.`)
                    ]
                })
            }

            if (action === 'off' || action === 'disable') {
                await client.db.set(`local_chatbot_memory_disabled_${message.guild.id}_${message.channel.id}`, true)
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.tick} | Local chatbot memory disabled for this channel.`)
                    ]
                })
            }

            if (action === 'on' || action === 'enable') {
                await client.db.delete(`local_chatbot_memory_disabled_${message.guild.id}_${message.channel.id}`)
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.tick} | Local chatbot memory enabled for this channel.`)
                    ]
                })
            }

            const memory = await getMemory(client, message.guild.id, message.channel.id)
            const disabled = await client.db.get(`local_chatbot_memory_disabled_${message.guild.id}_${message.channel.id}`)
            const preview = memory.slice(-5).map((entry, index) => {
                return `\`${index + 1}.\` **${entry.user}:** ${entry.input.slice(0, 90)}`
            }).join('\n') || 'No memory saved yet.'

            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setTitle('Local Chatbot Memory')
                        .setDescription(`Status: **${disabled ? 'Disabled' : 'Enabled'}**\nSaved turns: **${memory.length}**\n\n${preview}`)
                        .setFooter({
                            text: `${message.guild.prefix}local-chatbot memory clear | memory off | memory on`,
                            iconURL: client.user.displayAvatarURL({ dynamic: true })
                        })
                ]
            })
        }

        if (subcommand === 'models') {
            try {
                const models = await listModels(client, baseUrl)
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setTitle('Local API Models')
                            .setDescription(models.length ? models.map((model) => `\`${model}\``).join('\n') : 'No local models found.')
                    ]
                })
            } catch (err) {
                const unauthorized = err.response?.status === 401
                const apiLabel = getSafeApiLabel(baseUrl)
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(
                                unauthorized
                                    ? `${client.emoji.cross} | LM Studio rejected the request with **401 Unauthorized**.\nSet \`LOCAL_CHATBOT_API_KEY\` in \`.env\`, or disable API key auth in LM Studio.`
                                    : `${client.emoji.cross} | Could not connect to local API at \`${apiLabel}\`. If it needs auth, set \`LOCAL_CHATBOT_API_KEY\` in \`.env\`.`
                            )
                    ]
                })
            }
        }

        let prompt = cleanText(args.join(' '))

        if (!prompt && message.reference?.messageId) {
            const replied = await message.channel.messages.fetch(message.reference.messageId).catch(() => null)
            prompt = cleanText(replied?.content)
        }

        if (!prompt) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(
                            `${client.emoji.cross} | Usage: \`${message.guild.prefix}local-chatbot hello\`\n` +
                            `List local models with \`${message.guild.prefix}local-chatbot models\`.`
                        )
                ]
            })
        }

        if (prompt.length > 1000) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Keep local chatbot prompts under **1000 characters**.`)
                ]
            })
        }

        try {
            await message.channel.sendTyping().catch(() => null)
            const model = process.env.LOCAL_CHATBOT_MODEL || process.env.OLLAMA_MODEL || client.config.LOCAL_CHATBOT_MODEL || client.config.OLLAMA_MODEL || await getFirstModel(client, baseUrl)

            if (!model) {
                const apiLabel = getSafeApiLabel(baseUrl)
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | No local model found from \`${apiLabel}\`. Start your local server and load a model.`)
                    ]
                })
            }

            const memoryDisabled = await client.db.get(`local_chatbot_memory_disabled_${message.guild.id}_${message.channel.id}`)
            const memory = memoryDisabled ? [] : await getMemory(client, message.guild.id, message.channel.id)
            const systemPrompt = await getConfiguredPrompt(client, message.guild.id, message.channel.id)
            const result = await askOllama({
                client,
                baseUrl,
                model,
                prompt,
                username: message.author.username,
                memory,
                systemPrompt
            })
            await saveUsage(client, message.guild.id, { ...result, model })
            if (!memoryDisabled) {
                await saveMemoryTurn(client, message, prompt, result.reply)
            }

            return message.channel.send({
                content: result.reply,
                allowedMentions: { parse: [] }
            })
        } catch (err) {
            client.logger?.log?.(`local-chatbot error: ${err.response?.data?.error || err.message}`, 'error')
            const unauthorized = err.response?.status === 401
            const apiLabel = getSafeApiLabel(baseUrl)
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(
                            unauthorized
                                ? `${client.emoji.cross} | LM Studio rejected the request with **401 Unauthorized**.\nSet \`LOCAL_CHATBOT_API_KEY\` in \`.env\`, or disable API key auth in LM Studio.`
                                : `${client.emoji.cross} | Local API is not responding at \`${apiLabel}\`, needs \`LOCAL_CHATBOT_API_KEY\`, or the selected model is invalid.`
                        )
                ]
            })
        }
    }
}
