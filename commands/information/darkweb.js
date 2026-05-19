const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fakeFindings = [
    'one abandoned paimon cookie recipe',
    'three cursed usernames',
    'a suspiciously empty shopping cart',
    'zero real leaks',
    'akashsuu watermark detected'
]

module.exports = {
    name: 'darkweb',
    aliases: ['darkwebscan', 'deepweb'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        const target = message.mentions.users.first() || message.author
        const finding = fakeFindings[Math.floor(Math.random() * fakeFindings.length)]

        const embed = client.util.embed()
            .setColor(client.color)
            .setTitle('Darkweb Scan')
            .setDescription('```ansi\n\u001b[0;37minitializing harmless simulation...\u001b[0m\n```')
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .setFooter({
                text: 'akashsuu',
                iconURL: client.user.displayAvatarURL({ dynamic: true })
            })

        const sent = await message.channel.send({ embeds: [embed] })
        const steps = [
            'opening fake onion gateway...',
            'checking imaginary marketplaces...',
            'searching totally made-up databases...',
            'decrypting snack crumbs...',
            'sanitizing dramatic results...',
            'closing simulation safely...'
        ]

        let output = ''
        for (const step of steps) {
            await wait(1000)
            output += `> ${step}\n`
            embed.setDescription(`\`\`\`ansi\n\u001b[0;35m${output}\u001b[0m\`\`\``)
            await sent.edit({ embeds: [embed] })
        }

        embed
            .setTitle('Darkweb Scan Complete')
            .setDescription(
                `**Target:** ${target}\n` +
                `**Finding:** ${finding}\n` +
                `**Risk:** \`0%\`\n` +
                `**Status:** harmless simulation only`
            )

        return sent.edit({ embeds: [embed] })
    }
}
