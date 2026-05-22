const getUserFromMention = async (message, mention) => {
    if (!mention) return message.member

    const matches = mention.match(/^<@!?(\d+)>$/)
    if (!matches) return null

    return message.guild.members.fetch(matches[1]).catch(() => null)
}

const buildMeter = (score) => {
    const filled = Math.round(score / 10)
    const empty = 10 - filled
    const susBox = '\u25a0'
    const emptyBox = '\u25a1'

    return `${susBox.repeat(filled)}${emptyBox.repeat(empty)}`
}

const getSusText = (score) => {
    if (score >= 95) return 'S+ Tier Impostor'
    if (score >= 80) return 'A Tier Super Sus'
    if (score >= 60) return 'B Tier Questionable'
    if (score >= 40) return 'C Tier Side Eye'
    return 'D Tier Innocent'
}

module.exports = {
    name: 'susrate',
    aliases: ['sus', 'suspicious'],
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
            .setTitle('Susrate Meter')
            .setDescription(
                `**${member.displayName}**\n` +
                `**${score}%** sus | **${getSusText(score)}**\n\n` +
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
