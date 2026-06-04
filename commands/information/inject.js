const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const payloads = [
    'paimon_snack.exe',
    'akashsuu_aura.dll',
    'genshin_wish_booster.sys',
    'totally_safe_payload.zip',
    'emergency_food_patch.bin'
]

module.exports = {
    name: 'inject',
    aliases: ['virusinject', 'fakevirus'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        const target = message.mentions.users.first() || message.author
        const payload = payloads[Math.floor(Math.random() * payloads.length)]

        const embed = client.util.embed()
            .setColor(client.color)
            .setTitle('Virus Injection')
            .setDescription(`Preparing harmless simulation for ${target}...`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .setFooter({
                text: 'akashsuu',
                iconURL: client.user.displayAvatarURL({ dynamic: true })
            })

        const sent = await message.channel.send({ embeds: [embed] })
        const steps = [
            `loading payload: ${payload}`,
            'checking imaginary firewall...',
            'bypassing fake antivirus...',
            'injecting 0 harmful files...',
            'installing extra style...',
            'cleaning all traces...',
            `${target} has been pranked successfully.`
        ]

        let output = ''
        for (const step of steps) {
            await wait(1000)
            output += `> ${step}\n`
            embed.setDescription(`\`\`\`ansi\n\u001b[0;32m${output}\u001b[0m\`\`\``)
            await sent.edit({ embeds: [embed] })
        }

        embed
            .setTitle('Injection Complete')
            .setDescription(
                `**Target:** ${target}\n` +
                `**Payload:** \`${payload}\`\n` +
                `**Files changed:** \`0\`\n` +
                `**Damage:** \`None\`\n` +
                `**Result:** Harmless akashsuu prank complete.`
            )

        return sent.edit({ embeds: [embed] })
    }
}
