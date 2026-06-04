const axios = require('axios')

const animeSessions = new Map()
const mangaSessions = new Map()
const SESSION_TTL = 15 * 60 * 1000

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const sessionKey = (message) => `${message.guild?.id || 'dm'}:${message.author.id}`
const trim = (value, length = 900) => {
    const text = clean(value)
    return text.length > length ? `${text.slice(0, length - 3)}...` : text
}

const getStored = (map, key) => {
    const stored = map.get(key)
    if (!stored) return null
    if (Date.now() - stored.createdAt > SESSION_TTL) {
        map.delete(key)
        return null
    }
    return stored
}

const jikan = async (path, params = {}) => {
    const response = await axios.get(`https://api.jikan.moe/v4${path}`, {
        params,
        timeout: 12000
    })
    return response.data
}

const mangadex = async (path, params = {}) => {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
            value.forEach((item) => query.append(key, item))
        } else if (value !== undefined && value !== null) {
            query.append(key, value)
        }
    }

    const response = await axios.get(`https://api.mangadex.org${path}?${query.toString()}`, {
        timeout: 12000
    })
    return response.data
}

const titleFromManga = (item) => {
    const title = item?.attributes?.title || {}
    return title.en || Object.values(title)[0] || 'Unknown manga'
}

const coverFromManga = (item) => {
    const cover = item?.relationships?.find((rel) => rel.type === 'cover_art')
    const fileName = cover?.attributes?.fileName
    return fileName ? `https://uploads.mangadex.org/covers/${item.id}/${fileName}.256.jpg` : null
}

const sendError = (client, message, text) => message.channel.send({
    embeds: [
        client.util.embed()
            .setColor(client.color)
            .setDescription(`${client.emoji.cross} | ${text}`)
    ]
})

const animeSearch = async (client, message, query) => {
    const data = await jikan('/anime', {
        q: query,
        limit: 5,
        sfw: true,
        order_by: 'score',
        sort: 'desc'
    })

    const results = (data.data || []).slice(0, 5)
    if (!results.length) return sendError(client, message, 'No anime results found.')

    animeSessions.set(sessionKey(message), {
        createdAt: Date.now(),
        results
    })

    const list = results.map((anime, index) => {
        const year = anime.year || anime.aired?.prop?.from?.year || 'unknown'
        const eps = anime.episodes || '?'
        return `\`${index + 1}\` **${anime.title}** - ${anime.type || 'Anime'} | ${eps} ep | ${year} | score ${anime.score || '?'}`
    }).join('\n')

    const embed = client.util.embed()
        .setColor(client.color)
        .setTitle('Anime Search')
        .setDescription(`${list}\n\nUse \`${message.guild.prefix}anime select 1\` to open a result.`)
        .setFooter({ text: 'Metadata only. No download links.' })

    if (results[0]?.images?.jpg?.image_url) embed.setThumbnail(results[0].images.jpg.image_url)
    return message.channel.send({ embeds: [embed] })
}

const animeSelect = async (client, message, index) => {
    const stored = getStored(animeSessions, sessionKey(message))
    if (!stored?.results?.length) return sendError(client, message, 'Search first with an anime name.')

    const anime = stored.results[index - 1]
    if (!anime) return sendError(client, message, 'Invalid anime selection number.')

    const [details, episodes] = await Promise.all([
        jikan(`/anime/${anime.mal_id}/full`).catch(() => ({ data: anime })),
        jikan(`/anime/${anime.mal_id}/episodes`, { page: 1 }).catch(() => ({ data: [] }))
    ])

    const episodeList = (episodes.data || []).slice(0, 10)
    stored.selected = details.data || anime
    stored.episodes = episodeList
    animeSessions.set(sessionKey(message), stored)

    const episodeText = episodeList.length
        ? episodeList.map((episode, idx) => `\`${idx + 1}\` Ep ${episode.mal_id || episode.episode_id || idx + 1}: ${episode.title || 'Untitled'}`).join('\n')
        : 'No episode list found from the API.'

    const selected = stored.selected
    const embed = client.util.embed()
        .setColor(client.color)
        .setTitle(selected.title || anime.title)
        .setURL(selected.url || anime.url)
        .setDescription(trim(selected.synopsis || anime.synopsis || 'No synopsis found.'))
        .addFields(
            { name: 'Info', value: `Type: \`${selected.type || '?'}\`\nEpisodes: \`${selected.episodes || '?'}\`\nStatus: \`${selected.status || '?'}\``, inline: true },
            { name: 'Episode Menu', value: `${episodeText}\n\nUse \`${message.guild.prefix}anime ep 1\`.` }
        )
        .setFooter({ text: 'Metadata only. No download links.' })

    if (selected.images?.jpg?.image_url) embed.setThumbnail(selected.images.jpg.image_url)
    return message.channel.send({ embeds: [embed] })
}

const animeEpisode = async (client, message, index) => {
    const stored = getStored(animeSessions, sessionKey(message))
    if (!stored?.selected) return sendError(client, message, 'Select an anime first.')

    const listed = stored.episodes?.[index - 1]
    if (!listed) return sendError(client, message, 'Invalid episode number from the current menu.')

    const episodeNo = listed.mal_id || listed.episode_id || index
    const detail = await jikan(`/anime/${stored.selected.mal_id}/episodes/${episodeNo}`).catch(() => ({ data: listed }))
    const episode = detail.data || listed

    const embed = client.util.embed()
        .setColor(client.color)
        .setTitle(`${stored.selected.title} - Episode ${episodeNo}`)
        .setDescription(trim(episode.synopsis || 'No episode synopsis found.'))
        .addFields(
            { name: 'Title', value: episode.title || listed.title || 'Untitled', inline: true },
            { name: 'Aired', value: episode.aired ? `<t:${Math.floor(new Date(episode.aired).getTime() / 1000)}:D>` : 'Unknown', inline: true }
        )
        .setFooter({ text: 'Metadata only. No streaming or download links.' })

    return message.channel.send({ embeds: [embed] })
}

const mangaSearch = async (client, message, query) => {
    const data = await mangadex('/manga', {
        title: query,
        limit: 5,
        'includes[]': ['cover_art'],
        'contentRating[]': ['safe', 'suggestive'],
        'availableTranslatedLanguage[]': ['en'],
        'order[relevance]': 'desc'
    })

    const results = (data.data || []).slice(0, 5)
    if (!results.length) return sendError(client, message, 'No manga results found.')

    mangaSessions.set(sessionKey(message), {
        createdAt: Date.now(),
        results
    })

    const list = results.map((manga, index) => {
        const attrs = manga.attributes || {}
        const year = attrs.year || 'unknown'
        const status = attrs.status || 'unknown'
        return `\`${index + 1}\` **${titleFromManga(manga)}** - ${status} | ${year}`
    }).join('\n')

    const embed = client.util.embed()
        .setColor(client.color)
        .setTitle('Manga Search')
        .setDescription(`${list}\n\nUse \`${message.guild.prefix}manga select 1\` to open a result.`)
        .setFooter({ text: 'Chapter metadata only. No download links.' })

    const cover = coverFromManga(results[0])
    if (cover) embed.setThumbnail(cover)
    return message.channel.send({ embeds: [embed] })
}

const mangaSelect = async (client, message, index) => {
    const stored = getStored(mangaSessions, sessionKey(message))
    if (!stored?.results?.length) return sendError(client, message, 'Search first with a manga name.')

    const manga = stored.results[index - 1]
    if (!manga) return sendError(client, message, 'Invalid manga selection number.')

    const feed = await mangadex(`/manga/${manga.id}/feed`, {
        limit: 20,
        'translatedLanguage[]': ['en'],
        'contentRating[]': ['safe', 'suggestive'],
        'order[chapter]': 'asc'
    }).catch(() => ({ data: [] }))

    const chapters = (feed.data || []).slice(0, 20)
    stored.selected = manga
    stored.chapters = chapters
    mangaSessions.set(sessionKey(message), stored)

    const chapterText = chapters.length
        ? chapters.slice(0, 12).map((chapter, idx) => {
            const attrs = chapter.attributes || {}
            return `\`${idx + 1}\` Ch ${attrs.chapter || '?'}: ${attrs.title || 'Untitled'}`
        }).join('\n')
        : 'No English chapter metadata found.'

    const attrs = manga.attributes || {}
    const embed = client.util.embed()
        .setColor(client.color)
        .setTitle(titleFromManga(manga))
        .setDescription(trim(attrs.description?.en || 'No English description found.'))
        .addFields(
            { name: 'Info', value: `Status: \`${attrs.status || '?'}\`\nYear: \`${attrs.year || '?'}\`\nChapters shown: \`${chapters.length}\``, inline: true },
            { name: 'Chapter Menu', value: `${chapterText}\n\nUse \`${message.guild.prefix}manga chapter 1\`.` }
        )
        .setFooter({ text: 'Chapter metadata only. No download links.' })

    const cover = coverFromManga(manga)
    if (cover) embed.setThumbnail(cover)
    return message.channel.send({ embeds: [embed] })
}

const mangaChapter = async (client, message, index) => {
    const stored = getStored(mangaSessions, sessionKey(message))
    if (!stored?.selected) return sendError(client, message, 'Select a manga first.')

    const chapter = stored.chapters?.[index - 1]
    if (!chapter) return sendError(client, message, 'Invalid chapter number from the current menu.')

    const attrs = chapter.attributes || {}
    const embed = client.util.embed()
        .setColor(client.color)
        .setTitle(`${titleFromManga(stored.selected)} - Chapter ${attrs.chapter || index}`)
        .setDescription(attrs.title || 'Untitled chapter')
        .addFields(
            { name: 'Pages', value: String(attrs.pages || '?'), inline: true },
            { name: 'Published', value: attrs.publishAt ? `<t:${Math.floor(new Date(attrs.publishAt).getTime() / 1000)}:D>` : 'Unknown', inline: true }
        )
        .setFooter({ text: 'Metadata only. No page downloads.' })

    return message.channel.send({ embeds: [embed] })
}

module.exports = {
    animeSearch,
    animeSelect,
    animeEpisode,
    mangaSearch,
    mangaSelect,
    mangaChapter
}
