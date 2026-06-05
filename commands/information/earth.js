const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

const NASA_EARTH_URL = 'https://api.nasa.gov/planetary/earth/imagery'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const DEFAULT_DATE = '2020-01-01'
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

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
        lon: Number(result.lon)
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

            const image = await fetchEarthImage({
                apiKey,
                lat: location.lat,
                lon: location.lon,
                date
            })
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
                            `**Date:** \`${date}\``
                        )
                        .setImage('attachment://earth.png')
                        .setFooter({
                            text: 'NASA Earth Imagery',
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
