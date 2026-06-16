module.exports = {
    name: 'restart',
    aliases: ['reboot', 'resstart'],
    category: 'owner',
    run: async (client, message, args) => {
        if (!client.config.owner.includes(message.author.id)) return

        const confirm = args[0]?.toLowerCase()
        if (confirm !== 'confirm') {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setTitle('Restart Confirmation')
                        .setDescription(
                            `This will restart **${client.user.username}**.\n\n` +
                            `Run \`${message.guild.prefix}restart confirm\` to continue.`
                        )
                        .setFooter({
                            text: 'Owner only',
                            iconURL: message.author.displayAvatarURL({ dynamic: true })
                        })
                ]
            })
        }

        await message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setDescription(`${client.emoji.tick} | Restarting **${client.user.username}**...`)
                    .setFooter({
                        text: 'akashsuu',
                        iconURL: client.user.displayAvatarURL({ dynamic: true })
                    })
            ]
        }).catch(() => null)

        setTimeout(() => {
            process.exit(1)
        }, 1000)
    }
}
