const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

const OPENWEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather'
const WEATHERAPI_URL = 'https://api.weatherapi.com/v1/current.json'
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

const normalizeWeatherApi = (data) => ({
    provider: 'WeatherAPI',
    name: [data.location?.name, data.location?.region, data.location?.country].filter(Boolean).join(', '),
    lat: Number(data.location?.lat),
    lon: Number(data.location?.lon),
    condition: data.current?.condition?.text || 'Unknown',
    icon: data.current?.condition?.icon ? `https:${data.current.condition.icon}` : null,
    temp: Number(data.current?.temp_c),
    feelsLike: Number(data.current?.feelslike_c),
    humidity: data.current?.humidity,
    wind: Number(data.current?.wind_kph) / 3.6,
    clouds: data.current?.cloud,
    localTime: data.location?.localtime
})

const normalizeOpenWeather = (data) => ({
    provider: 'OpenWeather',
    name: data.name,
    lat: Number(data.coord?.lat),
    lon: Number(data.coord?.lon),
    condition: data.weather?.[0]?.description || 'Unknown',
    icon: data.weather?.[0]?.icon ? `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png` : null,
    temp: Number(data.main?.temp),
    feelsLike: Number(data.main?.feels_like),
    humidity: data.main?.humidity,
    wind: Number(data.wind?.speed),
    clouds: data.clouds?.all,
    localTime: null
})

const fetchWeatherApi = async ({ apiKey, place }) => {
    const response = await axios.get(WEATHERAPI_URL, {
        params: {
            key: apiKey,
            q: place,
            aqi: 'no'
        },
        timeout: 15000,
        validateStatus: (status) => status >= 200 && status < 500
    })

    if (response.status !== 200) {
        throw new Error(response.data?.error?.message || `WeatherAPI returned ${response.status}`)
    }

    return normalizeWeatherApi(response.data)
}

const fetchOpenWeather = async ({ apiKey, place }) => {
    const response = await axios.get(OPENWEATHER_URL, {
        params: {
            q: place,
            appid: apiKey,
            units: 'metric'
        },
        timeout: 15000,
        validateStatus: (status) => status >= 200 && status < 500
    })

    if (response.status !== 200) {
        throw new Error(response.data?.message || `OpenWeather returned ${response.status}`)
    }

    return normalizeOpenWeather(response.data)
}

const fetchWeather = async ({ apiKey, place }) => {
    const errors = []

    for (const provider of [fetchWeatherApi, fetchOpenWeather]) {
        try {
            const weather = await provider({ apiKey, place })
            if (Number.isFinite(weather.lat) && Number.isFinite(weather.lon)) return weather
            throw new Error(`${weather.provider} did not return coordinates`)
        } catch (err) {
            errors.push(err.message)
        }
    }

    throw new Error(errors.join(' | '))
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
        const apiKey = process.env.WEATHER_API_KEY || process.env.WEATHERAPI_KEY || process.env.OPENWEATHER_API_KEY || client.config.WEATHER_API_KEY || client.config.WEATHERAPI_KEY || client.config.OPENWEATHER_API_KEY

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
            const lat = Number(weather.lat)
            const lon = Number(weather.lon)
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                throw new Error('Weather API did not return coordinates')
            }

            const date = latestDate()
            const image = await fetchNasaImage({ lat, lon, date }).catch((err) => {
                client.logger?.log?.(`weather NASA image skipped: ${err.message}`, 'warn')
                return null
            })
            const files = image
                ? [new AttachmentBuilder(image, { name: 'weather-earth.png' })]
                : []
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle(`Weather - ${weather.name || place}`)
                .setDescription(
                    `**Condition:** ${titleCase(weather.condition || 'Unknown')}\n` +
                    `**Temperature:** \`${formatTemp(weather.temp || 0)}\`\n` +
                    `**Feels Like:** \`${formatTemp(weather.feelsLike || weather.temp || 0)}\`\n` +
                    `**Humidity:** \`${weather.humidity ?? 'Unknown'}%\`\n` +
                    `**Wind:** \`${formatWind(weather.wind)}\`\n` +
                    `**Clouds:** \`${weather.clouds ?? 'Unknown'}%\`\n` +
                    `**Coordinates:** \`${lat.toFixed(4)}, ${lon.toFixed(4)}\`\n` +
                    `**NASA View Date:** \`${date}\`${weather.localTime ? `\n**Local Time:** \`${weather.localTime}\`` : ''}`
                )
                .setFooter({
                    text: `${weather.provider} | NASA GIBS earth view`,
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            if (image) embed.setImage('attachment://weather-earth.png')

            if (weather.icon) {
                embed.setThumbnail(weather.icon)
            }

            return loading.edit({ embeds: [embed], files })
        } catch (err) {
            client.logger?.log?.(`weather command error: ${err.message}`, 'warn')
            return loading.edit({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Could not get weather for **${place}**: ${err.message.slice(0, 180)}`)
                ]
            })
        }
    }
}
