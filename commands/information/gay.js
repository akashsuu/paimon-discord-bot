const axios = require('axios');

module.exports = {
    name: 'gay',
    aliases: [],
    category: 'info',
    cooldown: 5,
    premium: false,
    run: async (client, message, args) => {
        const msg = await message.channel.send('Fetching gay anime images...');

        try {
            const { data } = await axios.get('https://api.nekosapi.com/v4/images/random', {
                params: {
                    tags: 'boy',
                    without_tags: 'girl,exposed_girl_breasts,pussy,futanari,yuri',
                    limit: 1,
                },
            });

            const image = data?.[0];
            if (!image) {
                return msg.edit('No images found.');
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Gay Anime')
                .setURL(image.url)
                .setImage(image.url)
                .setFooter({ text: `Image ${image.id}  ·  ${image.rating}` });

            return msg.edit({ content: null, embeds: [embed] });
        } catch (err) {
            return msg.edit('Failed to fetch image. API may be down.');
        }
    },
};
