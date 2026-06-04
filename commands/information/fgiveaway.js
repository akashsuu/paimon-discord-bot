const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} = require('discord.js')

const DEFAULT_EMOJI = '🎉'
const CONFIG_KEY = (guildId) => `fgiveaway_channel_${guildId}`
const DATA_KEY = (guildId, messageId) => `fgiveaway_${guildId}_${messageId}`
const ACTIVE_KEY = (guildId) => `fgiveaway_active_${guildId}`

const getChannel = (message, value) => {
    if (!value) return null
    const id = value.match(/^<#(\d+)>$/)?.[1] || value
    return message.guild.channels.cache.get(id) || null
}

const parseUserIds = (value) => {
    return [...new Set(String(value || '').match(/\d{15,25}/g) || [])]
}

const parseDuration = (value) => {
    const match = String(value || '').trim().match(/^(\d+)(s|m|h|d)$/i)
    if (!match) return null

    const amount = Number(match[1])
    const unit = match[2].toLowerCase()
    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    }
    const duration = amount * multipliers[unit]

    if (!Number.isFinite(duration) || duration < 10000) return null
    return duration
}

const parseEmoji = (value) => {
    const raw = String(value || '').trim()
    if (!raw) return DEFAULT_EMOJI
    const custom = raw.match(/^<a?:\w+:\d{15,25}>$/)
    if (custom) return raw
    return raw.slice(0, 32)
}

const entryButton = (emoji, count, disabled = false) => new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId('fgiveaway_enter')
        .setLabel(`Enter Giveaway (${count})`)
        .setEmoji(parseEmoji(emoji))
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled)
)

const buildEmbed = (client, data) => {
    const endsText = data.ended
        ? `Ended <t:${Math.floor((data.endedAt || Date.now()) / 1000)}:R>`
        : `Ends <t:${Math.floor(data.endsAt / 1000)}:R>\nTap the button below to enter.`
    const winnerText = data.ended
        ? data.finalWinners.map((id) => `<@${id}>`).join(', ') || 'No winners selected.'
        : `${data.winnerCount} winner${data.winnerCount === 1 ? '' : 's'}`

    return client.util.embed()
        .setColor(client.color)
        .setTitle(`${data.emoji || DEFAULT_EMOJI} Giveaway`)
        .setDescription(`**${data.prize}**\n\n${endsText}`)
        .addFields(
            { name: 'Winners', value: winnerText, inline: true },
            { name: 'Entries', value: `\`${data.entries.length}\``, inline: true },
            { name: 'Ends', value: data.ended ? 'Ended' : `<t:${Math.floor(data.endsAt / 1000)}:F>`, inline: true },
            { name: 'Hosted By', value: `<@${data.hostId}>`, inline: true }
        )
        .setFooter({
            text: data.ended ? 'akashsuu giveaway ended' : 'akashsuu giveaway',
            iconURL: client.user.displayAvatarURL({ dynamic: true })
        })
}

const usage = (client, message) => {
    return message.channel.send({
        embeds: [
            client.util.embed()
                .setColor(client.color)
                .setTitle('Giveaway')
                .setDescription(
                    `\`${message.guild.prefix}fgiveaway setchannel #channel\`\n` +
                    `\`${message.guild.prefix}fgiveaway start <duration> <winnerCount> <emoji> <preset winners> | <prize/place>\`\n` +
                    `\`${message.guild.prefix}fgiveaway end <messageId>\`\n\n` +
                    `Duration examples: \`30s\`, \`10m\`, \`2h\`, \`1d\`\n` +
                    `Example:\n\`${message.guild.prefix}fgiveaway start 10m 2 ${DEFAULT_EMOJI} @akashsuu 806113872620421140 | Nitro Giveaway\``
                )
        ]
    })
}

module.exports = {
    name: 'fgiveaway',
    aliases: ['giveaway'],
    category: 'fun',
    cooldown: 5,
    run: async (client, message, args) => {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | You need **Manage Server** permission to manage giveaways.`)
                ]
            })
        }

        const action = args.shift()?.toLowerCase()
        if (!action || ['help', 'usage'].includes(action)) return usage(client, message)

        if (['setchannel', 'channel', 'set'].includes(action)) {
            const channel = getChannel(message, args[0]) || message.channel
            if (!channel?.isTextBased()) {
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | Please provide a valid text channel.`)
                    ]
                })
            }

            await client.db.set(CONFIG_KEY(message.guild.id), channel.id)
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.tick} | Giveaway channel set to ${channel}.`)
                ]
            })
        }

        if (action === 'status') {
            const channelId = await client.db.get(CONFIG_KEY(message.guild.id))
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setTitle('Giveaway Status')
                        .setDescription(channelId ? `Giveaways will be sent in <#${channelId}>.` : 'No giveaway channel is set.')
                ]
            })
        }

        if (action === 'end') {
            const messageId = args[0]
            if (!messageId) return usage(client, message)

            const data = await client.db.get(DATA_KEY(message.guild.id, messageId))
            if (!data) {
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | I could not find that giveaway.`)
                    ]
                })
            }
            if (data.ended) {
                return message.channel.send({
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setDescription(`${client.emoji.cross} | That giveaway is already ended.`)
                    ]
                })
            }

            const finalWinners = [...data.presetWinners]
            const remainingEntries = data.entries.filter((id) => !finalWinners.includes(id))
            while (finalWinners.length < data.winnerCount && remainingEntries.length) {
                const pickedIndex = Math.floor(Math.random() * remainingEntries.length)
                finalWinners.push(remainingEntries.splice(pickedIndex, 1)[0])
            }

            const endedData = {
                ...data,
                ended: true,
                endedAt: Date.now(),
                finalWinners: finalWinners.slice(0, data.winnerCount)
            }
            await client.db.set(DATA_KEY(message.guild.id, messageId), endedData)
            const activeIds = (await client.db.get(ACTIVE_KEY(message.guild.id))) || []
            await client.db.set(ACTIVE_KEY(message.guild.id), activeIds.filter((id) => id !== messageId))

            const channel = message.guild.channels.cache.get(data.channelId) || await message.guild.channels.fetch(data.channelId).catch(() => null)
            const giveawayMessage = channel ? await channel.messages.fetch(messageId).catch(() => null) : null
            if (giveawayMessage) {
                await giveawayMessage.edit({
                    embeds: [buildEmbed(client, endedData)],
                    components: [entryButton(data.emoji, endedData.entries.length, true)]
                }).catch(() => null)
            }

            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setTitle('Giveaway Ended')
                        .setDescription(
                            endedData.finalWinners.length
                                ? `Winner${endedData.finalWinners.length === 1 ? '' : 's'}: ${endedData.finalWinners.map((id) => `<@${id}>`).join(', ')}`
                                : 'No winners could be selected.'
                        )
                ]
            })
        }

        if (action !== 'start') return usage(client, message)

        const joined = args.join(' ')
        const [left, ...prizeParts] = joined.split('|')
        const prize = prizeParts.join('|').trim()
        const leftArgs = left.trim().split(/\s+/).filter(Boolean)
        const durationMs = parseDuration(leftArgs.shift())
        const winnerCount = Math.max(1, Math.min(Number(leftArgs.shift()) || 1, 20))
        const emoji = parseEmoji(leftArgs.shift())
        const presetWinners = parseUserIds(leftArgs.join(' '))

        if (!durationMs || !prize) return usage(client, message)

        const configuredChannelId = await client.db.get(CONFIG_KEY(message.guild.id))
        const channel = configuredChannelId
            ? message.guild.channels.cache.get(configuredChannelId) || await message.guild.channels.fetch(configuredChannelId).catch(() => null)
            : message.channel

        if (!channel?.isTextBased()) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Set a valid giveaway channel first with \`${message.guild.prefix}fgiveaway setchannel #channel\`.`)
                ]
            })
        }

        const data = {
            guildId: message.guild.id,
            channelId: channel.id,
            messageId: null,
            hostId: message.author.id,
            prize,
            emoji,
            winnerCount,
            presetWinners: presetWinners.slice(0, winnerCount),
            entries: [],
            ended: false,
            endedAt: null,
            finalWinners: [],
            createdAt: Date.now(),
            endsAt: Date.now() + durationMs
        }

        const sent = await channel.send({
            embeds: [buildEmbed(client, data)],
            components: [entryButton(emoji, 0)]
        })
        data.messageId = sent.id
        await client.db.set(DATA_KEY(message.guild.id, sent.id), data)
        const activeIds = (await client.db.get(ACTIVE_KEY(message.guild.id))) || []
        if (!activeIds.includes(sent.id)) {
            activeIds.push(sent.id)
            await client.db.set(ACTIVE_KEY(message.guild.id), activeIds)
        }

        return message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setDescription(`${client.emoji.tick} | Giveaway created in ${channel}.\nMessage ID: \`${sent.id}\``)
            ]
        })
    }
}
