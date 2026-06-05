module.exports = {
    name: 'ping',
    category: 'info',
    premium: false,
    cooldown: 4,
    run: async (client, message) => {
        const startedAt = Date.now()
        const reply = await message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setDescription('Measuring real latency...')
            ]
        })

        const messageRoundTrip = reply.createdTimestamp - message.createdTimestamp
        const apiEditLatency = Date.now() - startedAt
        const websocketPing = Math.round(client.ws.ping)
        let dbPing = null

        try {
            const dbStartedAt = Date.now()
            if (typeof client.db?.ping === 'function') {
                const measured = await client.db.ping()
                dbPing = Number.isFinite(measured) ? measured : Date.now() - dbStartedAt
            }
        } catch (_) {
            dbPing = null
        }

        const getLatencyText = (latency) => {
            if (latency <= 50) return 'Excellent'
            if (latency <= 100) return 'Fast'
            if (latency <= 180) return 'Stable'
            if (latency <= 300) return 'Slow'
            return 'Unstable'
        }

        const status = getLatencyText(websocketPing)
        const embed = client.util.embed()
            .setColor(client.color)
            .setAuthor({
                name: 'Pong! Real Latency',
                iconURL: message.author.displayAvatarURL({ dynamic: true })
            })
            .addFields(
                { name: 'WebSocket', value: `\`${websocketPing}ms\``, inline: true },
                { name: 'Message Round Trip', value: `\`${messageRoundTrip}ms\``, inline: true },
                { name: 'API Edit', value: `\`${apiEditLatency}ms\``, inline: true },
                { name: 'Database', value: dbPing === null ? '`unavailable`' : `\`${dbPing.toFixed(2)}ms\``, inline: true },
                { name: 'Status', value: `\`${status}\``, inline: true }
            )
            .setFooter({
                text: 'No fake ping. These values are measured live.',
                iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp()

        return reply.edit({ embeds: [embed] })
    }
}

