const os = require('os')
const { execFile } = require('child_process')
const { promisify } = require('util')
const axios = require('axios')

const execFileAsync = promisify(execFile)
const DEFAULT_LOCAL_URL = 'http://127.0.0.1:1234'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const formatNumber = (value) => Number(value || 0).toLocaleString('en-US')

const formatBytes = (bytes) => {
    const gb = bytes / 1024 / 1024 / 1024
    return `${gb.toFixed(1)} GB`
}

const makeBar = (percent) => {
    if (percent === null || Number.isNaN(percent)) return '[----------] N/A'

    const safe = Math.max(0, Math.min(100, percent))
    const filled = Math.round(safe / 10)
    return `[${'#'.repeat(filled)}${'-'.repeat(10 - filled)}] ${safe.toFixed(0)}%`
}

const getCpuSnapshot = () => {
    const cpus = os.cpus()
    let idle = 0
    let total = 0

    for (const cpu of cpus) {
        idle += cpu.times.idle
        total += Object.values(cpu.times).reduce((sum, value) => sum + value, 0)
    }

    return { idle, total }
}

const getCpuUsage = async () => {
    const start = getCpuSnapshot()
    await wait(650)
    const end = getCpuSnapshot()
    const idle = end.idle - start.idle
    const total = end.total - start.total

    if (!total) return 0
    return (1 - idle / total) * 100
}

const getGpuFromNvidia = async () => {
    const { stdout } = await execFileAsync('nvidia-smi', [
        '--query-gpu=name,utilization.gpu,memory.used,memory.total',
        '--format=csv,noheader,nounits'
    ], {
        windowsHide: true,
        timeout: 5000
    })

    const line = stdout.trim().split(/\r?\n/)[0]
    if (!line) return null

    const [name, usage, memoryUsed, memoryTotal] = line.split(',').map((item) => item.trim())
    return {
        name,
        usage: Number(usage),
        memory: `${memoryUsed} MB / ${memoryTotal} MB`
    }
}

const getGpuNameFromWindows = async () => {
    const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-Command',
        'Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name'
    ], {
        windowsHide: true,
        timeout: 5000
    })

    const name = stdout.trim().split(/\r?\n/).find(Boolean)
    return name ? { name, usage: null, memory: 'N/A' } : null
}

const getGpuInfo = async () => {
    try {
        const gpu = await getGpuFromNvidia()
        if (gpu) return gpu
    } catch { }

    try {
        const gpu = await getGpuNameFromWindows()
        if (gpu) return gpu
    } catch { }

    return {
        name: 'Unknown GPU',
        usage: null,
        memory: 'N/A'
    }
}

const getLocalBaseUrl = (client) => {
    return (
        process.env.LOCAL_CHATBOT_URL ||
        process.env.OLLAMA_URL ||
        client.config.LOCAL_CHATBOT_URL ||
        client.config.OLLAMA_URL ||
        DEFAULT_LOCAL_URL
    ).replace(/\/+$/, '')
}

const getLocalApiMode = (baseUrl) => {
    return process.env.LOCAL_CHATBOT_API || (/:(1234)$/.test(baseUrl) ? 'lmstudio' : 'ollama')
}

const isOpenAICompatible = (baseUrl) => ['openai', 'lmstudio'].includes(getLocalApiMode(baseUrl))

const getLocalApiHeaders = (client) => {
    const apiKey = process.env.LOCAL_CHATBOT_API_KEY || client.config.LOCAL_CHATBOT_API_KEY
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
}

const extractModelIds = (data) => {
    const models = data?.data || data?.models || []
    return models
        .map((model) => model.id || model.name || model.path)
        .filter(Boolean)
}

const getLocalModel = async (client) => {
    if (process.env.LOCAL_CHATBOT_MODEL || process.env.OLLAMA_MODEL || client.config.LOCAL_CHATBOT_MODEL || client.config.OLLAMA_MODEL) {
        return process.env.LOCAL_CHATBOT_MODEL || process.env.OLLAMA_MODEL || client.config.LOCAL_CHATBOT_MODEL || client.config.OLLAMA_MODEL
    }

    try {
        const baseUrl = getLocalBaseUrl(client)
        if (getLocalApiMode(baseUrl) === 'lmstudio') {
            const response = await axios.get(`${baseUrl}/api/v1/models`, {
                headers: getLocalApiHeaders(client),
                timeout: 5000
            })
            return extractModelIds(response.data)[0] || 'No model found'
        }

        if (isOpenAICompatible(baseUrl)) {
            const response = await axios.get(`${baseUrl}/v1/models`, {
                headers: getLocalApiHeaders(client),
                timeout: 5000
            })
            return extractModelIds(response.data)[0] || 'No model found'
        }

        const response = await axios.get(`${baseUrl}/api/tags`, {
            timeout: 5000
        })
        return response.data?.models?.[0]?.name || 'No model found'
    } catch {
        return 'Local API offline'
    }
}

module.exports = {
    name: 'chatbotusage',
    aliases: ['ollamausage', 'llmusage', 'aiusage'],
    category: 'utility',
    premium: true,
    run: async (client, message) => {
        const [cpuUsage, gpu, model] = await Promise.all([
            getCpuUsage(),
            getGpuInfo(),
            getLocalModel(client)
        ])
        const usage = await client.db.get(`ollama_usage_${message.guild.id}`) || {}
        const totalMem = os.totalmem()
        const usedMem = totalMem - os.freemem()
        const memPercent = (usedMem / totalMem) * 100
        const cpuName = os.cpus()[0]?.model || 'Unknown CPU'

        const embed = client.util.embed()
            .setColor(client.color)
            .setAuthor({
                name: 'akashsuu local chatbot usage',
                iconURL: client.user.displayAvatarURL({ dynamic: true })
            })
            .setDescription(
                '```ansi\n' +
                '[ Local LLM Dashboard ]\n' +
                `Model     : ${model}\n` +
                `Requests  : ${formatNumber(usage.requests)}\n` +
                `Tokens    : ${formatNumber(usage.totalTokens)} total\n` +
                `Prompt    : ${formatNumber(usage.promptTokens)}\n` +
                `Reply     : ${formatNumber(usage.completionTokens)}\n` +
                '```'
            )
            .addFields(
                {
                    name: 'CPU',
                    value:
                        `\`${cpuName}\`\n` +
                        `\`${makeBar(cpuUsage)}\``,
                    inline: false
                },
                {
                    name: 'GPU',
                    value:
                        `\`${gpu.name}\`\n` +
                        `\`${makeBar(gpu.usage)}\`\n` +
                        `Memory: \`${gpu.memory}\``,
                    inline: false
                },
                {
                    name: 'RAM',
                    value:
                        `\`${makeBar(memPercent)}\`\n` +
                        `Used: \`${formatBytes(usedMem)} / ${formatBytes(totalMem)}\``,
                    inline: false
                },
                {
                    name: 'Last Run',
                    value:
                        `Model: \`${usage.lastModel || model}\`\n` +
                        `Duration: \`${usage.lastDurationMs ? `${usage.lastDurationMs}ms` : 'N/A'}\``,
                    inline: false
                }
            )
            .setFooter({
                text: 'Tokens are tracked from !local-chatbot local API replies',
                iconURL: message.author.displayAvatarURL({ dynamic: true })
            })

        return message.channel.send({ embeds: [embed] })
    }
}
