const axios = require('axios');

module.exports = {
    name: 'miku',
    aliases: [],
    category: 'info',
    cooldown: 4,
    premium: false,
    run: async (client, message, args) => {
        const msg = await message.channel.send('Fetching Miku...');

        try {
            const { data } = await axios.get('https://api.nekosapi.com/v4/images/random', {
                params: {
                    character: 'miku',
                    rating: 'safe',
                    limit: 1,
                },
            });

            const image = data?.[0];
            if (!image) {
                return msg.edit('No Miku images found.');
            }

            const embed = client.util.embed()
                .setColor('#33CCFF')
                .setTitle('Hatsune Miku')
                .setURL(image.url)
                .setImage(image.url);

            return msg.edit({ content: null, embeds: [embed] });
        } catch (err) {
            return msg.edit('Failed to fetch image. API may be down.');
        }
    },
};
