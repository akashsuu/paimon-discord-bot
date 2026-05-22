const { fail, formatDuration, requirePlayer, trackName } = require('../../structures/musicUtil')

module.exports = {
    name: 'nowplaying',
    aliases: ['np', 'current'],
    category: 'music',
    cooldown: 3,
    run: async (client, message) => {
        const player = requirePlayer(client, message)
        if (!player) return

        const track = player.queue.current
        if (!track) return fail(client, message, 'Nothing is playing right now.')

        const duration = track.info.isStream ? 'Live' : formatDuration(track.info.duration)
        const position = track.info.isStream ? 'Live' : formatDuration(player.position)

        return message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setTitle('Now Playing')
                    .setDescription(trackName(track))
                    .addFields(
                        { name: 'Artist', value: `\`${track.info.author || 'Unknown'}\``, inline: true },
                        { name: 'Time', value: `\`${position} / ${duration}\``, inline: true },
                        { name: 'Volume', value: `\`${player.volume}%\``, inline: true }
                    )
                    .setThumbnail(track.info.artworkUrl || client.user.displayAvatarURL({ dynamic: true }))
            ]
        })
    }
}
