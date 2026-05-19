const getUserFromMention = async (message, mention) => {
    if (!mention) return message.member

    const matches = mention.match(/^<@!?(\d+)>$/)
    if (!matches) return null

    return message.guild.members.fetch(matches[1]).catch(() => null)
}

const buildMeter = (score) => {
    const filled = Math.round(score / 10)
    const empty = 10 - filled
    const simpBox = '\u25a0'
    const emptyBox = '\u25a1'

    return `${simpBox.repeat(filled)}${emptyBox.repeat(empty)}`
}

const getSimpText = (score) => {
    if (score >= 95) return 'S+ Tier Devoted'
    if (score >= 80) return 'A Tier Down Bad'
    if (score >= 60) return 'B Tier Soft Spot'
    if (score >= 40) return 'C Tier Admirer'
    return 'D Tier Unbothered'
}

module.exports = {
    name: 'simprate',
    aliases: ['simp', 'simpmeter'],
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
            .setTitle('Simprate Meter')
            .setDescription(
                `**${member.displayName}**\n` +
                `**${score}%** simp | **${getSimpText(score)}**\n\n` +
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
