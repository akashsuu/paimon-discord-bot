const axios = require('axios')

module.exports = {
    name: 'meme',
    aliases: ['memes'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        try {
            const response = await axios.get('https://meme-api.com/gimme', {
                timeout: 10000
            })
            const meme = response.data

            if (!meme?.url) {
                throw new Error('Meme API returned no image URL')
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle(meme.title || 'Meme')
                .setURL(meme.postLink || meme.url)
                .setImage(meme.url)
                .setFooter({
                    text: meme.subreddit ? `r/${meme.subreddit}` : 'Meme',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] })
        } catch (err) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | meme api is **currently down**.`)
                ]
            })
        }
    }
}
