const { ActivityType } = require('discord.js')
const fs = require('fs')
const path = require('path')
const axios = require('axios')

async function resolveAvatar(avatar) {
    if (!avatar) return null
    if (/^https?:\/\//i.test(avatar)) {
        const response = await axios.get(avatar, { responseType: 'arraybuffer' })
        return Buffer.from(response.data)
    }

    const avatarPath = path.isAbsolute(avatar)
        ? avatar
        : path.join(process.cwd(), avatar)

    if (fs.existsSync(avatarPath)) return fs.readFileSync(avatarPath)
    return avatar
}

module.exports = async (client) => {
    client.on('ready', async () => {
        console.log(`${client.user.id} is ready.`)
        const botName = client.config.BOT_NAME || 'akashsuu'
        const botAvatar = client.config.BOT_AVATAR

        if (client.user.username !== botName) {
            await client.user.setUsername(botName).catch((error) => {
                client.logger.log(`Could not update bot username: ${error.message}`, 'warn')
            })
        }

        if (botAvatar) {
            try {
                await client.user.setAvatar(await resolveAvatar(botAvatar))
            } catch (error) {
                client.logger.log(`Could not update bot avatar: ${error.message}`, 'warn')
            }
        }

        client.user.setPresence({
            activities: [
                {
                    name: 'Genshin Impact',
                    type: ActivityType.Playing // Can be Playing, Streaming, Listening, Watching
                }
            ],
            status: 'online' // Can be 'online', 'idle', 'dnd', 'invisible'
        });
        client.logger.log(`Logged in to ${client.user.tag}`, 'ready')
//client.util.checkAndLeaveNonPremiumGuilds(client)
    })
    

}
