const { fail, ok, requirePlayer, sameVoice } = require('../../structures/musicUtil')

module.exports = {
    name: 'pause',
    aliases: [],
    category: 'music',
    cooldown: 3,
    run: async (client, message) => {
        const player = requirePlayer(client, message)
        if (!player || !sameVoice(client, message, player)) return
        if (player.paused) return fail(client, message, 'Music is already paused.')

        await player.pause()
        return ok(client, message, 'Paused the music.')
    }
}
