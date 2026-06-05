const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

const NASA_EARTH_URL = 'https://api.nasa.gov/planetary/earth/imagery'
const NASA_GIBS_WMS_URL = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const IP_API_URL = 'http://ip-api.com/json'
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const COORD_REGEX = /^-?\d+(?:\.\d+)?[,]?$/
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const latestDate = () => {
    const date = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return date.toISOString().slice(0, 10)
}

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

const buildLocation = ({ name, lat, lon, bbox }) => ({
    name,
    lat: Number(lat),
    lon: Number(lon),
    bbox: bbox || buildFallbackBbox(Number(lat), Number(lon))
})

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

    return buildLocation({
        name: result.display_name || place,
        lat: Number(result.lat),
        lon: Number(result.lon),
        bbox: parseBoundingBox(result.boundingbox, Number(result.lat), Number(result.lon))
    })
}

const isPrivateIp = (ip) => {
    const parts = ip.split('.').map(Number)
    return parts[0] === 10 ||
        parts[0] === 127 ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 169 && parts[1] === 254)
}

const geocodeIp = async (ip) => {
    if (!IP_REGEX.test(ip) || isPrivateIp(ip)) {
        throw new Error('Use a public IPv4 address for IP satellite search')
    }

    const response = await axios.get(`${IP_API_URL}/${ip}`, {
        params: {
            fields: 'status,message,country,regionName,city,lat,lon,query'
        },
        timeout: 12000
    })

    if (response.data?.status !== 'success' || !Number.isFinite(Number(response.data?.lat)) || !Number.isFinite(Number(response.data?.lon))) {
        throw new Error(response.data?.message || 'IP location not found')
    }

    const label = [response.data.city, response.data.regionName, response.data.country]
        .filter(Boolean)
        .join(', ')

    return buildLocation({
        name: `${label || response.data.query} (${response.data.query})`,
        lat: response.data.lat,
        lon: response.data.lon
    })
}

const parseCoordinates = (parts) => {
    if (!parts.length) return null
    const joined = parts.join(' ').replace(/\s*,\s*/g, ',').trim()
    const pair = joined.includes(',')
        ? joined.split(',').map((item) => item.trim())
        : parts.slice(0, 2)

    if (pair.length < 2 || !pair.every((part) => COORD_REGEX.test(part))) return null

    const lat = Number(String(pair[0]).replace(',', ''))
    const lon = Number(String(pair[1]).replace(',', ''))
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        throw new Error('Coordinates must be valid latitude and longitude')
    }

    return buildLocation({
        name: `Coordinates ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        lat,
        lon
    })
}

const resolveLocation = async (queryParts) => {
    if (!queryParts.length) {
        return buildLocation({
            name: 'Earth - global latest NASA view',
            lat: 0,
            lon: 0,
            bbox: { south: -80, west: -180, north: 80, east: 180 }
        })
    }

    if (queryParts[0]?.toLowerCase() === 'ip') {
        return geocodeIp(queryParts[1])
    }

    const coords = parseCoordinates(queryParts)
    if (coords) return coords

    return geocodePlace(cleanText(queryParts.join(' ')))
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

        const dateArgIndex = args.findIndex((arg) => DATE_REGEX.test(arg))
        const explicitDate = dateArgIndex >= 0
        const date = explicitDate ? args[dateArgIndex] : latestDate()
        const queryParts = args
            .filter((_, index) => index !== dateArgIndex)
            .filter((arg) => String(arg).toLowerCase() !== 'latest')

        const loading = await message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setDescription(`${client.emoji.tick} | Searching latest NASA satellite view...`)
            ]
        })

        try {
            const location = await resolveLocation(queryParts)
            if (!location) {
                throw new Error('Location not found')
            }

            let image
            let source = 'NASA GIBS True Color'

            if (!explicitDate || !apiKey) {
                image = await fetchGibsImage({ location, date })
            } else {
                try {
                    image = await fetchEarthImage({
                        apiKey,
                        lat: location.lat,
                        lon: location.lon,
                        date
                    })
                    source = 'NASA Earth Imagery'
                } catch (earthErr) {
                    client.logger?.log?.(`earth imagery fallback for ${location.name}: ${earthErr.message}`, 'warn')
                    image = await fetchGibsImage({ location, date })
                }
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
                            `**Date:** \`${date}\`${explicitDate ? '' : ' `latest`'}\n` +
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
                        .setDescription(`${client.emoji.cross} | Could not get NASA satellite image. Try \`${prefix}earth india\`, \`${prefix}earth 28.6139 77.2090\`, or \`${prefix}earth ip 8.8.8.8\`.`)
                ]
            })
        }
    }
}
