const { fail, formatDuration, requirePlayer, trackName } = require('../../structures/musicUtil')

module.exports = {
    name: 'queue',
    aliases: ['q'],
    category: 'music',
    cooldown: 3,
    run: async (client, message, args) => {
        const player = requirePlayer(client, message)
        if (!player) return

        const page = Math.max(Number(args[0]) || 1, 1)
        const perPage = 10
        const tracks = player.queue.tracks
        const pages = Math.max(Math.ceil(tracks.length / perPage), 1)
        const start = (Math.min(page, pages) - 1) * perPage
        const current = player.queue.current

        if (!current && !tracks.length) return fail(client, message, 'The queue is empty.')

        const lines = tracks.slice(start, start + perPage).map((track, index) => {
            const number = start + index + 1
            const duration = track.info.isStream ? 'Live' : formatDuration(track.info.duration)
            return `\`${number}.\` ${trackName(track)} \`${duration}\``
        })

        return message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setTitle('Music Queue')
                    .setDescription([
                        current ? `**Now:** ${trackName(current)}` : null,
                        lines.length ? lines.join('\n') : '*No waiting tracks.*'
                    ].filter(Boolean).join('\n\n'))
                    .setFooter({ text: `Page ${Math.min(page, pages)}/${pages} | ${tracks.length} waiting` })
            ]
        })
    }
}
