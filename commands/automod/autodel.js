const getMember = async (message, input) => {
    if (!input) return null
    const mention = input.match(/^<@!?(\d+)>$/)
    const id = mention?.[1] || input
    return message.guild.members.fetch(id).catch(() => null)
}

const getList = async (client, guildId) => {
    return (await client.db.get(`autodel_${guildId}`)) || []
}

module.exports = {
    name: 'autodel',
    aliases: ['autodeleteuser', 'deleteuser'],
    cooldown: 5,
    category: 'automod',
    subcommand: ['add <user>', 'remove <user>', 'list', 'clear'],
    premium: false,
    run: async (client, message, args) => {
        const embed = client.util.embed().setColor(client.color)
        const prefix = message.guild.prefix || client.config.PREFIX
        const option = args[0]?.toLowerCase()

        if (!message.member.permissions.has('Administrator')) {
            return message.channel.send({
                embeds: [
                    embed.setDescription(`${client.emoji.cross} | You must have \`Administrator\` permissions to use this command.`)
                ]
            })
        }

        if (!message.guild.members.me.permissions.has('ManageMessages')) {
            return message.channel.send({
                embeds: [
                    embed.setDescription(`${client.emoji.cross} | I need \`Manage Messages\` permission to auto-delete user messages.`)
                ]
            })
        }

        if (!option) {
            return message.channel.send({
                embeds: [
                    embed
                        .setTitle('Auto Delete User')
                        .setDescription('Automatically delete messages from selected users.')
                        .addFields(
                            {
                                name: 'Add',
                                value: `\`${prefix}autodel add @user\` or \`${prefix}autodel @user\``
                            },
                            {
                                name: 'Remove',
                                value: `\`${prefix}autodel remove @user\``
                            },
                            {
                                name: 'List / Clear',
                                value: `\`${prefix}autodel list\`\n\`${prefix}autodel clear\``
                            }
                        )
                ]
            })
        }

        if (option === 'list') {
            const list = await getList(client, message.guild.id)
            return message.channel.send({
                embeds: [
                    embed
                        .setTitle('Auto Delete Users')
                        .setDescription(list.length ? list.map((id, index) => `\`${index + 1}.\` <@${id}>`).join('\n') : 'No users are currently in auto-delete.')
                ]
            })
        }

        if (option === 'clear') {
            await client.db.set(`autodel_${message.guild.id}`, [])
            return message.channel.send({
                embeds: [
                    embed.setDescription(`${client.emoji.tick} | Cleared all auto-delete users.`)
                ]
            })
        }

        const action = ['add', 'remove'].includes(option) ? option : 'add'
        const memberArg = action === option ? args[1] : args[0]
        const member = await getMember(message, memberArg)

        if (!member) {
            return message.channel.send({
                embeds: [
                    embed.setDescription(`${client.emoji.cross} | Mention a valid user. Example: \`${prefix}autodel @user\``)
                ]
            })
        }

        if (member.id === client.user.id) {
            return message.channel.send({
                embeds: [
                    embed.setDescription(`${client.emoji.cross} | I cannot auto-delete myself.`)
                ]
            })
        }

        const list = await getList(client, message.guild.id)

        if (action === 'remove') {
            const updated = list.filter((id) => id !== member.id)
            await client.db.set(`autodel_${message.guild.id}`, updated)
            return message.channel.send({
                embeds: [
                    embed.setDescription(`${client.emoji.tick} | Removed ${member} from auto-delete.`)
                ]
            })
        }

        if (!list.includes(member.id)) list.push(member.id)
        await client.db.set(`autodel_${message.guild.id}`, list)

        return message.channel.send({
            embeds: [
                embed.setDescription(`${client.emoji.tick} | I will now automatically delete messages from ${member}.`)
            ]
        })
    }
}
