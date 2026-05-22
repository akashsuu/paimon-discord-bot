const { Client, Collection, Partials, WebhookClient, Options, GatewayIntentBits } = require('discord.js')
const { REST } = require('@discordjs/rest');
const fs = require('fs')
const mongoose = require('mongoose')
const Utils = require('./util')
const { glob } = require('glob')
const { promisify } = require('util')
const { Database } = require('quickmongo')
<<<<<<< HEAD
const { QuickDB } = require('quick.db')
const axios = require('axios')
const pg = require('pg')
const redis = require("redis");
const { ClusterClient, getInfo } = require('discord-hybrid-sharding');
const Sql = require('better-sqlite3')
=======
const axios = require('axios')
const { ClusterClient, getInfo } = require('discord-hybrid-sharding');

function resolveClusterInfo() {
    try {
        return getInfo()
    } catch (err) {
        return null
    }
}

function createSingleProcessCluster(client) {
    return {
        id: 0,
        ids: [0],
        count: 1,
        mode: 'single',
        broadcastEval: async (script) => {
            if (typeof script === 'function') return [await script(client)]
            if (typeof script === 'string') return [Function(`return (${script})`).call(client)]
            return [null]
        }
    }
}

function createDisabledSqlite(name, reason) {
    const disabled = () => {
        throw new Error(`${name} database is disabled because better-sqlite3 could not load: ${reason}`)
    }

    return {
        disabled: true,
        pragma: disabled,
        prepare: disabled
    }
}
>>>>>>> 40fc381 (added many things)

function normalizeEmoji(value) {
    if (typeof value !== 'string') return value

    const rawId = value.match(/^\d{15,25}$/)
    if (rawId) return `<:emoji_${value}:${value}>`

    const missingName = value.match(/^<(?<animated>a?):(?<id>\d{15,25})>$/)
    if (missingName?.groups) {
        const prefix = missingName.groups.animated ? '<a:' : '<:'
        return `${prefix}emoji_${missingName.groups.id}:${missingName.groups.id}>`
    }

    return value
}

const formatError = (error) => {
    if (!error) return 'Unknown error'
    return String(error.stack || error.message || error).slice(0, 1800)
}

<<<<<<< HEAD
module.exports = class Akashsuu extends Client {
    constructor() {
        super({
            intents: 53608447,
            fetchAllMembers: true,
            shards: getInfo().SHARD_LIST,
            shardCount: getInfo().TOTAL_SHARDS,
=======
const resolveBotToken = (config = {}) => {
    const token = process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || config.TOKEN
    return String(token || '')
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/^Bot\s+/i, '')
}

module.exports = class Akashsuu extends Client {
    constructor() {
        const clusterInfo = resolveClusterInfo()
        super({
            intents: 53608447,
            fetchAllMembers: true,
            ...(clusterInfo ? {
                shards: clusterInfo.SHARD_LIST,
                shardCount: clusterInfo.TOTAL_SHARDS
            } : {}),
>>>>>>> 40fc381 (added many things)
            allowedMentions: {
                parse: ['users', 'roles'],
                repliedUser: true
            },
            partials: [Partials.Message, Partials.Channel, Partials.Reaction],
            sweepers: {

                messages: {

                    interval: 300,

                    lifetime: 1800
                }

            }

        })

        this.setMaxListeners(Infinity)
<<<<<<< HEAD
        this.cluster = new ClusterClient(this);
        this.config = require(`${process.cwd()}/config.json`)
        this.config.TOKEN = process.env.TOKEN || this.config.TOKEN
        this.config.MONGO_DB = process.env.MONGO_DB || this.config.MONGO_DB
=======
        this.cluster = clusterInfo ? new ClusterClient(this) : createSingleProcessCluster(this);
        this.config = require(`${process.cwd()}/config.json`)
        this.config.TOKEN = resolveBotToken(this.config)
        this.config.MONGO_DB = process.env.MONGO_DB || this.config.MONGO_DB
        if (this.config.TOKEN) {
            this.rest.setToken(this.config.TOKEN)
        }
>>>>>>> 40fc381 (added many things)
        this.emoji = Object.fromEntries(
            Object.entries(require(`${process.cwd()}/emoji.json`)).map(([key, value]) => [
                key,
                normalizeEmoji(value)
            ])
        )
        this.logger = require('./logger')
        this.commands = new Collection()
        this.categories = fs.readdirSync('./commands/')
        this.util = new Utils(this)
        this.color = 0xffffff
        this.support = `https://discord.gg/64ZptNjsar`
        this.cooldowns = new Collection()
        this.snek = require('axios')

        this.ratelimit = new WebhookClient({
            url: 'https://discord.com/api/webhooks/1281947877387796560/yYMNTl5-OAFdlFmP6uOEC8egW-REhb73RV6MGxZ7En-jim3Gt2NRyXaLQOZ8rNqHqmIf'
        })
        this.error = new WebhookClient({
            url: 'https://discord.com/api/webhooks/1375503118992674929/J-HKK5Pa9AIRB9MPBVhyluukGs33RfB1e7Qe340XdIP6jRxAuboDBvUyIDhNhnySZ2v8'
        })
        this.safeWebhookSend = async (webhook, payload) => {
            try {
                await webhook.send(payload)
            } catch (err) {
                this.logger?.log?.(`Webhook send failed: ${err.message}`, 'error')
            }
        }

        this.on('error', (error) => {
            this.safeWebhookSend(this.error, `\`\`\`js\n${formatError(error)}\`\`\``)
        })
        process.on('unhandledRejection', (error) => {
            this.safeWebhookSend(this.error, `\`\`\`js\n${formatError(error)}\`\`\``)
        })
        process.on('uncaughtException', (error) => {
            this.safeWebhookSend(this.error, `\`\`\`js\n${formatError(error)}\`\`\``)
        })
        process.on('warning', (warn) => {
            this.safeWebhookSend(this.error, `\`\`\`js\n${formatError(warn)}\`\`\``)
        })
        process.on('uncaughtExceptionMonitor', (err, origin) => {
            this.safeWebhookSend(this.error, `\`\`\`js\n${formatError(err)}\nOrigin: ${origin}\`\`\``)
        })
        this.rest.on('rateLimited', (info) => {
            this.safeWebhookSend(this.ratelimit, {
                content: `\`\`\`js\nTimeout: ${info.retryAfter},\nLimit: ${info.limit},\nMethod: ${info.method},\nPath: ${info.hash},\nRoute: ${info.route},\nGlobal: ${info.global}\nURL : ${info.url}\nScope : ${info.scope}\nMajorPrameter : ${info.majorParameter} Black\`\`\``
            })
        })
    }


    async initializedata() {
<<<<<<< HEAD
            this.warn = new Sql(`${process.cwd()}/Database/warns.db`);
            this.warn.pragma('journal_mode = WAL');
            this.warn.prepare(`CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY AUTOINCREMENT,guildId TEXT NOT NULL,userId TEXT NOT NULL,reason TEXT,moderatorId TEXT,timestamp TEXT,warnId TEXT NOT NULL)`).run();
            this.snipe = new Sql(`${process.cwd()}/Database/snipe.db`);
            this.snipe.pragma('journal_mode = WAL');
            this.snipe.prepare(`CREATE TABLE IF NOT EXISTS snipes (id INTEGER PRIMARY KEY AUTOINCREMENT,guildId TEXT NOT NULL,channelId TEXT NOT NULL,content TEXT,author TEXT,timestamp INTEGER,imageUrl TEXT)`).run();
            this.msgs = new Sql(`${process.cwd()}/Database/messages.db`);
            this.msgs.pragma('journal_mode = WAL');
=======
        let Sql
        try {
            Sql = require('better-sqlite3')
        } catch (err) {
            this.logger?.log?.(`better-sqlite3 failed to load. SQLite commands are disabled: ${err.message}`, 'error')
            this.warn = createDisabledSqlite('warns', err.message)
            this.snipe = createDisabledSqlite('snipe', err.message)
            this.msgs = createDisabledSqlite('messages', err.message)
            this.livelb = createDisabledSqlite('live leaderboard', err.message)
            this.voiceDb = createDisabledSqlite('voice leaderboard', err.message)
            return
        }

        try {
            this.warn = new Sql(`${process.cwd()}/Database/warns.db`)
            this.warn.pragma('journal_mode = WAL')
            this.warn.prepare(`CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY AUTOINCREMENT,guildId TEXT NOT NULL,userId TEXT NOT NULL,reason TEXT,moderatorId TEXT,timestamp TEXT,warnId TEXT NOT NULL)`).run()
            this.snipe = new Sql(`${process.cwd()}/Database/snipe.db`)
            this.snipe.pragma('journal_mode = WAL')
            this.snipe.prepare(`CREATE TABLE IF NOT EXISTS snipes (id INTEGER PRIMARY KEY AUTOINCREMENT,guildId TEXT NOT NULL,channelId TEXT NOT NULL,content TEXT,author TEXT,timestamp INTEGER,imageUrl TEXT)`).run()
            this.msgs = new Sql(`${process.cwd()}/Database/messages.db`)
            this.msgs.pragma('journal_mode = WAL')
>>>>>>> 40fc381 (added many things)
            this.msgs.prepare(`CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guildId TEXT NOT NULL,
                userId TEXT NOT NULL,
                totalMessages INTEGER DEFAULT 0,
                UNIQUE(guildId, userId)
<<<<<<< HEAD
            );`).run();
=======
            );`).run()
>>>>>>> 40fc381 (added many things)
            this.msgs.prepare(`CREATE TABLE IF NOT EXISTS dailymessages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guildId TEXT NOT NULL,
                userId TEXT NOT NULL,
                date TEXT NOT NULL,
                dailyCount INTEGER DEFAULT 0,
                UNIQUE(guildId, userId, date)
<<<<<<< HEAD
            );`).run();
        
        
            this.livelb = new Sql(`${process.cwd()}/Database/liveleaderboard.db`);
            this.livelb.pragma('journal_mode = WAL');
=======
            );`).run()
        
        
            this.livelb = new Sql(`${process.cwd()}/Database/liveleaderboard.db`)
            this.livelb.pragma('journal_mode = WAL')
>>>>>>> 40fc381 (added many things)
            this.livelb.prepare(`CREATE TABLE IF NOT EXISTS liveleaderboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guildId TEXT NOT NULL,
            type TEXT NOT NULL,
            messageId TEXT NOT NULL,
            channelId TEXT NOT NULL,
            UNIQUE(guildId, type)
<<<<<<< HEAD
        );`).run();
        
            this.voiceDb = new Sql(`${process.cwd()}/Database/voice.db`);
            this.voiceDb.pragma('journal_mode = WAL');
=======
        );`).run()
        
            this.voiceDb = new Sql(`${process.cwd()}/Database/voice.db`)
            this.voiceDb.pragma('journal_mode = WAL')
>>>>>>> 40fc381 (added many things)
            this.voiceDb.prepare(`CREATE TABLE IF NOT EXISTS dailyvoice (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guildId TEXT NOT NULL,
                userId TEXT NOT NULL,
                date TEXT NOT NULL,
                dailyVoiceTime INTEGER DEFAULT 0,
                UNIQUE(guildId, userId, date)
<<<<<<< HEAD
            );`).run();
=======
            );`).run()
>>>>>>> 40fc381 (added many things)
            
            this.voiceDb.prepare(`CREATE TABLE IF NOT EXISTS voice (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guildId TEXT NOT NULL,
                userId TEXT NOT NULL,
                totalVoiceTime INTEGER DEFAULT 0,
                UNIQUE(guildId, userId)
<<<<<<< HEAD
            );`).run();    
          }
=======
            );`).run()
        } catch (err) {
            this.logger?.log?.(`SQLite databases failed to open. SQLite commands are disabled: ${err.message}`, 'error')
            this.warn = createDisabledSqlite('warns', err.message)
            this.snipe = createDisabledSqlite('snipe', err.message)
            this.msgs = createDisabledSqlite('messages', err.message)
            this.livelb = createDisabledSqlite('live leaderboard', err.message)
            this.voiceDb = createDisabledSqlite('voice leaderboard', err.message)
        }
    }
>>>>>>> 40fc381 (added many things)

    async initializeMongoose() {
        if (!this.config.MONGO_DB) throw new Error('Missing MONGO_DB. Add it to your .env file.')
        this.db = new Database(this.config.MONGO_DB)
        this.db.connect()
        this.logger.log(`Connecting to MongoDb...`)
        await mongoose.connect(this.config.MONGO_DB,{
            useNewUrlParser: true,
            useUnifiedTopology: true
        })
        this.logger.log('Mongoose Database Connected', 'ready')
    }
    async loadEvents() {
        fs.readdirSync('./events/').forEach((file) => {
            if (file.endsWith('.js')) {
                let eventName = file.split('.')[0]
<<<<<<< HEAD
                require(`${process.cwd()}/events/${file}`)(this)
                this.logger.log(`Updated Event ${eventName}.`, 'event')
=======
                try {
                    require(`${process.cwd()}/events/${file}`)(this)
                    this.logger.log(`Updated Event ${eventName}.`, 'event')
                } catch (err) {
                    this.logger.log(`Skipped Event ${eventName}: ${err.message}`, 'warn')
                }
>>>>>>> 40fc381 (added many things)
            }
        })
    }

    async loadlogs() {
        if (!fs.existsSync('./logs/')) {
            this.logger.log('No logs directory found. Skipping logs.', 'warn')
            return []
        }

        fs.readdirSync('./logs/').forEach((file) => {
            if (file.endsWith('.js')) {
                let logevent = file.split('.')[0]
                require(`${process.cwd()}/logs/${file}`)(this)
                this.logger.log(`Updated Logs ${logevent}.`, 'event')
            }
        })
    }


    async loadMain() {
        const commandFiles = []

        const commandDirectories = fs.readdirSync(`${process.cwd()}/commands`)
        for (const directory of commandDirectories) {
            const files = fs
                .readdirSync(`${process.cwd()}/commands/${directory}`)
                .filter((file) => file.endsWith('.js'))

            for (const file of files) {
                commandFiles.push(
                    `${process.cwd()}/commands/${directory}/${file}`
                )
            }
        }
        commandFiles.map((value) => {
<<<<<<< HEAD
            const file = require(value)
            const splitted = value.split('/')
            const directory = splitted[splitted.length - 2]
            if (file.name) {
                const properties = { directory, ...file }
                this.commands.set(file.name, properties)
=======
            try {
                const file = require(value)
                const splitted = value.split(/[\\/]/)
                const directory = splitted[splitted.length - 2]
                if (file.name) {
                    const properties = { directory, ...file }
                    this.commands.set(file.name, properties)
                }
            } catch (err) {
                this.logger.log(`Skipped Command ${value}: ${err.message}`, 'warn')
>>>>>>> 40fc381 (added many things)
            }
        })
        this.logger.log(`Updated ${this.commands.size} Commands.`, 'cmd')
    }
}
