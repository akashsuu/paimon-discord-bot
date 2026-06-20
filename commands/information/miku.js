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
            const { data } = await axios.get('https://danbooru.donmai.us/posts.json', {
                params: {
                    tags: 'hatsune_miku rating:s',
                    limit: 100,
                },
                headers: {
                    'User-Agent': 'akashsuuBot/1.0',
                },
            });

            if (!data?.length) {
                return msg.edit('No Miku images found.');
            }

            const post = data[Math.floor(Math.random() * data.length)];
            const url = post.file_url || post.large_file_url;
            if (!url) {
                return msg.edit('No Miku images found.');
            }

            const embed = client.util.embed()
                .setColor('#33CCFF')
                .setTitle('Hatsune Miku')
                .setURL(`https://danbooru.donmai.us/posts/${post.id}`)
                .setImage(url)
                .setFooter({ text: `Rating: ${post.rating}  ·  ${post.image_width}x${post.image_height}` });

            return msg.edit({ content: null, embeds: [embed] });
        } catch (err) {
            return msg.edit('Failed to fetch image. API may be down.');
        }
    },
};
