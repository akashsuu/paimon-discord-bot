const axios = require('axios')

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

const isOpenAICompatible = (baseUrl) => ['openai', 'lmstudio'].includes(getLocalApiMode(baseUrl))

const getLocalApiHeaders = (client) => {
    const apiKey = process.env.LOCAL_CHATBOT_API_KEY || client.config.LOCAL_CHATBOT_API_KEY
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
}

const extractModelIds = (data) => {
    const models = data?.data || data?.models || []
    return models
        .map((model) => model.id || model.name || model.path)
        .filter(Boolean)
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

const buildTeacherMessages = (topic, username) => [
    {
        role: 'system',
        content:
            'You are Akashsuu Teacher, a patient real teacher. Teach step by step in clear English. ' +
            'Use bullet points as the main format. Avoid long paragraphs. Use clear section headings, numbered steps, examples, common mistakes, and a small recap. ' +
            'Explain like the student is new but smart. Be detailed, practical, and calm. Do not be too short.'
    },
    {
        role: 'user',
        content:
            `${username} wants to learn: ${topic}\n\n` +
            'Create a detailed bullet-point lesson. Do not write big paragraphs.\n' +
            'Use this exact style:\n' +
            '**Simple Introduction**\n' +
            '- point\n' +
            '- point\n\n' +
            '**What You Need To Know First**\n' +
            '- point\n' +
            '- point\n\n' +
            '**Step-By-Step Teaching**\n' +
            '1. step with bullet details\n' +
            '2. step with bullet details\n\n' +
            '**Important Points**\n' +
            '- point\n' +
            '- point\n\n' +
            '**Example Or Mini Practice**\n' +
            '- example\n\n' +
            '**Common Mistakes**\n' +
            '- mistake and fix\n\n' +
            '**Quick Recap**\n' +
            '- recap point'
    }
]

const askTeacher = async ({ client, baseUrl, model, topic, username }) => {
    const started = Date.now()
    const messages = buildTeacherMessages(topic, username)

    if (getLocalApiMode(baseUrl) === 'lmstudio') {
        const response = await axios.post(
            `${baseUrl}/api/v1/chat`,
            {
                model,
                messages,
                temperature: 0.65,
                max_tokens: 1200,
                stream: false
            },
            {
                headers: getLocalApiHeaders(client),
                timeout: 90000
            }
        )

        const reply = response.data?.choices?.[0]?.message?.content || response.data?.message?.content || response.data?.content
        if (!reply) throw new Error('LM Studio API returned an invalid response')

        return {
            reply: cleanText(reply),
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
                temperature: 0.65,
                max_tokens: 1200
            },
            {
                headers: getLocalApiHeaders(client),
                timeout: 90000
            }
        )

        const reply = response.data?.choices?.[0]?.message?.content
        if (!reply) throw new Error('Local API returned an invalid response')

        return {
            reply: cleanText(reply),
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
                temperature: 0.65,
                num_predict: 1200
            }
        },
        {
            timeout: 90000
        }
    )

    const reply = response.data?.message?.content
    if (!reply) throw new Error('Ollama returned an invalid response')

    return {
        reply: cleanText(reply),
        promptTokens: Number(response.data?.prompt_eval_count) || 0,
        completionTokens: Number(response.data?.eval_count) || 0,
        durationMs: Math.round((Number(response.data?.total_duration) || 0) / 1000000)
    }
}

const splitLesson = (text, maxLength = 3600) => {
    const chunks = []
    let remaining = cleanText(text)

    while (remaining.length > maxLength) {
        let index = remaining.lastIndexOf('\n\n', maxLength)
        if (index < maxLength * 0.5) index = remaining.lastIndexOf('\n', maxLength)
        if (index < maxLength * 0.5) index = remaining.lastIndexOf('. ', maxLength)
        if (index < maxLength * 0.5) index = maxLength

        chunks.push(remaining.slice(0, index).trim())
        remaining = remaining.slice(index).trim()
    }

    if (remaining) chunks.push(remaining)
    return chunks.slice(0, 4)
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

module.exports = {
    name: 'teach',
    aliases: ['teacher', 'learn', 'lesson'],
    category: 'utility',
    premium: true,
    run: async (client, message, args) => {
        const topic = cleanText(args.join(' '))
        const prefix = message.guild?.prefix || client.config.PREFIX

        if (!topic) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${prefix}teach how to make cake\``)
                ]
            })
        }

        if (topic.length > 250) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Keep the lesson topic under **250 characters**.`)
                ]
            })
        }

        const baseUrl = getLocalBaseUrl(client)
        await message.channel.sendTyping().catch(() => null)

        try {
            const model = process.env.LOCAL_CHATBOT_MODEL || process.env.OLLAMA_MODEL || client.config.LOCAL_CHATBOT_MODEL || client.config.OLLAMA_MODEL || await getFirstModel(client, baseUrl)
            if (!model) {
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | No local model found. Start LM Studio, load a model, then try again.`)
                    ]
                })
            }

            const result = await askTeacher({
                client,
                baseUrl,
                model,
                topic,
                username: message.author.username
            })

            await saveUsage(client, message.guild.id, { ...result, model })

            const chunks = splitLesson(result.reply)
            for (let i = 0; i < chunks.length; i += 1) {
                const embed = client.util.embed()
                    .setColor(client.color)
                    .setTitle(i === 0 ? `Teacher Mode: ${topic.slice(0, 180)}` : `Teacher Mode: Continued ${i + 1}/${chunks.length}`)
                    .setDescription(chunks[i])
                    .setFooter({
                        text: `Local model: ${model} | akashsuu teacher`,
                        iconURL: client.user.displayAvatarURL({ dynamic: true })
                    })

                await message.channel.send({ embeds: [embed] })
            }
        } catch (err) {
            client.logger?.log?.(`teach error: ${err.response?.data?.error || err.message}`, 'error')
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
