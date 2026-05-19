const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const os = require('os');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const axios = require('axios'); 
const _ = require('lodash'); 

function cleanOutput(client, value) {
    let output = typeof value === 'string'
        ? value
        : require('util').inspect(value, { depth: 1 })

    const secrets = [client.token, client.config.TOKEN, client.config.MONGO_DB].filter(Boolean)
    for (const secret of secrets) {
        output = output.replaceAll(secret, 'T0K3N')
    }

    return output
}

function detectGpu(client) {
    const configuredGpu = process.env.GPU_NAME || client.config.GPU_NAME
    if (configuredGpu) return configuredGpu

    const commands = process.platform === 'win32'
        ? [
            'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"',
            'wmic path win32_VideoController get name'
        ]
        : [
            'lspci | grep -Ei "vga|3d|display"'
        ]

    for (const command of commands) {
        try {
            const output = execSync(command, {
                encoding: 'utf8',
                timeout: 3000,
                windowsHide: true
            })
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line && line.toLowerCase() !== 'name')

            if (output.length) return output.join(', ')
        } catch (err) {}
    }

    return 'Not detected'
}

module.exports = {
    name: 'eval',
    aliases: ['ev', 'jaduexe'],
    category: 'owner',
    run: async (client, message, args) => {
        if (!client.config.owner.includes(message.author.id)) return;

        const option = args[0]?.toLowerCase();
        const content = args.slice(1).join(' ');

        if (!option) {
            const uptime = Math.round(client.uptime / 1000);
            const processMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const totalGuilds = client.guilds.cache.size;
            const totalUsers = client.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0) || client.users.cache.size;
            const processStarted = Math.floor((Date.now() - process.uptime() * 1000) / 1000);
            const botReady = Math.floor(Date.now() / 1000 - uptime);
            const shardState = client.cluster ? 'Sharded' : 'Single Process';
            const enabled = (intent) => client.options.intents.has(intent) ? 'ON' : 'OFF';
            const cpus = os.cpus();
            const cpuModel = cpus[0]?.model || 'Unknown CPU';
            const cpuSpeed = cpus[0]?.speed ? `${cpus[0].speed} MHz` : 'Unknown speed';
            const gpuName = detectGpu(client);

            const embed = client.util.embed()
                .setColor(client.color)
                .setAuthor({
                    name: 'akashsuu control panel',
                    iconURL: client.user.displayAvatarURL({ dynamic: true })
                })
                .setDescription(
                    `**Status:** Online\n` +
                    `**Mode:** ${shardState}\n` +
                    `**Latency:** ${client.ws.ping}ms`
                )
                .addFields([
                    {
                        name: 'Runtime',
                        value:
                            `Started: <t:${processStarted}:R>\n` +
                            `Ready: <t:${botReady}:R>\n` +
                            `PID: \`${process.pid}\``,
                        inline: true
                    },
                    {
                        name: 'Memory',
                        value:
                            `Process: \`${processMemory} MB\`\n` +
                            `Platform: \`${os.type().toLowerCase()} ${os.arch()}\``,
                        inline: true
                    },
                    {
                        name: 'CPU',
                        value:
                            `Model: \`${cpuModel}\`\n` +
                            `Cores: \`${cpus.length}\`\n` +
                            `Speed: \`${cpuSpeed}\``,
                        inline: false
                    },
                    {
                        name: 'GPU',
                        value: `Device: \`${gpuName}\``,
                        inline: false
                    },
                    {
                        name: 'Reach',
                        value:
                            `Guilds: \`${totalGuilds}\`\n` +
                            `Users: \`${totalUsers.toLocaleString()}\``,
                        inline: true
                    },
                    {
                        name: 'Intents',
                        value:
                            `Presences: \`${enabled('GuildPresences')}\`\n` +
                            `Members: \`${enabled('GuildMembers')}\`\n` +
                            `Message Content: \`${enabled('MessageContent')}\``,
                        inline: false
                    }
                ])
                .setFooter({
                    text: 'akashsuu',
                    iconURL: message.author.displayAvatarURL({ dynamic: true })
                })

            return message.channel.send({ embeds: [embed] });
        }

        const paginate = async (message, content) => {
            const pages = content.match(/[\s\S]{1,2000}/g) || [];
            let page = 0;

            const embed = new EmbedBuilder()
                .setColor(client.color)
                .setDescription(`\`\`\`js\n${pages[page]}\`\`\``)

            if (content.length > 4000) {
                embed.setFooter({ text: `Page ${page + 1} of ${pages.length}` });
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev')
                            .setLabel('Prev')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(page === 0),
                        new ButtonBuilder()
                            .setCustomId('stop')
                            .setLabel('Stop')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(page === pages.length - 1)
                    );

                const messageEmbed = await message.channel.send({
                    embeds: [embed],
                    components: [row],
                });

                const collector = messageEmbed.createMessageComponentCollector({
                    filter: (i) => i.user.id === message.author.id,
                    time: 60000,
                });

                collector.on('collect', async (interaction) => {
                    if (interaction.customId === 'prev' && page > 0) {
                        page--;
                    } else if (interaction.customId === 'next' && page < pages.length - 1) {
                        page++;
                    } else if (interaction.customId === 'stop') {
                        collector.stop();
                        await interaction.update({ components: [] });
                        return;
                    }

                    embed.setDescription(`\`\`\`js\n${pages[page]}\`\`\``);
                    embed.setFooter({ text: `Page ${page + 1} of ${pages.length}` });

                    row.components[0].setDisabled(page === 0);
                    row.components[2].setDisabled(page === pages.length - 1);

                    await interaction.update({ embeds: [embed], components: [row] });
                });

                collector.on('end', async () => {
                    await messageEmbed.edit({ components: [] });
                });
            } else {
                // If content is within 4000 characters, send without buttons
                await message.channel.send({ embeds: [embed] });
            }
        };

        try {
            let output;

            switch (option) {
                case 'js':
                    output = await eval(content);
                    break;
                case 'exec':
                    output = await new Promise((resolve, reject) => {
                        exec(content, (error, stdout, stderr) => {
                            if (error) reject(error.message);
                            else resolve(stdout || stderr);
                        });
                    });
                    break;
                case 'cat':
                    output = fs.readFileSync(content, 'utf-8');
                    break;
                case 'curl':
                    const response = await axios.get(content);
                    output = response.data;
                    break;
                default:
                    output = `Invalid option. Available options: \`js\`, \`exec\`, \`cat\`, \`curl\``;
            }

            await paginate(message, cleanOutput(client, output));
        } catch (err) {
            const errorEmbed = new EmbedBuilder()
                .setColor(client.color)
                .setDescription(`\`\`\`js\n${cleanOutput(client, err.stack || err.toString())}\`\`\``);

            message.channel.send({ embeds: [errorEmbed] });
        }
    },
};
