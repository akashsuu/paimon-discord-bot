const { fail, ok, requirePlayer, sameVoice } = require('../../structures/musicUtil')

module.exports = {
    name: 'resume',
    aliases: ['unpause'],
    category: 'music',
    cooldown: 3,
    run: async (client, message) => {
        const player = requirePlayer(client, message)
        if (!player || !sameVoice(client, message, player)) return
        if (!player.paused) return fail(client, message, 'Music is not paused.')

        await player.resume()
        return ok(client, message, 'Resumed the music.')
    }
}
