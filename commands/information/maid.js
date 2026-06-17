const axios = require('axios');

module.exports = {
    name: 'maid',
    aliases: ['maids'],
    category: 'info',
    cooldown: 4,
    premium: false,
    run: async (client, message, args) => {
        const msg = await message.channel.send('Fetching a maid image...');

        try {
            const { data } = await axios.get('https://api.waifu.im/images', {
                params: {
                    IncludedTags: 'maid',
                    IsNsfw: false,
                    PageSize: 1,
                },
            });

            const image = data?.items?.[0];
            if (!image) {
                return msg.edit('No maid images found.');
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Maid')
                .setURL(image.url)
                .setImage(image.url)
                .setFooter({ text: `Image ${image.id}  ·  ${image.width}x${image.height}` });

            return msg.edit({ content: null, embeds: [embed] });
        } catch (err) {
            return msg.edit('Failed to fetch maid image. API may be down.');
        }
    },
};
