const axios = require('axios')

const MOON_PHASE_URL = 'https://api.phaseofthemoontoday.com/v1/current'
const NASA_MOON_IMAGE = 'https://images-assets.nasa.gov/image/PIA00405/PIA00405~orig.jpg'
const LUNAR_CYCLE_DAYS = 29.53058867
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const phaseFromAge = (age) => {
    if (age < 1.84566) return 'New Moon'
    if (age < 5.53699) return 'Waxing Crescent'
    if (age < 9.22831) return 'First Quarter'
    if (age < 12.91963) return 'Waxing Gibbous'
    if (age < 16.61096) return 'Full Moon'
    if (age < 20.30228) return 'Waning Gibbous'
    if (age < 23.99361) return 'Last Quarter'
    if (age < 27.68493) return 'Waning Crescent'
    return 'New Moon'
}

const fallbackMoonData = () => {
    const now = Date.now()
    const daysSinceKnownNewMoon = (now - KNOWN_NEW_MOON) / 86400000
    const age = ((daysSinceKnownNewMoon % LUNAR_CYCLE_DAYS) + LUNAR_CYCLE_DAYS) % LUNAR_CYCLE_DAYS
    const phaseAngle = (age / LUNAR_CYCLE_DAYS) * Math.PI * 2
    const illumination = ((1 - Math.cos(phaseAngle)) / 2) * 100

    return {
        phase: phaseFromAge(age),
        illumination,
        days_since_new: age,
        source: 'Calculated fallback'
    }
}

const fetchMoonData = async () => {
    const response = await axios.get(MOON_PHASE_URL, {
        timeout: 10000,
        validateStatus: (status) => status >= 200 && status < 400
    })

    const data = response.data || {}
    return {
        phase: cleanText(data.phase) || 'Unknown',
        illumination: Number(data.illumination),
        days_since_new: Number(data.days_since_new),
        next_full_moon: data.next_full_moon,
        next_new_moon: data.next_new_moon,
        source: 'PhaseOfTheMoonToday'
    }
}

const formatPercent = (value) => Number.isFinite(value) ? `${value.toFixed(1)}%` : 'Unknown'
const formatDays = (value) => Number.isFinite(value) ? `${value.toFixed(1)} days` : 'Unknown'
const formatDate = (value) => {
    if (!value) return 'Unknown'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Unknown'
    return `<t:${Math.floor(date.getTime() / 1000)}:D>`
}

module.exports = {
    name: 'moon',
    aliases: ['moonphase', 'lunar'],
    category: 'utility',
    premium: true,
    run: async (client, message) => {
        let moon

        try {
            moon = await fetchMoonData()
        } catch (err) {
            client.logger?.log?.(`moon phase api fallback: ${err.message}`, 'warn')
            moon = fallbackMoonData()
        }

        const embed = client.util.embed()
            .setColor(client.color)
            .setTitle('Moon')
            .setDescription('Current lunar phase and Moon view.')
            .setImage(NASA_MOON_IMAGE)
            .addFields(
                { name: 'Phase', value: `\`${moon.phase}\``, inline: true },
                { name: 'Illumination', value: `\`${formatPercent(moon.illumination)}\``, inline: true },
                { name: 'Moon Age', value: `\`${formatDays(moon.days_since_new)}\``, inline: true },
                { name: 'Next Full Moon', value: formatDate(moon.next_full_moon), inline: true },
                { name: 'Next New Moon', value: formatDate(moon.next_new_moon), inline: true }
            )
            .setFooter({
                text: `${moon.source} | NASA Moon image`,
                iconURL: client.user.displayAvatarURL({ dynamic: true })
            })

        return message.channel.send({ embeds: [embed] })
    }
}
