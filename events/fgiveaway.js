const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')

const DEFAULT_EMOJI = '🎉'
const DATA_KEY = (guildId, messageId) => `fgiveaway_${guildId}_${messageId}`
const ACTIVE_KEY = (guildId) => `fgiveaway_active_${guildId}`

const parseEmoji = (value) => {
    const raw = String(value || '').trim()
    return raw || DEFAULT_EMOJI
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
    const winnerText = data.ended
        ? data.finalWinners.map((id) => `<@${id}>`).join(', ') || 'No winners selected.'
        : `${data.winnerCount} winner${data.winnerCount === 1 ? '' : 's'}`

    return client.util.embed()
        .setColor(client.color)
        .setTitle(`${data.emoji || DEFAULT_EMOJI} Giveaway`)
        .setDescription(`**${data.prize}**\n\n${data.ended ? `Ended <t:${Math.floor((data.endedAt || Date.now()) / 1000)}:R>` : `Ends <t:${Math.floor(data.endsAt / 1000)}:R>\nTap the button below to enter.`}`)
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

const endGiveaway = async (client, guild, messageId) => {
    const data = await client.db.get(DATA_KEY(guild.id, messageId))
    if (!data || data.ended) return false

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
    await client.db.set(DATA_KEY(guild.id, messageId), endedData)

    const activeIds = (await client.db.get(ACTIVE_KEY(guild.id))) || []
    await client.db.set(ACTIVE_KEY(guild.id), activeIds.filter((id) => id !== messageId))

    const channel = guild.channels.cache.get(data.channelId) || await guild.channels.fetch(data.channelId).catch(() => null)
    const giveawayMessage = channel ? await channel.messages.fetch(messageId).catch(() => null) : null
    if (giveawayMessage) {
        await giveawayMessage.edit({
            embeds: [buildEmbed(client, endedData)],
            components: [entryButton(data.emoji, endedData.entries.length, true)]
        }).catch(() => null)
    }

    if (channel) {
        await channel.send({
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
        }).catch(() => null)
    }

    return true
}

module.exports = async (client) => {
    client.once('ready', () => {
        setInterval(async () => {
            for (const guild of client.guilds.cache.values()) {
                const activeIds = (await client.db.get(ACTIVE_KEY(guild.id))) || []
                for (const messageId of activeIds) {
                    const data = await client.db.get(DATA_KEY(guild.id, messageId))
                    if (!data || data.ended) {
                        await client.db.set(ACTIVE_KEY(guild.id), activeIds.filter((id) => id !== messageId))
                        continue
                    }

                    if (data.endsAt && Date.now() >= data.endsAt) {
                        await endGiveaway(client, guild, messageId).catch((err) => {
                            client.logger?.log?.(`fgiveaway auto-end error: ${err.message}`, 'error')
                        })
                    }
                }
            }
        }, 30000)
    })

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() || interaction.customId !== 'fgiveaway_enter') return
        if (!interaction.guild || !interaction.message) return

        const key = DATA_KEY(interaction.guild.id, interaction.message.id)
        const data = await client.db.get(key)
        if (!data) {
            return interaction.reply({
                content: 'This giveaway is not active anymore.',
                ephemeral: true
            }).catch(() => null)
        }

        if (data.ended) {
            return interaction.reply({
                content: 'This giveaway already ended.',
                ephemeral: true
            }).catch(() => null)
        }

        if (data.entries.includes(interaction.user.id)) {
            return interaction.reply({
                content: 'You are already enrolled in this giveaway.',
                ephemeral: true
            }).catch(() => null)
        }

        data.entries.push(interaction.user.id)
        await client.db.set(key, data)

        await interaction.update({
            embeds: [buildEmbed(client, data)],
            components: [entryButton(data.emoji, data.entries.length)]
        }).catch(async () => {
            await interaction.reply({
                content: 'You are enrolled in this giveaway.',
                ephemeral: true
            }).catch(() => null)
        })
    })
}
