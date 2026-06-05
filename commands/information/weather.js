const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

const WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather'
const NASA_GIBS_WMS_URL = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi'

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const latestDate = () => {
    const date = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return date.toISOString().slice(0, 10)
}

const buildBbox = (lat, lon) => {
    const span = 3
    return {
        south: clamp(lat - span, -90, 90),
        north: clamp(lat + span, -90, 90),
        west: clamp(lon - span, -180, 180),
        east: clamp(lon + span, -180, 180)
    }
}

const cToF = (value) => (value * 9 / 5) + 32
const formatTemp = (value) => `${Math.round(value)}C / ${Math.round(cToF(value))}F`
const formatWind = (value) => `${Number(value || 0).toFixed(1)} m/s`
const titleCase = (value) => cleanText(value).replace(/\b\w/g, (char) => char.toUpperCase())

const fetchWeather = async ({ apiKey, place }) => {
    const response = await axios.get(WEATHER_URL, {
        params: {
            q: place,
            appid: apiKey,
            units: 'metric'
        },
        timeout: 15000,
        validateStatus: (status) => status >= 200 && status < 500
    })

    if (response.status !== 200) {
        throw new Error(response.data?.message || `Weather API returned ${response.status}`)
    }

    return response.data
}

const fetchNasaImage = async ({ lat, lon, date }) => {
    const bbox = buildBbox(lat, lon)
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
    name: 'weather',
    aliases: ['w', 'forecast'],
    category: 'utility',
    premium: true,
    run: async (client, message, args) => {
        const prefix = message.guild?.prefix || client.config.PREFIX
        const place = cleanText(args.join(' '))
        const apiKey = process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY || client.config.WEATHER_API_KEY || client.config.OPENWEATHER_API_KEY

        if (!place) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${prefix}weather india\` or \`${prefix}weather new york\``)
                ]
            })
        }

        if (!apiKey) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Missing \`WEATHER_API_KEY\`. Add it to your \`.env\` file and restart the bot.`)
                ]
            })
        }

        const loading = await message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setDescription(`${client.emoji.tick} | Checking weather and NASA earth view for **${place}**...`)
            ]
        })

        try {
            const weather = await fetchWeather({ apiKey, place })
            const lat = Number(weather.coord?.lat)
            const lon = Number(weather.coord?.lon)
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                throw new Error('Weather API did not return coordinates')
            }

            const date = latestDate()
            const image = await fetchNasaImage({ lat, lon, date })
            const attachment = new AttachmentBuilder(image, {
                name: 'weather-earth.png'
            })

            const condition = weather.weather?.[0]
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle(`Weather - ${weather.name || place}`)
                .setDescription(
                    `**Condition:** ${titleCase(condition?.description || 'Unknown')}\n` +
                    `**Temperature:** \`${formatTemp(weather.main?.temp || 0)}\`\n` +
                    `**Feels Like:** \`${formatTemp(weather.main?.feels_like || weather.main?.temp || 0)}\`\n` +
                    `**Humidity:** \`${weather.main?.humidity ?? 'Unknown'}%\`\n` +
                    `**Wind:** \`${formatWind(weather.wind?.speed)}\`\n` +
                    `**Clouds:** \`${weather.clouds?.all ?? 'Unknown'}%\`\n` +
                    `**Coordinates:** \`${lat.toFixed(4)}, ${lon.toFixed(4)}\`\n` +
                    `**NASA View Date:** \`${date}\``
                )
                .setImage('attachment://weather-earth.png')
                .setFooter({
                    text: 'Weather API | NASA GIBS earth view',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            if (condition?.icon) {
                embed.setThumbnail(`https://openweathermap.org/img/wn/${condition.icon}@2x.png`)
            }

            return loading.edit({ embeds: [embed], files: [attachment] })
        } catch (err) {
            client.logger?.log?.(`weather command error: ${err.message}`, 'warn')
            return loading.edit({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Could not get weather for **${place}**. Check the place name or your \`WEATHER_API_KEY\`.`)
                ]
            })
        }
    }
}
