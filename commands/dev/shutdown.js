module.exports = {
    name: 'shutdown',
    aliases: ['poweroff', 'stopbot'],
    category: 'owner',
    run: async (client, message, args) => {
        if (!client.config.owner.includes(message.author.id)) return

        const confirm = args[0]?.toLowerCase()
        if (confirm !== 'confirm') {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setTitle('Shutdown Confirmation')
                        .setDescription(
                            `This will turn off **${client.user.username}**.\n\n` +
                            `Run \`${message.guild.prefix}shutdown confirm\` to continue.`
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
                    .setDescription(`${client.emoji.tick} | Shutting down **${client.user.username}**...`)
                    .setFooter({
                        text: 'akashsuu',
                        iconURL: client.user.displayAvatarURL({ dynamic: true })
                    })
            ]
        }).catch(() => null)

        setTimeout(() => {
            process.exit(0)
        }, 1000)
    }
}
