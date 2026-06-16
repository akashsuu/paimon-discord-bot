const axios = require('axios')

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const getUserProfile = async (client, target, message) => {
    const member = message.guild?.members.cache.get(target.id)

    let status = 'offline/invisible'
    let nickname = null
    let joinedAt = null
    if (member) {
        status = member.presence?.status || 'offline/invisible'
        nickname = member.nickname
        joinedAt = member.joinedAt
    }

    const flags = target.flags?.toArray?.() || []
    const badgeMap = {
        Staff: 'Discord Staff',
        Partner: 'Partner',
        Hypesquad: 'HypeSquad Events',
        BugHunterLevel1: 'Bug Hunter L1',
        HypeSquadOnlineHouse1: 'HypeSquad Bravery',
        HypeSquadOnlineHouse2: 'HypeSquad Brilliance',
        HypeSquadOnlineHouse3: 'HypeSquad Balance',
        PremiumEarlySupporter: 'Early Supporter',
        BugHunterLevel2: 'Bug Hunter L2',
        VerifiedDeveloper: 'Early Verified Bot Dev',
        CertifiedModerator: 'Moderator Programs Alumni',
        ActiveDeveloper: 'Active Developer'
    }
    const badges = flags.map((f) => badgeMap[f] || f).join(', ') || 'none'

    return {
        username: target.username,
        displayName: target.displayName,
        globalName: target.globalName,
        nickname,
        id: target.id,
        createdAt: target.createdAt,
        joinedAt,
        status,
        badges,
        isBot: target.bot,
        discriminator: target.discriminator
    }
}

const buildProfileSummary = (profile) => {
    return [
        `Username: ${profile.username}`,
        `Display name: ${profile.displayName}`,
        `Global name: ${profile.globalName || 'none'}`,
        `Nickname: ${profile.nickname || 'none'}`,
        `User ID: ${profile.id}`,
        `Account created: ${profile.createdAt?.toISOString() || 'unknown'}`,
        `Joined server: ${profile.joinedAt?.toISOString() || 'unknown'}`,
        `Status: ${profile.status}`,
        `Badges: ${profile.badges}`,
        `Bot: ${profile.isBot}`
    ].join('\n')
}

const generateRoastNvidia = async ({ apiKey, target, profileSummary, context, authorName }) => {
    const avatarURL = target.displayAvatarURL({ dynamic: true, size: 512 })

    const userContent =
        `Roast target: ${target.username}\n` +
        `Target profile:\n${profileSummary}\n` +
        `Requested by: ${authorName}\n` +
        `Extra context: ${context || 'none'}\n\n` +
        `Here is their avatar: <img src="${avatarURL}" />\n\n` +
        `Look at this person's avatar and roast them based on everything you see and know about them.`

    const response = await axios.post(
        NVIDIA_URL,
        {
            model: 'moonshotai/kimi-k2.5',
            messages: [
                {
                    role: 'system',
                    content:
                        'You write playful Discord roasts. Keep it funny, savage, short, and non-hateful. ' +
                        'Do not use slurs, threats, sexual content, private data, real harassment, or attacks on protected traits. ' +
                        'Look at the user\'s avatar image AND their profile info (username, status, badges, account age, nickname, etc.) ' +
                        'to craft a personalized creative roast. Roast their avatar, username, status, and anything funny about their profile. ' +
                        'Make it feel like friendly banter, not abuse. One or two punchy lines only.'
                },
                {
                    role: 'user',
                    content: userContent
                }
            ],
            temperature: 1.1,
            max_tokens: 180,
            top_p: 0.95
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        }
    )

    const roast = response.data?.choices?.[0]?.message?.content
    if (!roast) throw new Error('NVIDIA returned an invalid response')

    return cleanText(roast).slice(0, 1000)
}

const generateRoastGroq = async ({ apiKey, model, target, profileSummary, context, authorName }) => {
    const avatarURL = target.displayAvatarURL({ dynamic: true, size: 512 })
    const avatarType = target.avatar
        ? target.avatar.startsWith('a_') ? 'animated avatar' : 'static avatar'
        : 'default avatar'

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
                        'Use the target\'s profile info (username, avatar type, status, badges, account age, nickname, etc.) ' +
                        'to craft a personalized creative roast. Comment on their avatar, username, status, or how old their account is. ' +
                        'Make it feel like friendly banter, not abuse. One or two punchy lines only.'
                },
                {
                    role: 'user',
                    content:
                        `Roast target: ${target.username}\n` +
                        `Target profile:\n${profileSummary}\n` +
                        `Avatar: ${avatarType} (${avatarURL})\n` +
                        `Requested by: ${authorName}\n` +
                        `Extra context: ${context || 'none'}`
                }
            ],
            temperature: 1.1,
            max_tokens: 150,
            top_p: 0.95
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 25000
        }
    )

    const roast = response.data?.choices?.[0]?.message?.content
    if (!roast) throw new Error('Groq returned an invalid response')

    return cleanText(roast).slice(0, 1000)
}

module.exports = {
    name: 'roast',
    aliases: ['burn'],
    category: 'fun',
    premium: true,
    run: async (client, message, args) => {
        const nvidiaKey = process.env.NVIDIA_API_KEY || client.config.NVIDIA_API_KEY
        const groqKey = process.env.GROQ_API_KEY || client.config.GROQ_API_KEY
        const groqModel = process.env.GROQ_MODEL || client.config.GROQ_MODEL
        const target = message.mentions.users.first() || message.author
        const context = cleanText(args.filter((arg) => !/^<@!?(\d+)>$/.test(arg)).join(' '))

        if (context.length > 600) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Keep roast context under **600 characters**.`)
                ]
            })
        }

        const msg = await message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setDescription(`${client.emoji.tick || '🔍'} | Analyzing avatar and generating roast...`)
            ]
        })

        const profile = await getUserProfile(client, target, message)
        const profileSummary = buildProfileSummary(profile)

        if (nvidiaKey) {
            try {
                const roast = await generateRoastNvidia({
                    apiKey: nvidiaKey,
                    target,
                    profileSummary,
                    context,
                    authorName: message.author.username
                })

                const embed = client.util.embed()
                    .setColor(client.color)
                    .setTitle(target.id === message.author.id ? 'Roast yourself' : `Roast for ${target.username}`)
                    .setDescription(roast)
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setFooter({
                        text: 'akashsuu roast • NVIDIA Kimi K2.5 vision',
                        iconURL: client.user.displayAvatarURL({ dynamic: true })
                    })

                return msg.edit({ embeds: [embed], content: null })
            } catch (err) {
                const errMsg = err.response?.data?.error?.message || err.message
                const status = err.response?.status || 'unknown'
                const detail = err.response?.data ? JSON.stringify(err.response.data).slice(0, 500) : 'no body'
                client.logger?.log?.(`roast nvidia error [${status}]: ${errMsg} | ${detail}`, 'error')

                if (!groqKey) {
                    return msg.edit({
                        embeds: [
                            client.util.embed()
                                .setColor(client.color)
                                .setDescription(`${client.emoji.cross} | NVIDIA API error (${status}): \`${errMsg}\``)
                        ]
                    })
                }

                await msg.edit({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.tick || '🔍'} | NVIDIA vision failed (${status}), falling back to Groq...`)
                    ]
                })
            }
        }

        if (groqKey) {
            if (!groqModel) {
                return msg.edit({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | Missing \`GROQ_MODEL\`.`)
                    ]
                })
            }

            try {
                const roast = await generateRoastGroq({
                    apiKey: groqKey,
                    model: groqModel,
                    target,
                    profileSummary,
                    context,
                    authorName: message.author.username
                })

                const embed = client.util.embed()
                    .setColor(client.color)
                    .setTitle(target.id === message.author.id ? 'Roast yourself' : `Roast for ${target.username}`)
                    .setDescription(roast)
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setFooter({
                        text: 'akashsuu roast • Groq AI',
                        iconURL: client.user.displayAvatarURL({ dynamic: true })
                    })

                return msg.edit({ embeds: [embed], content: null })
            } catch (err) {
                const errMsg = err.response?.data?.error?.message || err.message
                client.logger?.log?.(`roast groq error: ${errMsg}`, 'error')
                return msg.edit({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | All roast APIs failed. Last error: \`${errMsg}\``)
                    ]
                })
            }
        }

        return msg.edit({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setDescription(`${client.emoji.cross} | No API keys configured. Add \`NVIDIA_API_KEY\` or \`GROQ_API_KEY\` to your \`.env\`.`)
            ]
        })
    }
}