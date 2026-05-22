const {
    fail,
    formatDuration,
    getOrCreatePlayer,
    musicControls,
    requireVoice,
    searchTracks,
    trackName,
    waitForVoiceReady
} = require('../../structures/musicUtil')

module.exports = {
    name: 'play',
    aliases: ['p'],
    category: 'music',
    cooldown: 3,
    run: async (client, message, args) => {
        const query = args.join(' ').trim()
        if (!query) {
            return fail(client, message, `Usage: \`${message.guild.prefix}play <song name or url>\``)
        }

        const voiceChannel = requireVoice(client, message)
        if (!voiceChannel) return

        try {
            const player = await getOrCreatePlayer(client, message, voiceChannel)
            if (!player) return

            const response = await searchTracks(player, query, message.author)
            if (!response?.tracks?.length) {
                return fail(client, message, 'No tracks found for that search.')
            }

            const isPlaylist = response.playlist && response.tracks.length > 1
            if (isPlaylist) {
                player.queue.add(response.tracks)
            } else {
                player.queue.add(response.tracks[0])
            }

            if (!player.playing && !player.paused) {
                player.setData?.('suppressNextTrackStartMessage', true)
                await waitForVoiceReady(player)
                await player.play()
            }

            const firstTrack = isPlaylist ? response.tracks[0] : (player.queue.current || response.tracks[0])
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle(isPlaylist ? response.playlist?.name || 'Playlist added' : firstTrack.info.title)
                .setDescription(isPlaylist
                    ? `Queued **${response.tracks.length}** tracks by ${message.author}.`
                    : `**${firstTrack.info.author || 'Unknown artist'}**\n${firstTrack.info.isStream ? 'Live' : formatDuration(firstTrack.info.duration)}`)
                .addFields(
                    { name: 'Queue', value: `\`${player.queue.tracks.length} waiting\``, inline: true },
                    { name: 'Voice', value: `<#${voiceChannel.id}>`, inline: true },
                    { name: 'Volume', value: `\`${player.volume}%\``, inline: true }
                )
                .setThumbnail(firstTrack.info.artworkUrl || client.user.displayAvatarURL({ dynamic: true, size: 512 }))
                .setFooter({
                    text: 'akashsuu music',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })
            if (firstTrack.info.uri) embed.setURL(firstTrack.info.uri)

            return message.channel.send({ embeds: [embed], components: musicControls() })
        } catch (err) {
            client.logger?.log?.(`music play error: ${err.stack || err.message}`, 'error')
            const isTimeout = String(err.message || err).toLowerCase().includes('timeout') || err.name === 'TimeoutError'
            if (isTimeout) {
                return fail(client, message, 'The Lavalink node took too long to search. Try again, use a direct YouTube/SoundCloud link, or use another Lavalink node.')
            }
            return fail(client, message, `Could not play that track: \`${String(err.message || err).slice(0, 180)}\``)
        }
    }
}
