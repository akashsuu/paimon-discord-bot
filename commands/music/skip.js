const { fail, ok, requirePlayer, sameVoice, trackName } = require('../../structures/musicUtil')

module.exports = {
    name: 'skip',
    aliases: ['s', 'next'],
    category: 'music',
    cooldown: 3,
    run: async (client, message) => {
        const player = requirePlayer(client, message)
        if (!player || !sameVoice(client, message, player)) return

        const current = player.queue.current
        if (!current && !player.playing) return fail(client, message, 'Nothing is playing right now.')

        if (player.queue?.tracks?.length) {
            await player.skip()
        } else {
            await player.stopPlaying(false, false)
        }

        return ok(client, message, `Skipped ${current ? trackName(current) : 'the current track'}.`)
    }
}
