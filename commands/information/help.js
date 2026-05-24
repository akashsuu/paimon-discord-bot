const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js')

module.exports = {
    name: 'help',
    aliases: ['h'],
    category: 'info',
    cooldown: 5,
    premium: true,
    run: async (client, message) => {
        const prefix = message.guild?.prefix || client.config.PREFIX
        const totalCommands = client.util.countCommandsAndSubcommands(client)
        const menuOption = (option) => ({
            ...option,
            emoji: client.util.componentEmoji(option.emoji)
        })

        const commandGroups = [
            { label: 'AntiNuke', description: 'Security, whitelist, panic and protection', value: 'antinuke', emoji: client.emoji.antinuke },
            { label: 'Moderation', description: 'Ban, mute, purge and server control', value: 'moderation', emoji: client.emoji.mod },
            { label: 'Automod', description: 'Auto filters, anti spam and safe chat', value: 'automod', emoji: client.emoji.automod },
            { label: 'Logger', description: 'Server logs and event tracking', value: 'logger', emoji: client.emoji.logs },
            { label: 'Utility', description: 'Info, AI tools, translate, avatar and stats', value: 'utility', emoji: client.emoji.utillity },
            { label: 'Server Utility', description: 'Leaderboards and server helpers', value: 'serverutility', emoji: client.emoji.serverutillity },
            { label: 'Auto Responder', description: 'Custom automatic replies', value: 'autoresponder', emoji: client.emoji.autoresponder },
            { label: 'Fun', description: 'Games, rates, gifs and chaos', value: 'fun', emoji: client.emoji.fun },
<<<<<<< HEAD
=======
            { label: 'Music', description: 'Lavalink player, queue and voice music', value: 'music', emoji: client.emoji.vc },
>>>>>>> 40fc381 (added many things)
            { label: 'Verification', description: 'Verify users and protect joins', value: 'verification', emoji: client.emoji.verification },
            { label: 'Join To Create', description: 'Temporary voice channel system', value: 'jointocreate', emoji: client.emoji.jtc },
            { label: 'Voice & TTS', description: 'Voice moderation, music, TTS and voice tools', value: 'voice', emoji: client.emoji.vc },
            { label: 'Custom Role', description: 'User custom role setup', value: 'customrole', emoji: client.emoji.customrole },
            { label: 'Welcomer', description: 'Welcome messages, autoroles and tests', value: 'welcomer', emoji: client.emoji.welcome },
            { label: 'Sticky', description: 'Sticky messages and channel notes', value: 'sticky', emoji: client.emoji.sticky },
            { label: 'Ticket', description: 'Ticket panels and support flows', value: 'ticket', emoji: client.emoji.ticket },
            { label: 'Owner Tools', description: 'Owner, premium and developer controls', value: 'owner', emoji: client.emoji.owner || client.emoji.developer || client.emoji.utillity }
        ]

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('helpop')
                .setPlaceholder('akashsuu command deck - choose a category')
                .addOptions(commandGroups.map(menuOption))
        )

        const embed = new EmbedBuilder()
            .setColor(client.color)
            .setAuthor({
                name: 'akashsuu command deck',
                iconURL: client.user.displayAvatarURL({ dynamic: true })
            })
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `**Hello ${message.author.username}, welcome to the akashsuu deck.**\n` +
                `Pick a module from the dropdown below to reveal its commands.\n\n` +
                `\`\`\`\n[ Prefix   ] ${prefix}\n[ Commands ] ${totalCommands}\n[ Server   ] ${message.guild.name}\n\`\`\``
            )
            .addFields(
                {
                    name: '**About Bot**',
                    value:
                        `**Name:** ${client.user.username}\n` +
                        `**Library:** discord.js\n` +
                        `**Prefix:** \`${prefix}\`\n` +
                        `**Commands:** \`${totalCommands}\`\n` +
                        `**Owner:** akashsuu`
                },
                {
                    name: `${client.emoji.link} **Links**`,
                    value: `**[Invite Me](https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot)  |  [Support Server](${client.config.support})**`
                }
            )
            .setFooter({
                text: `Made by akashsuu | Requested by ${message.author.tag}`,
                iconURL: client.user.displayAvatarURL({ dynamic: true })
            })

        await message.channel.send({ embeds: [embed], components: [menu] })
    }
}
