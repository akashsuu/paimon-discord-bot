const { AttachmentBuilder } = require('discord.js')
const { createCanvas } = require('canvas')

const randomHex = (size) => {
    const chars = '0123456789abcdef'
    let value = ''

    for (let i = 0; i < size; i++) {
        value += chars[Math.floor(Math.random() * chars.length)]
    }

    return value
}

const pick = (items) => items[Math.floor(Math.random() * items.length)]

const roundRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
}

const drawText = (ctx, text, x, y, color = '#a6ffcb') => {
    ctx.fillStyle = color
    ctx.fillText(text, x, y)
}

module.exports = {
    name: 'terminal',
    aliases: ['console', 'shell'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        const target = message.mentions.users.first() || message.author
        const fakeUser = target.username.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user'
        const canvas = createCanvas(1100, 640)
        const ctx = canvas.getContext('2d')

        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
        gradient.addColorStop(0, '#05080b')
        gradient.addColorStop(0.55, '#08140f')
        gradient.addColorStop(1, '#020305')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.globalAlpha = 0.11
        ctx.fillStyle = '#49ff9d'
        for (let y = 0; y < canvas.height; y += 8) {
            ctx.fillRect(0, y, canvas.width, 1)
        }
        ctx.globalAlpha = 1

        ctx.shadowColor = 'rgba(62, 255, 151, 0.25)'
        ctx.shadowBlur = 18
        ctx.fillStyle = '#0d1117'
        roundRect(ctx, 42, 36, 1016, 568, 16)
        ctx.fill()
        ctx.shadowBlur = 0

        ctx.fillStyle = '#161b22'
        roundRect(ctx, 42, 36, 1016, 58, 16)
        ctx.fill()
        ctx.fillStyle = '#161b22'
        ctx.fillRect(42, 74, 1016, 20)

        const dots = [
            ['#ff5f57', 72],
            ['#ffbd2e', 102],
            ['#28c840', 132]
        ]
        for (const [color, x] of dots) {
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(x, 65, 9, 0, Math.PI * 2)
            ctx.fill()
        }

        ctx.font = '600 22px "Consolas", "Courier New", monospace'
        drawText(ctx, `akashsuu://terminal/${fakeUser}`, 178, 73, '#d7ffe8')

        ctx.font = '24px "Consolas", "Courier New", monospace'
        const lines = [
            `$ ssh ${fakeUser}@akashsuu.local`,
            `[auth] key accepted: ${randomHex(16)}`,
            '[init] loading visual terminal modules',
            `[scan] profile vector: ${target.id}`,
            `[trace] route: ${pick(['tokyo', 'mumbai', 'singapore', 'frankfurt'])}.${randomHex(4)}.node`,
            '[mask] discord packet mirror enabled',
            '[info] 192.85.11.203:443 - connection established',
            '[sync] rendering encrypted interface',
            `[hash] ${randomHex(8)}-${randomHex(8)}-${randomHex(8)}`,
            '[done] terminal image generated'
        ]

        let y = 138
        for (const line of lines) {
            const color = line.startsWith('$')
                ? '#ffffff'
                : line.startsWith('[done]')
                    ? '#58ff9b'
                    : line.startsWith('[info]')
                        ? '#f1d15b'
                        : '#87f7b8'
            drawText(ctx, line, 78, y, color)
            y += 38
        }

        ctx.strokeStyle = 'rgba(73, 255, 157, 0.35)'
        ctx.lineWidth = 2
        roundRect(ctx, 718, 126, 292, 324, 10)
        ctx.stroke()

        ctx.font = '700 22px "Consolas", "Courier New", monospace'
        drawText(ctx, 'SYSTEM PANEL', 746, 168, '#ffffff')

        ctx.font = '20px "Consolas", "Courier New", monospace'
        const stats = [
            ['CPU', `${Math.floor(Math.random() * 31) + 58}%`],
            ['RAM', `${Math.floor(Math.random() * 25) + 64}%`],
            ['NET', `${Math.floor(Math.random() * 600) + 250}mb/s`],
            ['PING', `${Math.floor(Math.random() * 28) + 12}ms`],
            ['LOCK', 'active']
        ]

        let statY = 214
        for (const [label, value] of stats) {
            drawText(ctx, label.padEnd(5, ' '), 750, statY, '#7ee787')
            drawText(ctx, value, 842, statY, '#d7ffe8')
            statY += 42
        }

        ctx.fillStyle = 'rgba(73, 255, 157, 0.12)'
        roundRect(ctx, 78, 520, 900, 28, 8)
        ctx.fill()
        ctx.fillStyle = '#49ff9d'
        roundRect(ctx, 78, 520, 796, 28, 8)
        ctx.fill()

        ctx.font = '700 22px "Consolas", "Courier New", monospace'
        drawText(ctx, 'SIMULATION COMPLETE  88%', 78, 588, '#ffffff')
        drawText(ctx, 'ACCESS: STYLE ONLY', 738, 588, '#49ff9d')

        const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), {
            name: 'terminal.png'
        })

        const embed = client.util.embed()
            .setColor(client.color)
            .setTitle('akashsuu Terminal')
            .setImage('attachment://terminal.png')
            .setFooter({
                text: 'akashsuu',
                iconURL: client.user.displayAvatarURL({ dynamic: true })
            })

        return message.channel.send({ embeds: [embed], files: [attachment] })
    }
}
