const axios = require('axios')
const { AttachmentBuilder } = require('discord.js')

const PRIVATE_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

const normalizeUrl = (input) => {
    const raw = String(input || '').trim()
    if (!raw) return null

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const parsed = new URL(withProtocol)

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Only `http` and `https` websites are supported.')
    }

    const hostname = parsed.hostname.toLowerCase()
    if (
        PRIVATE_HOSTS.has(hostname) ||
        hostname.endsWith('.local') ||
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    ) {
        throw new Error('Local/private websites cannot be screenshotted from Discord.')
    }

    return parsed.href
}

const screenshotProviders = (targetUrl) => [
    {
        name: 'thum.io',
        url: `https://image.thum.io/get/width/1280/crop/900/png/${targetUrl}`
    },
    {
        name: 'wordpress mshots',
        url: `https://s.wordpress.com/mshots/v1/${encodeURIComponent(targetUrl)}?w=1280`
    }
]

const fetchScreenshot = async (targetUrl) => {
    let lastError = null

    for (const provider of screenshotProviders(targetUrl)) {
        try {
            const response = await axios.get(provider.url, {
                responseType: 'arraybuffer',
                timeout: 30000,
                maxContentLength: 10 * 1024 * 1024,
                headers: {
                    'User-Agent': 'akashsuu-discord-bot/1.0'
                },
                validateStatus: (status) => status >= 200 && status < 400
            })

            const contentType = String(response.headers['content-type'] || '').toLowerCase()
            const buffer = Buffer.from(response.data)
            if (!buffer.length || !contentType.startsWith('image/')) {
                throw new Error(`${provider.name} did not return an image`)
            }

            return {
                buffer,
                provider: provider.name
            }
        } catch (err) {
            lastError = err
        }
    }

    throw lastError || new Error('Screenshot providers failed')
}

module.exports = {
    name: 'ss',
    aliases: ['screenshot', 'webshot'],
    category: 'fun',
    cooldown: 10,
    run: async (client, message, args) => {
        let targetUrl
        try {
            targetUrl = normalizeUrl(args[0])
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | ${err.message}`)
                ]
            })
        }

        if (!targetUrl) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Usage: \`${message.guild.prefix}ss https://example.com\``)
                ]
            })
        }

        const loading = await message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setDescription(`${client.emoji.tick} | Capturing screenshot of \`${targetUrl}\`...`)
            ]
        })

        try {
            const result = await fetchScreenshot(targetUrl)
            const attachment = new AttachmentBuilder(result.buffer, {
                name: 'screenshot.png'
            })

            return loading.edit({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setTitle('Website Screenshot')
                        .setDescription(`Captured \`${targetUrl}\``)
                        .setImage('attachment://screenshot.png')
                        .setFooter({
                            text: 'akashsuu screenshot',
                            iconURL: client.user.displayAvatarURL({ dynamic: true })
                        })
                ],
                files: [attachment]
            })
        } catch (err) {
            client.logger?.log?.(`ss command error: ${err.stack || err.message}`, 'error')
            return loading.edit({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Could not capture that website. Try a public website URL.`)
                ]
            })
        }
    }
}
