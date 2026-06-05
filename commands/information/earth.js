const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

const NASA_EARTH_URL = 'https://api.nasa.gov/planetary/earth/imagery'
const NASA_GIBS_WMS_URL = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const DEFAULT_DATE = '2024-01-01'
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const buildFallbackBbox = (lat, lon) => {
    const span = 4
    return {
        south: clamp(lat - span, -90, 90),
        north: clamp(lat + span, -90, 90),
        west: clamp(lon - span, -180, 180),
        east: clamp(lon + span, -180, 180)
    }
}

const parseBoundingBox = (boundingbox, lat, lon) => {
    if (!Array.isArray(boundingbox) || boundingbox.length < 4) {
        return buildFallbackBbox(lat, lon)
    }

    const [south, north, west, east] = boundingbox.map(Number)
    if (![south, north, west, east].every(Number.isFinite)) {
        return buildFallbackBbox(lat, lon)
    }

    const minSpan = 1.5
    const latSpan = Math.max(north - south, minSpan)
    const lonSpan = Math.max(east - west, minSpan)
    const centerLat = (south + north) / 2
    const centerLon = (west + east) / 2

    return {
        south: clamp(centerLat - latSpan / 2, -90, 90),
        north: clamp(centerLat + latSpan / 2, -90, 90),
        west: clamp(centerLon - lonSpan / 2, -180, 180),
        east: clamp(centerLon + lonSpan / 2, -180, 180)
    }
}

const geocodePlace = async (place) => {
    const response = await axios.get(NOMINATIM_URL, {
        params: {
            q: place,
            format: 'json',
            limit: 1
        },
        headers: {
            'User-Agent': 'akashsuu-discord-bot/1.0'
        },
        timeout: 12000
    })

    const result = response.data?.[0]
    if (!result?.lat || !result?.lon) return null

    return {
        name: result.display_name || place,
        lat: Number(result.lat),
        lon: Number(result.lon),
        bbox: parseBoundingBox(result.boundingbox, Number(result.lat), Number(result.lon))
    }
}

const fetchEarthImage = async ({ apiKey, lat, lon, date }) => {
    const response = await axios.get(NASA_EARTH_URL, {
        params: {
            lat,
            lon,
            date,
            dim: 0.25,
            api_key: apiKey
        },
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        validateStatus: () => true
    })

    const contentType = String(response.headers['content-type'] || '').toLowerCase()
    const buffer = Buffer.from(response.data)

    if (response.status < 200 || response.status >= 300 || !contentType.startsWith('image/') || !buffer.length) {
        throw new Error(`NASA returned ${response.status || 'no image'}`)
    }

    return buffer
}

const fetchGibsImage = async ({ location, date }) => {
    const bbox = location.bbox || buildFallbackBbox(location.lat, location.lon)
    const response = await axios.get(NASA_GIBS_WMS_URL, {
        params: {
            SERVICE: 'WMS',
            VERSION: '1.3.0',
            REQUEST: 'GetMap',
            FORMAT: 'image/png',
            TRANSPARENT: 'false',
            LAYERS: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
            CRS: 'EPSG:4326',
            STYLES: '',
            WIDTH: 1200,
            HEIGHT: 900,
            TIME: date,
            BBOX: `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
        },
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 12 * 1024 * 1024,
        validateStatus: () => true
    })

    const contentType = String(response.headers['content-type'] || '').toLowerCase()
    const buffer = Buffer.from(response.data)

    if (response.status < 200 || response.status >= 300 || !contentType.startsWith('image/') || !buffer.length) {
        throw new Error(`NASA GIBS returned ${response.status || 'no image'}`)
    }

    return buffer
}

module.exports = {
    name: 'earth',
    aliases: ['satellite', 'earthimage'],
    category: 'utility',
    premium: true,
    run: async (client, message, args) => {
        const prefix = message.guild?.prefix || client.config.PREFIX
        const apiKey = process.env.NASA_API_KEY || client.config.NASA_API_KEY

        if (!apiKey) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Missing \`NASA_API_KEY\`. Add it to your \`.env\` file and restart the bot.`)
                ]
            })
        }

        const dateArgIndex = args.findIndex((arg) => DATE_REGEX.test(arg))
        const date = dateArgIndex >= 0 ? args[dateArgIndex] : DEFAULT_DATE
        const place = cleanText(args.filter((_, index) => index !== dateArgIndex).join(' '))

        if (!place) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${prefix}earth china\` or \`${prefix}satellite tokyo 2020-01-01\``)
                ]
            })
        }

        const loading = await message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setDescription(`${client.emoji.tick} | Searching satellite view for **${place}**...`)
            ]
        })

        try {
            const location = await geocodePlace(place)
            if (!location) {
                throw new Error('Location not found')
            }

            let image
            let source = 'NASA Earth Imagery'

            try {
                image = await fetchEarthImage({
                    apiKey,
                    lat: location.lat,
                    lon: location.lon,
                    date
                })
            } catch (earthErr) {
                client.logger?.log?.(`earth imagery fallback for ${place}: ${earthErr.message}`, 'warn')
                image = await fetchGibsImage({ location, date })
                source = 'NASA GIBS True Color'
            }

            const attachment = new AttachmentBuilder(image, {
                name: 'earth.png'
            })

            return loading.edit({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setTitle('NASA Earth Satellite Image')
                        .setDescription(
                            `**Place:** ${location.name}\n` +
                            `**Coordinates:** \`${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}\`\n` +
                            `**Date:** \`${date}\`\n` +
                            `**Source:** ${source}`
                        )
                        .setImage('attachment://earth.png')
                        .setFooter({
                            text: source,
                            iconURL: client.user.displayAvatarURL({ dynamic: true })
                        })
                ],
                files: [attachment]
            })
        } catch (err) {
            client.logger?.log?.(`earth command error: ${err.message}`, 'warn')
            return loading.edit({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Could not get NASA satellite image for **${place}**. Try another city/place or add a different date like \`${prefix}earth china 2019-01-01\`.`)
                ]
            })
        }
    }
}
