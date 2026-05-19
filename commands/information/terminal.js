const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

module.exports = {
    name: 'terminal',
    aliases: ['console', 'shell'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        const target = message.mentions.users.first() || message.author
        const fakeUser = target.username.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user'

        const embed = client.util.embed()
            .setColor(client.color)
            .setTitle('akashsuu Terminal')
            .setDescription('```ansi\n\u001b[0;37mbooting terminal ui...\u001b[0m\n```')
            .setFooter({
                text: 'akashsuu',
                iconURL: client.user.displayAvatarURL({ dynamic: true })
            })

        const sent = await message.channel.send({ embeds: [embed] })
        const lines = [
            `C:\\Users\\${fakeUser}> connect akashsuu`,
            '[OK] session created',
            '[OK] loading fake modules',
            '[OK] scanning imaginary files',
            '[WARN] too much style detected',
            '[OK] generating terminal interface',
            '[DONE] simulation complete'
        ]

        let output = ''
        for (const line of lines) {
            await wait(900)
            output += `${line}\n`
            embed.setDescription(`\`\`\`ansi\n\u001b[0;32m${output}\u001b[0m\`\`\``)
            await sent.edit({ embeds: [embed] })
        }

        embed.setDescription(
            '```ansi\n' +
            '\u001b[0;32m> akashsuu terminal ready\u001b[0m\n' +
            `\u001b[0;37m> user: ${fakeUser}\u001b[0m\n` +
            '\u001b[0;37m> mode: harmless simulation\u001b[0m\n' +
            '\u001b[0;32m> status: complete\u001b[0m\n' +
            '```'
        )

        return sent.edit({ embeds: [embed] })
    }
}
