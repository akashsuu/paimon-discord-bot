const { LavalinkManager } = require('lavalink-client')
const { COMPONENTS_V2_FLAG, formatDuration, musicControls, musicPlayerComponents, trackName } = require('../structures/musicUtil')

const truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
const AUTO_LEAVE_MS = 60 * 1000
const DEFAULT_PUBLIC_NODE = {
    id: 'nexcloud',
    host: 'n3.nexcloud.in',
    port: 2026,
    authorization: 'nexcloud',
    secure: false,
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

const isAutoplayEnabled = () => {
    return !['0', 'false', 'off', 'no'].includes(String(process.env.MUSIC_AUTOPLAY || 'true').toLowerCase())
}

const clearLeaveTimer = (player) => {
    const timer = player.getData?.('emptyVoiceTimer')
    if (timer) clearTimeout(timer)
    player.setData?.('emptyVoiceTimer', null)
}

const normalizeTitle = (value) => {
    return String(value || '')
        .toLowerCase()
        .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
        .replace(/\b(official|music|video|audio|lyrics?|lyric|visualizer|mv|hd|4k|remaster(?:ed)?|live|topic|provided to youtube by|slowed|reverb|sped up|nightcore|extended|version|remix|mix|edit|cover|karaoke|instrumental|lofi|bass boosted|8d)\b/g, ' ')
        .replace(/\b(ft|feat|featuring)\.?\s+.+$/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

const TITLE_STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'by', 'from'])

const shuffleArray = (items) => {
    const shuffled = [...items]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1))
        ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
    }
    return shuffled
}

const titleTokens = (value) => {
    return normalizeTitle(value)
        .split(' ')
        .filter((token) => token.length > 1 && !TITLE_STOP_WORDS.has(token))
}

const tokenOverlap = (left, right) => {
    if (!left.length || !right.length) return 0
    const rightSet = new Set(right)
    const shared = left.filter((token) => rightSet.has(token)).length
    return shared / Math.min(left.length, right.length)
}

const isSameSongTitle = (leftTitle, rightTitle) => {
    const left = titleTokens(leftTitle)
    const right = titleTokens(rightTitle)
    if (!left.length || !right.length) return false

    const leftText = left.join(' ')
    const rightText = right.join(' ')
    if (leftText === rightText) return true
    if (leftText.length >= 4 && rightText.includes(leftText)) return true
    if (rightText.length >= 4 && leftText.includes(rightText)) return true

    return tokenOverlap(left, right) >= 0.55
}

const sameArtist = (leftAuthor, rightAuthor) => {
    const left = normalizeTitle(leftAuthor)
    const right = normalizeTitle(rightAuthor)
    if (!left || !right) return false
    return left === right || left.includes(right) || right.includes(left)
}

const recentAutoplayTitles = (player) => player.getData?.('recentAutoplayTitles') || []

const rememberAutoplayTitle = (player, track) => {
    const title = normalizeTitle(track?.info?.title)
    if (!title) return

    const recent = recentAutoplayTitles(player)
    player.setData?.('recentAutoplayTitles', [title, ...recent.filter((item) => item !== title)].slice(0, 25))
}

const rememberSkippedTrack = (player, track) => {
    const uri = track?.info?.uri
    const title = normalizeTitle(track?.info?.title)
    if (!uri && !title) return

    const skipped = player.getData?.('skippedAutoplayUris') || []
    const skippedTitles = player.getData?.('skippedAutoplayTitles') || []
    if (uri) player.setData?.('skippedAutoplayUris', [uri, ...skipped.filter((item) => item !== uri)].slice(0, 20))
    if (title) player.setData?.('skippedAutoplayTitles', [title, ...skippedTitles.filter((item) => item !== title)].slice(0, 20))
}

const getPlayerVoiceChannel = (client, player) => {
    const guild = client.guilds.cache.get(player.guildId)
    return guild?.channels.cache.get(player.voiceChannelId) || null
}

const hasHumanListeners = (client, player) => {
    const channel = getPlayerVoiceChannel(client, player)
    if (!channel) return false
    return channel.members.filter((member) => !member.user.bot).size > 0
}

const scheduleEmptyVoiceLeave = (client, player, reason = 'Voice channel empty') => {
    clearLeaveTimer(player)

    const timer = setTimeout(() => {
        const activePlayer = client.lavalink?.getPlayer(player.guildId)
        if (!activePlayer) return
        if (activePlayer.playing || activePlayer.queue?.tracks?.length) return
        if (hasHumanListeners(client, activePlayer)) return

        activePlayer.destroy(reason, true).catch((err) => {
            client.logger?.log?.(`music empty voice destroy error: ${err.message}`, 'warn')
        })
    }, AUTO_LEAVE_MS)

    player.setData?.('emptyVoiceTimer', timer)
}

const relatedQueries = (track) => {
    const info = track?.info || {}
    const title = String(info.title || '').replace(/\(.*?\)|\[.*?\]|official|video|audio|lyrics|remix|cover|edit/gi, '').trim()
    const author = String(info.author || '').trim()
    return [
        `${author} ${title} radio`,
        `${author} radio`,
        `${author} similar artists`,
        `${title} song radio`,
        `${title} similar songs`,
        'spotify radio hits',
        'spotify daily mix'
    ].map((query) => query.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

const searchRelatedTrack = async (player, seedTrack) => {
    const seedUri = seedTrack?.info?.uri
    const skippedUris = new Set(player.getData?.('skippedAutoplayUris') || [])
    const skippedTitles = player.getData?.('skippedAutoplayTitles') || []
    const recentTitles = recentAutoplayTitles(player)
    const requester = seedTrack?.requester || player.getData?.('autoplayRequester')
    const sources = [
        'spsearch',
        process.env.LAVALINK_SEARCH || 'ytmsearch',
        'ytsearch',
        'scsearch'
    ].filter((source, index, array) => source && array.indexOf(source) === index)
    const candidates = []

    for (const query of shuffleArray(relatedQueries(seedTrack))) {
        for (const source of shuffleArray(sources)) {
            const result = await player.search({ query, source }, requester).catch(() => null)
            for (const candidate of shuffleArray(result?.tracks || []).slice(0, 10)) {
                const title = candidate?.info?.title
                if (!title || candidate?.info?.uri === seedUri || skippedUris.has(candidate?.info?.uri)) continue
                if (isSameSongTitle(seedTrack?.info?.title, title)) continue
                if (sameArtist(seedTrack?.info?.author, candidate?.info?.author) && tokenOverlap(titleTokens(seedTrack?.info?.title), titleTokens(title)) >= 0.35) continue
                if (skippedTitles.some((skippedTitle) => isSameSongTitle(skippedTitle, title))) continue
                if (recentTitles.some((recentTitle) => isSameSongTitle(recentTitle, title))) continue
                candidates.push(candidate)
            }
        }
    }

    return shuffleArray(candidates)[0] || null
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
            onEmptyQueue: {},
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
        clearLeaveTimer(player)
        player.setData?.('autoplaySeedTrack', track)
        if (track?.requester) player.setData?.('autoplayRequester', track.requester)
        rememberAutoplayTitle(player, track)

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
                const current = player.queue.current
                if (!player.queue?.tracks?.length && isAutoplayEnabled() && current) {
                    rememberSkippedTrack(player, current)
                    const nextTrack = await searchRelatedTrack(player, current)
                    if (nextTrack) {
                        player.queue.add(nextTrack)
                        await player.skip()
                        return interaction.reply({ content: 'Skipped autoplay and found another similar song.', ephemeral: true })
                    }
                }

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

    client.on('voiceStateUpdate', async (oldState, newState) => {
        const channelId = oldState.channelId || newState.channelId
        if (!channelId) return

        const player = client.lavalink?.getPlayer(oldState.guild.id || newState.guild.id)
        if (!player || player.voiceChannelId !== channelId) return

        if (hasHumanListeners(client, player)) {
            clearLeaveTimer(player)
            return
        }

        scheduleEmptyVoiceLeave(client, player, 'Voice channel empty for 1 minute')
    })

    client.lavalink.on('queueEnd', async (player) => {
        const seedTrack = player.getData?.('autoplaySeedTrack') || player.queue?.current

        if (isAutoplayEnabled() && seedTrack) {
            try {
                const nextTrack = await searchRelatedTrack(player, seedTrack)
                if (nextTrack) {
                    nextTrack.pluginInfo = {
                        ...(nextTrack.pluginInfo || {}),
                        clientData: {
                            ...(nextTrack.pluginInfo?.clientData || {}),
                            autoplay: true
                        }
                    }
                    player.queue.add(nextTrack)
                    await player.play()
                    return
                }
            } catch (err) {
                client.logger?.log?.(`music autoplay failed: ${err.message}`, 'warn')
            }
        }

        scheduleEmptyVoiceLeave(client, player, 'Queue ended and voice was empty for 1 minute')
    })
}
