const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

module.exports = {
    name: 'ddos',
    aliases: ['fakeddos', 'pingstorm'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        const target = message.mentions.users.first() || message.author

        const embed = client.util.embed()
            .setColor(client.color)
            .setTitle('DDoS Simulation')
            .setDescription(`Preparing simulation for ${target}...`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .setFooter({
                text: 'akashsuu',
                iconURL: client.user.displayAvatarURL({ dynamic: true })
            })

        const sent = await message.channel.send({ embeds: [embed] })
        const steps = [
            'Resolving imaginary endpoint...',
            'Spawning fake packets...',
            'Charging potato servers...',
            'Sending 0 harmful requests...',
            'Reversing the simulation...',
            `${target} survived. This was only a harmless prank.`
        ]

        for (const step of steps) {
            await wait(1200)
            embed.setDescription(step)
            await sent.edit({ embeds: [embed] })
        }

        embed
            .setTitle('Simulation Complete')
            .setDescription(
                `**Target:** ${target}\n` +
                `**Packets sent:** \`0\`\n` +
                `**Damage:** \`None\`\n` +
                `**Result:** Harmless akashsuu prank complete.`
            )

        return sent.edit({ embeds: [embed] })
    }
}
