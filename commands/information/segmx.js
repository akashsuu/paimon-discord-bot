const gifs = [
    'https://tenor.com/view/app-applcation-application-meme-benjammins-big-application-gif-13214571959576025926',
    'https://tenor.com/view/job-job-application-jobless-gif-2757097081210871087',
    'https://tenor.com/view/job-get-a-job-mica-mica-yui-yui-gif-5932177933533564618',
    'https://tenor.com/view/akira-job-application-get-a-job-akira-job-application-gif-8274337411388777231'
]

module.exports = {
    name: 'sex',
    aliases: ['gaysex','sexgay'],
    category: 'fun',
    premium: true,
    run: async (client, message) => {
        const gif = gifs[Math.floor(Math.random() * gifs.length)]

        return message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setTitle('Segmx')
                    .setImage(gif)
                    .setFooter({
                        text: 'akashsuu',
                        iconURL: client.user.displayAvatarURL({ dynamic: true })
                    })
            ]
        })
    }
}
