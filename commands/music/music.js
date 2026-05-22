module.exports = {
    name: 'music',
    aliases: ['musichelp'],
    category: 'music',
    cooldown: 3,
    run: async (client, message, args) => {
        const action = args[0]?.toLowerCase()
        if (action && !['help', 'commands', 'cmds'].includes(action)) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${message.guild.prefix}music help\``)
                ]
            })
        }

        const lavalinkStatus = client.lavalink
            ? client.lavalink.initiated
                ? '`ready`'
                : '`starting`'
            : '`not configured`'

        const commands = [
            `\`${message.guild.prefix}play <song/url>\` - Play a song or playlist`,
            `\`${message.guild.prefix}skip\` - Skip the current song`,
            `\`${message.guild.prefix}stop\` - Stop music and leave voice`,
            `\`${message.guild.prefix}pause\` - Pause the player`,
            `\`${message.guild.prefix}resume\` - Resume the player`,
            `\`${message.guild.prefix}queue [page]\` - Show the queue`,
            `\`${message.guild.prefix}nowplaying\` - Show current song`,
            `\`${message.guild.prefix}volume <1-150>\` - Change volume`
        ]

        return message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setTitle('Music Help')
                    .setDescription('Join a voice channel, then use the commands below.')
                    .addFields(
                        {
                            name: 'Commands',
                            value: commands.join('\n')
                        },
                        {
                            name: 'Examples',
                            value:
                                `\`${message.guild.prefix}play faded alan walker\`\n` +
                                `\`${message.guild.prefix}play https://youtu.be/...\`\n` +
                                `\`${message.guild.prefix}volume 80\``
                        },
                        {
                            name: 'Lavalink',
                            value: `Status: ${lavalinkStatus}`,
                            inline: true
                        }
                    )
                    .setFooter({
                        text: 'akashsuu music',
                        iconURL: client.user.displayAvatarURL({ dynamic: true })
                    })
            ]
        })
    }
}
