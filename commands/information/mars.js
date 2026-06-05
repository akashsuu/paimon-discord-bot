const axios = require('axios')

const MARS_ROVER_URL = 'https://api.nasa.gov/mars-photos/api/v1/rovers'
const ROVER_ALIASES = {
    curiosity: 'curiosity',
    c: 'curiosity',
    perseverance: 'perseverance',
    percy: 'perseverance',
    p: 'perseverance',
    opportunity: 'opportunity',
    oppy: 'opportunity',
    spirit: 'spirit'
}
const CAMERA_ALIASES = {
    fhaz: 'FHAZ',
    rhaz: 'RHAZ',
    mast: 'MAST',
    chemcam: 'CHEMCAM',
    mahli: 'MAHLI',
    mardi: 'MARDI',
    navcam: 'NAVCAM',
    pancam: 'PANCAM',
    minites: 'MINITES',
    edl_rucam: 'EDL_RUCAM',
    edl_rdcam: 'EDL_RDCAM',
    edl_ddcam: 'EDL_DDCAM',
    edl_pucam1: 'EDL_PUCAM1',
    edl_pucam2: 'EDL_PUCAM2',
    navcam_left: 'NAVCAM_LEFT',
    navcam_right: 'NAVCAM_RIGHT',
    mcz_right: 'MCZ_RIGHT',
    mcz_left: 'MCZ_LEFT',
    front_hazcam_left_a: 'FRONT_HAZCAM_LEFT_A',
    front_hazcam_right_a: 'FRONT_HAZCAM_RIGHT_A',
    rear_hazcam_left: 'REAR_HAZCAM_LEFT',
    rear_hazcam_right: 'REAR_HAZCAM_RIGHT'
}
const ROVER_FALLBACKS = [
    { rover: 'curiosity', sol: 1000, camera: 'NAVCAM' },
    { rover: 'curiosity', sol: 1000, camera: 'MAST' },
    { rover: 'perseverance', sol: 100, camera: 'NAVCAM_LEFT' },
    { rover: 'opportunity', sol: 1000, camera: 'PANCAM' },
    { rover: 'spirit', sol: 1000, camera: 'PANCAM' }
]

const pick = (items) => items[Math.floor(Math.random() * items.length)]

const parseArgs = (args) => {
    const roverInput = String(args[0] || '').toLowerCase()
    const cameraInput = String(args[1] || '').toLowerCase()

    return {
        rover: ROVER_ALIASES[roverInput] || 'curiosity',
        camera: CAMERA_ALIASES[cameraInput] || null
    }
}

const fetchPhotos = async ({ apiKey, rover, sol, camera }) => {
    const params = { sol, api_key: apiKey }
    if (camera) params.camera = camera

    const response = await axios.get(`${MARS_ROVER_URL}/${rover}/photos`, {
        params,
        timeout: 20000,
        validateStatus: (status) => status >= 200 && status < 500
    })

    if (response.status !== 200) {
        throw new Error(response.data?.errors || response.data?.msg || `NASA returned ${response.status}`)
    }

    return response.data?.photos || []
}

const findMarsPhoto = async ({ apiKey, requestedRover, requestedCamera }) => {
    const searches = [
        { rover: requestedRover, sol: requestedRover === 'perseverance' ? 100 : 1000, camera: requestedCamera },
        ...ROVER_FALLBACKS
    ]

    for (const search of searches) {
        const photos = await fetchPhotos({ apiKey, ...search }).catch(() => [])
        if (photos.length) return pick(photos)
    }

    return null
}

module.exports = {
    name: 'mars',
    aliases: ['marsrover', 'rover'],
    category: 'utility',
    premium: true,
    run: async (client, message, args) => {
        const prefix = message.guild?.prefix || client.config.PREFIX
        const apiKey = process.env.NASA_API_KEY || client.config.NASA_API_KEY

        if (!apiKey) {
            return message.channel.send({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Missing \`NASA_API_KEY\`. Add it to your \`.env\` file and restart the bot.`)
                ]
            })
        }

        const { rover, camera } = parseArgs(args)
        const loading = await message.channel.send({
            embeds: [
                client.util.embed()
                    .setColor(client.color)
                    .setDescription(`${client.emoji.tick} | Searching Mars rover photo...`)
            ]
        })

        try {
            const photo = await findMarsPhoto({ apiKey, requestedRover: rover, requestedCamera: camera })
            if (!photo?.img_src) throw new Error('No Mars rover photos found')

            const roverName = photo.rover?.name || rover
            const cameraName = photo.camera?.full_name || photo.camera?.name || 'Unknown camera'
            const embed = client.util.embed()
                .setColor(client.color)
                .setTitle('Mars Rover Photo')
                .setDescription(
                    `**Rover:** ${roverName}\n` +
                    `**Camera:** ${cameraName}\n` +
                    `**Earth Date:** \`${photo.earth_date || 'Unknown'}\`\n` +
                    `**Sol:** \`${photo.sol || 'Unknown'}\``
                )
                .setImage(String(photo.img_src).replace(/^http:/i, 'https:'))
                .setFooter({
                    text: 'NASA Mars Rover Photos',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })

            return loading.edit({ embeds: [embed] })
        } catch (err) {
            client.logger?.log?.(`mars command error: ${err.message}`, 'warn')
            return loading.edit({
                embeds: [
                    client.util.embed()
                        .setColor(client.color)
                        .setDescription(`${client.emoji.cross} | Could not get Mars photo. Try \`${prefix}mars curiosity navcam\` or \`${prefix}mars perseverance navcam_left\`.`)
                ]
            })
        }
    }
}
