const axios = require('axios')

const DEFAULT_LOCAL_URL = 'http://127.0.0.1:1234'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

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

const buildMessages = (text) => [
    {
        role: 'system',
        content:
            'You decode broken English and rearranged words into clean, natural English. ' +
            'Fix word order, spelling, grammar, and meaning. Keep the original meaning. ' +
            'Return only the corrected sentence. Do not explain.'
    },
    {
        role: 'user',
        content:
            `Decode this broken or rearranged English:\n${text}\n\n` +
            'Example: "what name your is" -> "What is your name?"'
    }
]

const askLocalModel = async ({ client, baseUrl, model, text }) => {
    const messages = buildMessages(text)

    if (getLocalApiMode(baseUrl) === 'lmstudio') {
        const response = await axios.post(
            `${baseUrl}/api/v1/chat`,
            {
                model,
                messages,
                temperature: 0.15,
                max_tokens: 220,
                stream: false
            },
            {
                headers: getLocalApiHeaders(client),
                timeout: 60000
            }
        )
        return response.data?.choices?.[0]?.message?.content || response.data?.message?.content || response.data?.content
    }

    if (isOpenAICompatible(baseUrl)) {
        const response = await axios.post(
            `${baseUrl}/v1/chat/completions`,
            {
                model,
                messages,
                temperature: 0.15,
                max_tokens: 220
            },
            {
                headers: getLocalApiHeaders(client),
                timeout: 60000
            }
        )
        return response.data?.choices?.[0]?.message?.content
    }

    const response = await axios.post(
        `${baseUrl}/api/chat`,
        {
            model,
            stream: false,
            messages,
            options: {
                temperature: 0.15,
                num_predict: 220
            }
        },
        { timeout: 60000 }
    )
    return response.data?.message?.content
}

const askGroq = async ({ client, text }) => {
    const apiKey = process.env.GROQ_API_KEY || client.config.GROQ_API_KEY
    if (!apiKey) return null

    const model = process.env.GROQ_MODEL || client.config.GROQ_MODEL || DEFAULT_GROQ_MODEL
    const response = await axios.post(
        GROQ_URL,
        {
            model,
            messages: buildMessages(text),
            temperature: 0.15,
            max_tokens: 220
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 20000
        }
    )

    return {
        decoded: response.data?.choices?.[0]?.message?.content,
        model
    }
}

module.exports = {
    name: 'decode',
    aliases: ['arrange', 'fixenglish', 'unscramble'],
    category: 'utility',
    premium: true,
    run: async (client, message, args) => {
        const prefix = message.guild?.prefix || client.config.PREFIX
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
                        .setDescription(`${client.emoji.cross} | Usage: \`${prefix}decode what name your is\`\nYou can also reply to a message with \`${prefix}decode\`.`)
                ]
            })
        }

        if (text.length > 1000) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Keep decode text under **1000 characters**.`)
                ]
            })
        }

        await message.channel.sendTyping().catch(() => null)

        let decoded
        let modelLabel = 'local model'
        const baseUrl = getLocalBaseUrl(client)

        try {
            const model = process.env.LOCAL_CHATBOT_MODEL || process.env.OLLAMA_MODEL || client.config.LOCAL_CHATBOT_MODEL || client.config.OLLAMA_MODEL || await getFirstModel(client, baseUrl)
            if (model) {
                decoded = await askLocalModel({ client, baseUrl, model, text })
                modelLabel = `Local model: ${model}`
            }
        } catch (err) {
            client.logger?.log?.(`decode local model skipped: ${err.response?.data?.error || err.message}`, 'warn')
        }

        if (!decoded) {
            try {
                const groq = await askGroq({ client, text })
                decoded = groq?.decoded
                if (groq?.model) modelLabel = `Groq: ${groq.model}`
            } catch (err) {
                client.logger?.log?.(`decode groq error: ${err.response?.data?.error?.message || err.message}`, 'error')
            }
        }

        decoded = cleanText(decoded).replace(/^["']|["']$/g, '').slice(0, 1800)
        if (!decoded) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Decode AI is not responding. Start LM Studio or add \`GROQ_API_KEY\` in \`.env\`.`)
                ]
            })
        }

        return message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setAuthor({
                        name: 'akashsuu language decoder',
                        iconURL: client.user.displayAvatarURL({ dynamic: true })
                    })
                    .addFields(
                        { name: 'Input', value: text.slice(0, 1000) },
                        { name: 'Decoded', value: decoded }
                    )
                    .setFooter({
                        text: modelLabel,
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
            ]
        })
    }
}
