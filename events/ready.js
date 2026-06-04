const { ActivityType } = require('discord.js')

module.exports = async (client) => {
    client.on('ready', async () => {
        console.log(`${client.user.id} is ready.`)

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
