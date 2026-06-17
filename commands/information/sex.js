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
            const { data } = await axios.get('https://api.waifu.pics/sfw/hug');
            const url = data?.url;

            if (!url) {
                return msg.edit('No images found.');
            }

            const embed = client.util.embed()
                .setColor(client.color)
                .setImage(url);

            return msg.edit({ content: null, embeds: [embed] });
        } catch (err) {
            return msg.edit('Failed to fetch image. API may be down.');
        }
    },
};
