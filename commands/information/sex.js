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
            let image;

            const { data } = await axios.get('https://api.nekosapi.com/v4/images/random', {
                params: {
                    tags: 'dick,pussy',
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
                        tags: 'dick,anal',
                        rating: 'explicit',
                        limit: 5,
                    },
                });
                if (fallback?.length > 0) {
                    image = fallback[Math.floor(Math.random() * fallback.length)];
                }
            }

            if (!image) {
                const { data: fallback2 } = await axios.get('https://api.nekosapi.com/v4/images/random', {
                    params: {
                        tags: 'threesome',
                        rating: 'explicit',
                        limit: 5,
                    },
                });
                if (fallback2?.length > 0) {
                    image = fallback2[Math.floor(Math.random() * fallback2.length)];
                }
            }

            if (!image) {
                return msg.edit('No images found.');
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setURL(image.url)
                .setImage(image.url)
                .setFooter({ text: `Image ${image.id}  ·  ${image.rating}` });

            return msg.edit({ content: null, embeds: [embed] });
        } catch (err) {
            return msg.edit('Failed to fetch image. API may be down.');
        }
    },
};
