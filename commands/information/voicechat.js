const { PermissionsBitField } = require('discord.js')
const { getVoiceConnection } = require('@discordjs/voice')

const getChannel = (message, value) => {
    if (!value) return null
    const id = value.match(/^<#(\d+)>$/)?.[1] || value
    return message.guild.channels.cache.get(id) || null
}

module.exports = {
    name: 'voicechat',
    aliases: ['voicebot', 'vchat', 'vcchat'],
    category: 'utility',
    premium: true,
    run: async (client, message, args) => {
        const action = args[0]?.toLowerCase()
        const key = `voice_chatbot_channel_${message.guild.id}`
        const enableActions = ['on', 'enable', 'start', 'set']
        const disableActions = ['off', 'disable', 'stop', 'reset', 'remove']

        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | You need **Administrator** permission to setup voice chatbot.`)
                ]
            })
        }

        if (!action || action === 'status') {
            const channelId = await client.db.get(key)
            const connection = getVoiceConnection(message.guild.id)
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setTitle('Voice Chatbot')
                        .setDescription(channelId
                            ? `Voice chatbot is enabled in <#${channelId}>.\nVoice: ${connection ? '`connected`' : '`joins your voice channel when you chat`'}`
                            : `Voice chatbot is disabled.\nUse \`${message.guild.prefix}voicechat enable\` in the text channel you want.`)
                ]
            })
        }

        if (disableActions.includes(action)) {
            await client.db.delete(key)
            const connection = getVoiceConnection(message.guild.id)
            connection?.destroy()
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.tick} | Voice chatbot disabled and disconnected.`)
                ]
            })
        }

        if (!enableActions.includes(action)) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${message.guild.prefix}voicechat enable\`, \`${message.guild.prefix}voicechat enable #channel\`, or \`${message.guild.prefix}voicechat off\`.`)
                ]
            })
        }

        const channel = getChannel(message, args[1]) || message.channel
        if (!channel?.isTextBased()) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Please provide a valid text channel.`)
                ]
            })
        }

        await client.db.set(key, channel.id)
        return message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setDescription(`${client.emoji.tick} | Voice chatbot enabled in ${channel}.\nJoin a voice channel, then chat in ${channel}. I will answer with your local model and speak it in voice.`)
            ]
        })
    }
}
