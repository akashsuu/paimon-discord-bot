const plusCommand = (content) => {
    const text = content.trim()
    if (!text) return false

    return text.startsWith('+')
}

const onlyMentionsProtected = (message, protectedIds) => {
    const withoutMentions = message.content
        .replace(/<@!?\d+>/g, '')
        .replace(/\s+/g, '')

    return withoutMentions.length === 0 &&
        message.mentions.users.some((user) => protectedIds.includes(user.id))
}

module.exports = async (client) => {
    client.ownerMentionWarnings = client.ownerMentionWarnings || new Map()
    client.ownerMentionDeleteWindows = client.ownerMentionDeleteWindows || new Map()

    client.on('messageCreate', async (message) => {
        if (!message.guild || message.system || !message.content) return

        const protectedIds = [
            ...(client.config.owner || []),
            ...(client.config.akashsuu || []),
            ...(client.config.developer || [])
        ].filter(Boolean)

        if (!protectedIds.length) return
        if (protectedIds.includes(message.author.id)) return

        const mentionsProtected = message.mentions.users.some((user) => protectedIds.includes(user.id))
        const repliedMessage = message.reference?.messageId
            ? await message.channel.messages.fetch(message.reference.messageId).catch(() => null)
            : null
        const repliesToProtected = repliedMessage && protectedIds.includes(repliedMessage.author.id)
        const activeDeleteWindow = (client.ownerMentionDeleteWindows.get(message.channel.id) || 0) > Date.now()

        if (
            message.author.bot &&
            activeDeleteWindow &&
            (mentionsProtected || repliesToProtected || message.content.toLowerCase().includes('akashsuu'))
        ) {
            return message.delete().catch(() => null)
        }

        if (!mentionsProtected && !repliesToProtected) return
        if (mentionsProtected && onlyMentionsProtected(message, protectedIds)) return
        if (!plusCommand(message.content)) return

        await message.delete().catch(() => null)
        client.ownerMentionDeleteWindows.set(message.channel.id, Date.now() + 10000)

        const cooldownKey = `${message.guild.id}:${message.channel.id}:${message.author.id}`
        const lastWarned = client.ownerMentionWarnings.get(cooldownKey) || 0
        if (Date.now() - lastWarned < 5000) return

        client.ownerMentionWarnings.set(cooldownKey, Date.now())
        const warning = await message.channel.send({
            content: `${message.author}, you can't use command using akashsuu.`,
            allowedMentions: { users: [message.author.id] }
        }).catch(() => null)

        if (warning) {
            setTimeout(() => warning.delete().catch(() => null), 6000)
        }
    })
}
