const axios = require('axios');

module.exports = {
    name: 'yaoi',
    aliases: [],
    category: 'info',
    cooldown: 5,
    premium: false,
    run: async (client, message, args) => {
        const msg = await message.channel.send('Fetching yaoi...');

        try {
            let image;

            const { data } = await axios.get('https://api.nekosapi.com/v4/images/random', {
                params: {
                    tags: 'boy,dick,kissing',
                    without_tags: 'girl,exposed_girl_breasts,pussy,futanari,yuri',
                    rating: 'explicit',
                    limit: 5,
                },
            });

            if (data?.length > 0) {
                image = data[Math.floor(Math.random() * data.length)];
            }

            if (!image) {
                const { data: fallback } = await axios.get('https://api.nekosapi.com/v4/images/random', {
                    params: {
                        tags: 'boy,dick',
                        without_tags: 'girl,exposed_girl_breasts,pussy,futanari,yuri',
                        rating: 'explicit',
                        limit: 5,
                    },
                });
                if (fallback?.length > 0) {
                    image = fallback[Math.floor(Math.random() * fallback.length)];
                }
            }

            if (!image) {
                return msg.edit('No images found.');
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Yaoi')
                .setURL(image.url)
                .setImage(image.url)
                .setFooter({ text: `Image ${image.id}  ·  ${image.rating}` });

            return msg.edit({ content: null, embeds: [embed] });
        } catch (err) {
            return msg.edit('Failed to fetch image. API may be down.');
        }
    },
};
