const { LavalinkManager } = require('lavalink-client')
const { COMPONENTS_V2_FLAG, formatDuration, musicControls, musicPlayerComponents, trackName } = require('../structures/musicUtil')

const truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
const DEFAULT_PUBLIC_NODE = {
    id: 'serenetia',
    host: 'lavalinkv4.serenetia.com',
    port: 443,
    authorization: 'https://seretia.link/discord',
    secure: true,
    requestSignalTimeoutMS: 30000
}

const resolveNode = (client) => {
    const rawHost = process.env.LAVALINK_HOST || client.config.LAVALINK_HOST
    const password = process.env.LAVALINK_PASSWORD || client.config.LAVALINK_PASSWORD

    if (!rawHost && !password) {
        return {
            ...DEFAULT_PUBLIC_NODE,
            retryAmount: 5,
            retryDelay: 10000
        }
    }

    if (!rawHost || !password) return null

    const [host, portFromHost] = String(rawHost).replace(/^wss?:\/\//i, '').split(':')

    return {
        id: process.env.LAVALINK_ID || client.config.LAVALINK_ID || 'akashsuu-main',
        host,
        port: Number(process.env.LAVALINK_PORT || client.config.LAVALINK_PORT || portFromHost || 2333),
        authorization: password,
        secure: truthy(process.env.LAVALINK_SECURE || client.config.LAVALINK_SECURE),
        requestSignalTimeoutMS: Number(process.env.LAVALINK_TIMEOUT || client.config.LAVALINK_TIMEOUT || 30000),
        retryAmount: 5,
        retryDelay: 10000
    }
}

module.exports = async (client) => {
    const node = resolveNode(client)

    if (!node) {
        client.lavalinkDisabledReason = 'Lavalink is not configured correctly. Add LAVALINK_HOST, LAVALINK_PORT and LAVALINK_PASSWORD to your .env/server variables.'
        client.logger?.log?.(client.lavalinkDisabledReason, 'warn')
        return
    }

    client.lavalinkNodeOptions = node
    client.lavalink = new LavalinkManager({
        nodes: [node],
        sendToShard: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId)
            if (guild?.shard) return guild.shard.send(payload)

            const shard = client.ws.shards.get(guild?.shardId ?? 0)
            if (shard) shard.send(payload)
        },
        autoSkip: true,
        client: {
            id: client.user?.id || process.env.CLIENT_ID || client.config.CLIENT_ID || '0',
            username: client.user?.username || client.config.BOT_NAME || 'akashsuu'
        },
        playerOptions: {
            defaultSearchPlatform: process.env.LAVALINK_SEARCH || 'ytmsearch',
            onDisconnect: {
                autoReconnect: true,
                destroyPlayer: false
            },
            onEmptyQueue: {
                destroyAfterMs: 30000
            },
            volumeDecrementer: 0.75,
            useUnresolvedData: true
        },
        queueOptions: {
            maxPreviousTracks: 10
        }
    })

    client.on('raw', (packet) => {
        client.lavalink?.sendRawData(packet).catch((err) => {
            client.logger?.log?.(`Lavalink raw voice update error: ${err.stack || err.message}`, 'error')
        })
    })

    client.once('ready', async () => {
        try {
            client.lavalink.options.client.id = client.user.id
            client.lavalink.options.client.username = client.user.username

            await client.lavalink.init({
                id: client.user.id,
                username: client.user.username
            })
            client.logger?.log?.(`Lavalink node ${node.id} connecting at ${node.host}:${node.port}`, 'ready')
        } catch (err) {
            client.lavalinkDisabledReason = `Lavalink startup failed: ${err.message}`
            client.logger?.log?.(client.lavalinkDisabledReason, 'error')
        }
    })

    client.lavalink.nodeManager.on('connect', (connectedNode) => {
        client.logger?.log?.(`Lavalink node connected: ${connectedNode.id}`, 'ready')
    })

    client.lavalink.nodeManager.on('error', (errorNode, error) => {
        client.logger?.log?.(`Lavalink node error (${errorNode.id}): ${error.message}`, 'error')
    })

    client.lavalink.nodeManager.on('disconnect', (disconnectedNode, reason) => {
        client.logger?.log?.(`Lavalink node disconnected (${disconnectedNode.id}): ${reason}`, 'warn')
    })

    client.lavalink.on('debug', (name, data) => {
        const state = data?.state || 'debug'
        const message = data?.message || data?.consoleMessage
        if (state === 'error' || state === 'warn') {
            client.logger?.log?.(`Lavalink ${state} ${name}: ${message || 'No details'}`, state)
        }
    })

    client.lavalink.on('trackStart', (player, track) => {
        if (player.getData?.('suppressNextTrackStartMessage')) {
            player.setData?.('suppressNextTrackStartMessage', undefined)
            return
        }

        const channel = client.channels.cache.get(player.textChannelId)
        if (!channel) return

        channel.send({
            flags: COMPONENTS_V2_FLAG,
            components: musicPlayerComponents({
                track,
                player,
                voiceChannelId: player.voiceChannelId,
                requester: track.requester || 'Now playing'
            })
        }).catch(() => null)
    })

    client.on('interactionCreate', async (interaction) => {
        if (
            !(interaction.isButton() || interaction.isStringSelectMenu()) ||
            !interaction.customId.startsWith('music_')
        ) return
        if (!interaction.guild) return

        const player = client.lavalink?.getPlayer(interaction.guild.id)
        if (!player) {
            return interaction.reply({
                content: 'Nothing is playing right now.',
                ephemeral: true
            }).catch(() => null)
        }

        const memberChannelId = interaction.member?.voice?.channelId
        if (player.voiceChannelId && !memberChannelId) {
            return interaction.reply({
                content: `Join <#${player.voiceChannelId}> to control the music.`,
                ephemeral: true
            }).catch(() => null)
        }

        if (player.voiceChannelId && memberChannelId !== player.voiceChannelId) {
            return interaction.reply({
                content: `Join <#${player.voiceChannelId}> to control the music.`,
                ephemeral: true
            }).catch(() => null)
        }

        try {
            const selected = interaction.isStringSelectMenu() ? interaction.values?.[0] : null
            const action = selected ? `music_${selected}` : interaction.customId

            if (action === 'music_pause') {
                if (player.paused) {
                    await player.resume()
                    return interaction.reply({ content: 'Resumed the music.', ephemeral: true })
                }
                await player.pause()
                return interaction.reply({ content: 'Paused the music.', ephemeral: true })
            }

            if (action === 'music_shuffle') {
                const shuffled = await player.queue.shuffle().catch(() => 0)
                return interaction.reply({
                    content: shuffled ? `Shuffled ${shuffled} queued tracks.` : 'Queue is empty.',
                    ephemeral: true
                })
            }

            if (action === 'music_previous') {
                const previous = await player.queue.shiftPrevious().catch(() => null)
                if (!previous) {
                    return interaction.reply({ content: 'No previous track found.', ephemeral: true })
                }
                await player.play({ clientTrack: previous })
                return interaction.reply({ content: 'Playing previous track.', ephemeral: true })
            }

            if (action === 'music_skip') {
                await player.skip()
                return interaction.reply({ content: 'Skipped.', ephemeral: true })
            }

            if (action === 'music_stop') {
                const stoppedBy = interaction.user
                await player.destroy('Stopped by music button', true)
                await interaction.update({ components: musicControls(true) }).catch(() => null)
                return interaction.followUp({ content: `Stopped by ${stoppedBy}.`, ephemeral: false }).catch(() => null)
            }

            if (action === 'music_queue' || action === 'music_playlists') {
                const current = player.queue.current
                const upcoming = player.queue.tracks.slice(0, 8)
                return interaction.reply({
                    ephemeral: true,
                    embeds: [
                        client.util.embed()
                            .setColor(client.color)
                            .setTitle('Music Queue')
                            .setDescription([
                                current ? `**Now:** ${trackName(current)}` : null,
                                upcoming.length
                                    ? upcoming.map((track, index) => `\`${index + 1}.\` ${trackName(track)}`).join('\n')
                                    : '*No waiting tracks.*'
                            ].filter(Boolean).join('\n\n'))
                    ]
                })
            }

            if (action === 'music_browse') {
                return interaction.reply({
                    content: `Use \`${client.config.PREFIX || '!'}play <song name or link>\` to browse by searching.`,
                    ephemeral: true
                })
            }

            if (action === 'music_settings') {
                return interaction.reply({
                    content: `Volume: ${player.volume}% | Queue: ${player.queue.tracks.length} waiting | Status: ${player.paused ? 'paused' : 'playing'}`,
                    ephemeral: true
                })
            }

            if (action === 'music_voldown' || action === 'music_volup') {
                const nextVolume = action === 'music_volup'
                    ? Math.min(player.volume + 10, 150)
                    : Math.max(player.volume - 10, 1)
                await player.setVolume(nextVolume)

                const current = player.queue.current
                if (current && interaction.message?.flags?.has?.(COMPONENTS_V2_FLAG)) {
                    return interaction.update({
                        flags: COMPONENTS_V2_FLAG,
                        components: musicPlayerComponents({
                            track: current,
                            player,
                            voiceChannelId: player.voiceChannelId,
                            requester: current.requester || interaction.user
                        })
                    })
                }

                return interaction.update({
                    embeds: interaction.message.embeds,
                    components: musicControls()
                }).catch(() => interaction.reply({
                    content: `Volume set to ${nextVolume}%.`,
                    ephemeral: true
                }))
            }
        } catch (err) {
            client.logger?.log?.(`music button error: ${err.stack || err.message}`, 'error')
            return interaction.reply({
                content: `Music control failed: ${String(err.message || err).slice(0, 160)}`,
                ephemeral: true
            }).catch(() => null)
        }
    })

    client.lavalink.on('queueEnd', (player) => {
        setTimeout(() => {
            if (!player.playing && !player.queue?.tracks?.length) {
                player.destroy('Queue ended', true).catch((err) => {
                    client.logger?.log?.(`music queue destroy error: ${err.message}`, 'warn')
                })
            }
        }, 30000)
    })
}
