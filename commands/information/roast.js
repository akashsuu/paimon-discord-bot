const axios = require('axios')

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const generateRoast = async ({ apiKey, model, targetName, context, authorName }) => {
    const response = await axios.post(
        GROQ_URL,
        {
            model,
            messages: [
                {
                    role: 'system',
                    content:
                        'You write playful Discord roasts. Keep it funny, savage, short, and non-hateful. ' +
                        'Do not use slurs, threats, sexual content, private data, real harassment, or attacks on protected traits. ' +
                        'Make it feel like friendly banter, not abuse. One or two punchy lines only.'
                },
                {
                    role: 'user',
                    content:
                        `Roast target: ${targetName}\n` +
                        `Requested by: ${authorName}\n` +
                        `Extra context: ${context || 'none'}`
                }
            ],
            temperature: 1,
            max_tokens: 120,
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

    const roast = response.data?.choices?.[0]?.message?.content
    if (!roast) throw new Error('Groq roast returned an invalid response')

    return cleanText(roast).slice(0, 1000)
}

module.exports = {
    name: 'roast',
    aliases: ['burn'],
    category: 'fun',
    premium: true,
    run: async (client, message, args) => {
        const apiKey = process.env.GROQ_API_KEY || client.config.GROQ_API_KEY
        const model = process.env.GROQ_MODEL || client.config.GROQ_MODEL || DEFAULT_MODEL
        const target = message.mentions.users.first() || message.author
        const context = cleanText(args.filter((arg) => !/^<@!?(\d+)>$/.test(arg)).join(' '))

        if (!apiKey) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Missing \`GROQ_API_KEY\`. Add it to your \`.env\` file and restart the bot.`)
                ]
            })
        }

        if (context.length > 600) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Keep roast context under **600 characters**.`)
                ]
            })
        }

        try {
            const roast = await generateRoast({
                apiKey,
                model,
                targetName: target.username,
                context,
                authorName: message.author.username
            })

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle(target.id === message.author.id ? 'Roast' : `Roast for ${target.username}`)
                .setDescription(roast)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setFooter({
                    text: `akashsuu roast | ${model}`,
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            client.logger?.log?.(`roast groq error: ${err.response?.data?.error?.message || err.message}`, 'error')
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | roast ai is **currently down** or the Groq key/model is invalid.`)
                ]
            })
        }
    }
}
