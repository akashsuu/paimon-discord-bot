const getUserFromMention = async (message, mention) => {
    if (!mention) return message.member

    const matches = mention.match(/^<@!?(\d+)>$/)
    if (!matches) return null

    return message.guild.members.fetch(matches[1]).catch(() => null)
}

const buildMeter = (score) => {
    const filled = Math.round(score / 10)
    const empty = 10 - filled
    const toxicBox = '\u25a0'
    const emptyBox = '\u25a1'

    return `${toxicBox.repeat(filled)}${emptyBox.repeat(empty)}`
}

const getToxicText = (score) => {
    if (score >= 95) return 'S+ Tier Hazard'
    if (score >= 80) return 'A Tier Venom'
    if (score >= 60) return 'B Tier Salty'
    if (score >= 40) return 'C Tier Spicy'
    return 'D Tier Peaceful'
}

module.exports = {
    name: 'toxicrate',
    aliases: ['toxic', 'toxicity'],
    category: 'fun',
    premium: true,
    run: async (client, message, args) => {
        const member = await getUserFromMention(message, args[0]) ||
            message.guild.members.cache.get(args[0]) ||
            message.member

        const score = Math.floor(Math.random() * 101)
        const meter = buildMeter(score)

        const embed = client.util.embed()
            .setColor(client.color)
            .setTitle('Toxicrate Meter')
            .setDescription(
                `**${member.displayName}**\n` +
                `**${score}%** toxic | **${getToxicText(score)}**\n\n` +
                `\`[ ${meter} ]\``
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({
                text: 'akashsuu',
                iconURL: client.user.displayAvatarURL({ dynamic: true })
            })

        return message.channel.send({ embeds: [embed] })
    }
}
