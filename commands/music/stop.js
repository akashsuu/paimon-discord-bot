const { ok, requirePlayer, sameVoice } = require('../../structures/musicUtil')

module.exports = {
    name: 'stop',
    aliases: ['dc', 'disconnect', 'leave'],
    category: 'music',
    cooldown: 3,
    run: async (client, message) => {
        const player = requirePlayer(client, message)
        if (!player || !sameVoice(client, message, player)) return

        await player.destroy('Stopped by command', true)
        return ok(client, message, 'Stopped the music and left voice.')
    }
}
