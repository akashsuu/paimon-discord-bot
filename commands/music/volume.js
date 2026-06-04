const { fail, ok, requirePlayer, sameVoice } = require('../../structures/musicUtil')

module.exports = {
    name: 'volume',
    aliases: ['vol'],
    category: 'music',
    cooldown: 3,
    run: async (client, message, args) => {
        const player = requirePlayer(client, message)
        if (!player || !sameVoice(client, message, player)) return

        const volume = Number(args[0])
        if (!Number.isFinite(volume) || volume < 1 || volume > 150) {
            return fail(client, message, `Usage: \`${message.guild.prefix}volume <1-150>\``)
        }

        await player.setVolume(volume)
        return ok(client, message, `Volume set to **${volume}%**.`)
    }
}
