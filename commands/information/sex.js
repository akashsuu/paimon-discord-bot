const axios = require('axios');

module.exports = {
    name: 'sex',
    aliases: ['fuck'],
    category: 'info',
    cooldown: 5,
    premium: false,
    run: async (client, message, args) => {
        const msg = await message.channel.send('Fetching...');

        try {
            const { data } = await axios.get('https://api.nekosapi.com/v4/images/random', {
                params: {
                    rating: 'safe',
                    limit: 1,
                },
            });

            const image = data?.[0];
            if (!image) {
                return msg.edit('No images found.');
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setImage(image.url)
                .setFooter({ text: `Image ${image.id}` });

            return msg.edit({ content: null, embeds: [embed] });
        } catch (err) {
            return msg.edit('Failed to fetch image. API may be down.');
        }
    },
};
