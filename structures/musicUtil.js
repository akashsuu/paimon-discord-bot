const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')

const URL_REGEX = /^https?:\/\//i
const formatDuration = (ms) => {
    if (!ms || !Number.isFinite(ms)) return 'Live'
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const trackTitle = (track) => track?.info?.title || 'Unknown track'

const trackName = (track) => {
    const title = trackTitle(track)
    const uri = track?.info?.uri
    return uri ? `[${title}](${uri})` : title
}

const requesterName = (track) => {
    const requester = track?.requester
    return requester?.tag || requester?.username || requester?.globalName || 'unknown'
}

const fail = (client, message, description) => {
    return message.channel.send({
        embeds: [
            client.util.embed()
                .setColor(client.color)
                .setDescription(`${client.emoji.cross} | ${description}`)
        ]
    })
}

const ok = (client, message, description) => {
    return message.channel.send({
        embeds: [
            client.util.embed()
                .setColor(client.color)
                .setDescription(`${client.emoji.tick} | ${description}`)
        ]
    })
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForVoiceReady = async (player, timeout = 7000) => {
    const started = Date.now()

    while (Date.now() - started < timeout) {
        if (player.voice?.sessionId && player.voice?.token && player.voice?.endpoint) {
            return true
        }

        await wait(250)
    }

    throw new Error('Voice connection was not ready. Rejoin voice and try again.')
}

const musicControls = (disabled = false) => [
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music_shuffle')
            .setLabel('Shuffle')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('music_previous')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('music_pause')
            .setLabel('Pause')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('music_skip')
            .setLabel('Skip')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('music_queue')
            .setLabel('Queue')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
    ),
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music_playlists')
            .setLabel('Playlists')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('music_browse')
            .setLabel('Browse')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('music_voldown')
            .setLabel('Vol -')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('music_volup')
            .setLabel('Vol +')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('music_settings')
            .setLabel('Settings')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
    ),
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music_stop')
            .setLabel('Stop Player')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    )
]

const requireLavalink = (client, message) => {
    if (!client.lavalink) {
        fail(client, message, client.lavalinkDisabledReason || 'Lavalink is not configured.')
        return null
    }

    if (!client.lavalink.initiated) {
        fail(client, message, 'Lavalink is still starting. Try again in a few seconds.')
        return null
    }

    return client.lavalink
}

const requirePlayer = (client, message) => {
    const lavalink = requireLavalink(client, message)
    if (!lavalink) return null

    const player = lavalink.getPlayer(message.guild.id)
    if (!player) {
        fail(client, message, `Nothing is playing. Use \`${message.guild.prefix}play <song>\` first.`)
        return null
    }

    return player
}

const requireVoice = (client, message) => {
    const voiceChannel = message.member?.voice?.channel
    if (!voiceChannel) {
        fail(client, message, 'Join a voice channel first.')
        return null
    }

    const botMember = message.guild.members.me
    const permissions = voiceChannel.permissionsFor(botMember)
    if (!permissions?.has('Connect') || !permissions?.has('Speak')) {
        fail(client, message, 'I need **Connect** and **Speak** permission in your voice channel.')
        return null
    }

    return voiceChannel
}

const sameVoice = (client, message, player) => {
    const userChannelId = message.member?.voice?.channelId
    if (player?.voiceChannelId && userChannelId && player.voiceChannelId !== userChannelId) {
        fail(client, message, `Join <#${player.voiceChannelId}> to control the music.`)
        return false
    }

    return true
}

const getOrCreatePlayer = async (client, message, voiceChannel) => {
    const lavalink = requireLavalink(client, message)
    if (!lavalink) return null

    const player = lavalink.createPlayer({
        guildId: message.guild.id,
        voiceChannelId: voiceChannel.id,
        textChannelId: message.channel.id,
        selfDeaf: true,
        selfMute: false,
        volume: 80
    })

    if (player.voiceChannelId !== voiceChannel.id) {
        await player.changeVoiceState({ voiceChannelId: voiceChannel.id, selfDeaf: true, selfMute: false })
    }

    if (!player.connected) await player.connect()
    return player
}

const searchTracks = async (player, query, user) => {
    const trimmed = String(query || '').trim()
    if (URL_REGEX.test(trimmed)) return player.search(trimmed, user)

    const sources = [
        process.env.LAVALINK_SEARCH || 'ytmsearch',
        'ytsearch',
        'scsearch'
    ].filter((source, index, array) => source && array.indexOf(source) === index)

    let lastError = null
    for (const source of sources) {
        try {
            const result = await player.search({ query: trimmed, source }, user)
            if (result?.tracks?.length) return result
        } catch (err) {
            lastError = err
        }
    }

    if (lastError) throw lastError
    return { tracks: [] }
}

module.exports = {
    fail,
    formatDuration,
    getOrCreatePlayer,
    musicControls,
    ok,
    requesterName,
    requireLavalink,
    requirePlayer,
    requireVoice,
    sameVoice,
    searchTracks,
    trackName,
    trackTitle,
    waitForVoiceReady
}
