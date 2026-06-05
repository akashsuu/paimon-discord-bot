const axios = require('axios')

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const askSavageBot = async ({ apiKey, model, prompt, username }) => {
    const response = await axios.post(
        GROQ_URL,
        {
            model,
            messages: [
                {
                    role: 'system',
                    content:
                        'You are akashsuu savage chatbot for a Discord server. ' +
                        'Reply with playful savage humor, witty comebacks, and confident energy. ' +
                        'Keep it short, funny, and non-hateful. Do not use slurs, threats, sexual content, private data, or real harassment. ' +
                        'If the user asks for something harmful, turn it into a harmless joke.'
                },
                {
                    role: 'user',
                    content: `${username}: ${prompt}`
                }
            ],
            temperature: 0.95,
            max_tokens: 180,
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
    if (!reply) throw new Error('Groq API returned an invalid response')

    return cleanText(reply).slice(0, 1800)
}

module.exports = {
    name: 'savage',
    aliases: ['savagebot', 'askai', 'ai'],
    category: 'fun',
    premium: true,
    run: async (client, message, args) => {
        const apiKey = process.env.GROQ_API_KEY || client.config.GROQ_API_KEY
        const model = process.env.GROQ_MODEL || client.config.GROQ_MODEL
        let prompt = cleanText(args.join(' '))

        if (!prompt && message.reference?.messageId) {
            const replied = await message.channel.messages.fetch(message.reference.messageId).catch(() => null)
            prompt = cleanText(replied?.content)
        }

        if (!apiKey) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Missing \`GROQ_API_KEY\`. Add it to your \`.env\` file and restart the bot.`)
                ]
            })
        }

        if (!model) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Missing \`GROQ_MODEL\`. Add it to your \`.env\` file and restart the bot.`)
                ]
            })
        }

        if (!prompt) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${message.guild.prefix}savage why am I sleepy?\`\nYou can also reply to a message with \`${message.guild.prefix}savage\`.`)
                ]
            })
        }

        if (prompt.length > 900) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Keep savage prompts under **900 characters**.`)
                ]
            })
        }

        try {
            const reply = await askSavageBot({
                apiKey,
                model,
                prompt,
                username: message.author.username
            })

            const embed = client.util.embed()
                .setColor(client.color)
                .setAuthor({
                    name: 'akashsuu savage chatbot',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })
                .setDescription(reply)
                .setFooter({
                    text: 'akashsuu AI',
                    iconURL: message.author.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | savage chatbot api is **currently down** or the key/model is invalid.`)
                ]
            })
        }
    }
}
