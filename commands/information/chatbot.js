const { PermissionsBitField } = require('discord.js')

const getChannel = (message, value) => {
    if (!value) return null
    const id = value.match(/^<#(\d+)>$/)?.[1] || value
    return message.guild.channels.cache.get(id) || null
}

module.exports = {
    name: 'chatbot',
    aliases: ['setchatbot', 'aichannel'],
    category: 'utility',
    premium: true,
    run: async (client, message, args) => {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | You need **Administrator** permission to setup chatbot channel.`)
                ]
            })
        }

        const action = args[0]?.toLowerCase()
        const key = `chatbot_channel_${message.guild.id}`
        const enableActions = ['on', 'enable', 'start', 'set']

        if (!action || action === 'status') {
            const channelId = await client.db.get(key)
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setTitle('Chatbot Channel')
                        .setDescription(channelId ? `Auto chatbot is enabled in <#${channelId}>.\nChannel ID: \`${channelId}\`` : 'Auto chatbot is currently disabled.')
                        .setFooter({
                            text: `${message.guild.prefix}chatbot enable | ${message.guild.prefix}chatbot #channel | ${message.guild.prefix}chatbot off`,
                            iconURL: client.user.displayAvatarURL({ dynamic: true })
                        })
                ]
            })
        }

        if (['off', 'disable', 'reset', 'remove'].includes(action)) {
            await client.db.delete(key)
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.tick} | Chatbot auto reply has been disabled.`)
                ]
            })
        }

        const channel = enableActions.includes(action)
            ? getChannel(message, args[1]) || message.channel
            : getChannel(message, args[0])

        if (!channel || !channel.isTextBased()) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${message.guild.prefix}chatbot enable\` or \`${message.guild.prefix}chatbot #channel\``)
                ]
            })
        }

        await client.db.set(key, channel.id)
        return message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setDescription(`${client.emoji.tick} | Chatbot auto reply enabled in ${channel}.\nchat with akashsuu.`)
            ]
        })
    }
}
