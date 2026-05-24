const {
    fail,
    COMPONENTS_V2_FLAG,
    getOrCreatePlayer,
    musicPlayerComponents,
    requireVoice,
    searchTracks,
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
            const shouldStartPlayer = !player.playing && !player.paused

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

            if (shouldStartPlayer) {
                player.setData?.('suppressNextTrackStartMessage', true)
                await waitForVoiceReady(player)
                await player.play()
            }

            if (shouldStartPlayer) {
                const firstTrack = isPlaylist ? response.tracks[0] : (player.queue.current || response.tracks[0])

                return message.channel.send({
                    flags: COMPONENTS_V2_FLAG,
                    components: musicPlayerComponents({
                        track: firstTrack,
                        player,
                        voiceChannelId: voiceChannel.id,
                        requester: message.author,
                        playlistName: isPlaylist ? response.playlist?.name || 'Playlist added' : null,
                        playlistSize: isPlaylist ? response.tracks.length : null
                    })
                })
            }

            const queueTitle = isPlaylist ? response.playlist?.name || 'playlist' : response.tracks[0].info.title
            const queueTrack = response.tracks[0]
            const queueEmbed = client.util.embed()
                .setColor(client.color)
                .setDescription(isPlaylist
                    ? `${client.emoji.tick} | Added **${response.tracks.length}** tracks from **${queueTitle}** to the queue.`
                    : `${client.emoji.tick} | Added **${queueTitle}** to the queue.`)
                .addFields(
                    { name: 'Queue', value: `\`${player.queue.tracks.length} waiting\``, inline: true },
                    { name: 'Requested by', value: `${message.author}`, inline: true }
                )
                .setThumbnail(queueTrack.info.artworkUrl || client.user.displayAvatarURL({ dynamic: true, size: 512 }))

            if (queueTrack.info.uri) queueEmbed.setURL(queueTrack.info.uri)

            return message.channel.send({ embeds: [queueEmbed] })
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
