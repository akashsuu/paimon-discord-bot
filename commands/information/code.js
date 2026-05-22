const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

const DEFAULT_LOCAL_URL = 'http://127.0.0.1:1234'
const INLINE_CODE_LIMIT = 1800

const LANGUAGE_EXTENSIONS = {
    js: 'js',
    javascript: 'js',
    ts: 'ts',
    typescript: 'ts',
    py: 'py',
    python: 'py',
    html: 'html',
    css: 'css',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    'c++': 'cpp',
    cs: 'cs',
    csharp: 'cs',
    go: 'go',
    rust: 'rs',
    rs: 'rs',
    php: 'php',
    lua: 'lua',
    rb: 'rb',
    ruby: 'rb',
    sh: 'sh',
    bash: 'sh',
    json: 'json',
    sql: 'sql'
}

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const cleanCode = (value) => {
    return String(value || '')
        .replace(/```[a-zA-Z0-9+#-]*\n?/g, '')
        .replace(/```/g, '')
        .trim()
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

const isOpenAICompatible = (baseUrl) => ['openai', 'lmstudio'].includes(getLocalApiMode(baseUrl))

const getLocalApiHeaders = (client) => {
    const apiKey = process.env.LOCAL_CHATBOT_API_KEY || client.config.LOCAL_CHATBOT_API_KEY
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
}

const extractModelIds = (data) => {
    const models = data?.data || data?.models || []
    return models.map((model) => model.id || model.name || model.path).filter(Boolean)
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

    const response = await axios.get(`${baseUrl}/api/tags`, { timeout: 8000 })
    return response.data?.models?.[0]?.name || null
}

const parseRequest = (args) => {
    const first = args[0]?.toLowerCase()
    const extension = LANGUAGE_EXTENSIONS[first]
    if (!extension) {
        return {
            language: 'text',
            extension: 'txt',
            prompt: cleanText(args.join(' '))
        }
    }

    return {
        language: first,
        extension,
        prompt: cleanText(args.slice(1).join(' '))
    }
}

const buildCodeMessages = ({ language, prompt, username }) => [
    {
        role: 'system',
        content:
            'You are Akashsuu Code Generator. Return only working code. ' +
            'Do not explain. Do not add markdown fences. Do not add paragraphs before or after the code. ' +
            'Include helpful code comments only when needed.'
    },
    {
        role: 'user',
        content:
            `${username} wants code in ${language}.\n` +
            `Task: ${prompt}\n\n` +
            'Generate complete usable code only.'
    }
]

const askCodeModel = async ({ client, baseUrl, model, language, prompt, username }) => {
    const started = Date.now()
    const messages = buildCodeMessages({ language, prompt, username })

    if (getLocalApiMode(baseUrl) === 'lmstudio') {
        const response = await axios.post(
            `${baseUrl}/api/v1/chat`,
            {
                model,
                messages,
                temperature: 0.25,
                max_tokens: 1800,
                stream: false
            },
            {
                headers: getLocalApiHeaders(client),
                timeout: 120000
            }
        )

        const reply = response.data?.choices?.[0]?.message?.content || response.data?.message?.content || response.data?.content
        if (!reply) throw new Error('LM Studio API returned an invalid response')
        return {
            code: cleanCode(reply),
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
                messages,
                temperature: 0.25,
                max_tokens: 1800
            },
            {
                headers: getLocalApiHeaders(client),
                timeout: 120000
            }
        )

        const reply = response.data?.choices?.[0]?.message?.content
        if (!reply) throw new Error('Local API returned an invalid response')
        return {
            code: cleanCode(reply),
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
            messages,
            options: {
                temperature: 0.25,
                num_predict: 1800
            }
        },
        {
            timeout: 120000
        }
    )

    const reply = response.data?.message?.content
    if (!reply) throw new Error('Ollama returned an invalid response')
    return {
        code: cleanCode(reply),
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
}

const makeSafeName = (prompt, extension) => {
    const slug = cleanText(prompt)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 36)

    return `${slug || 'akashsuu-code'}.${extension}`
}

module.exports = {
    name: 'code',
    aliases: ['generatecode', 'coder'],
    category: 'utility',
    premium: true,
    run: async (client, message, args) => {
        const prefix = message.guild?.prefix || client.config.PREFIX
        const { language, extension, prompt } = parseRequest(args)

        if (!prompt) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${prefix}code js make a calculator\` or \`${prefix}code python discord bot ping command\``)
                ]
            })
        }

        const baseUrl = getLocalBaseUrl(client)
        await message.channel.sendTyping().catch(() => null)

        try {
            const model = process.env.LOCAL_CHATBOT_MODEL || process.env.OLLAMA_MODEL || client.config.LOCAL_CHATBOT_MODEL || client.config.OLLAMA_MODEL || await getFirstModel(client, baseUrl)
            if (!model) {
                return message.channel.send({
                    content: `${message.author}`,
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | No local model found. Start LM Studio, load a model, then try again.`)
                    ]
                })
            }

            const result = await askCodeModel({
                client,
                baseUrl,
                model,
                language,
                prompt,
                username: message.author.username
            })

            await saveUsage(client, message.guild.id, { ...result, model })

            if (!result.code) throw new Error('Local model returned empty code')

            if (result.code.length <= INLINE_CODE_LIMIT) {
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setTitle(`Code: ${language}`)
                            .setDescription(`\`\`\`${extension}\n${result.code}\n\`\`\``)
                            .setFooter({
                                text: `Local model: ${model}`,
                                iconURL: client.user.displayAvatarURL({ dynamic: true })
                            })
                    ]
                })
            }

            const attachment = new AttachmentBuilder(Buffer.from(result.code, 'utf8'), {
                name: makeSafeName(prompt, extension)
            })

            return message.channel.send({
                content: `${message.author}`,
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setTitle(`Code: ${language}`)
                        .setDescription(`Generated code is too long for Discord, so I attached it as a file.\n\n**Model:** \`${model}\``)
                ],
                files: [attachment]
            })
        } catch (err) {
            client.logger?.log?.(`code command error: ${err.response?.data?.error || err.message}`, 'error')
            const unauthorized = err.response?.status === 401
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(unauthorized
                            ? `${client.emoji.cross} | LM Studio rejected the request with 401 Unauthorized. Disable API key auth or set \`LOCAL_CHATBOT_API_KEY\` in \`.env\`.`
                            : `${client.emoji.cross} | Local model is not responding. Start LM Studio at \`${baseUrl}\` and load a model first.`)
                ]
            })
        }
    }
}
