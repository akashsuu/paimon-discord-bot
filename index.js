<<<<<<< HEAD
const wait = require('wait');
=======
>>>>>>> 40fc381 (added many things)
require('dotenv').config();
require('module-alias/register');
const path = require('path');
const Akashsuu = require('./structures/Akashsuu.js');
<<<<<<< HEAD

const client = new Akashsuu();
const config = require(`${process.cwd()}/config.json`);
config.TOKEN = process.env.TOKEN || config.TOKEN;
=======
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const client = new Akashsuu();
const config = require(`${process.cwd()}/config.json`);
const resolveBotToken = () => {
    const token = process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || config.TOKEN
    return String(token || '')
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/^Bot\s+/i, '')
}
config.TOKEN = resolveBotToken();
client.config.TOKEN = config.TOKEN;
if (config.TOKEN) client.rest.setToken(config.TOKEN);
>>>>>>> 40fc381 (added many things)

(async () => {
    try {
        console.log('Initializing Mongoose...');
        await client.initializeMongoose();
        console.log('Mongoose initialized successfully.');

        console.log('Initializing data...');
        await client.initializedata();
        console.log('Data initialized successfully.');

        console.log('Waiting for 3 seconds...');
        await wait(3000);
        console.log('Wait complete.');

        console.log('Loading events...');
        const events = await client.loadEvents();
        console.log(`Loaded events: ${events}`);

        console.log('Loading logs...');
        const logs = await client.loadlogs();
        console.log(`Loaded logs: ${logs}`);

        console.log('Loading main functionality...');
        await client.loadMain();
        console.log('Main functionality loaded.');

        console.log('Logging in the client...');
        if (!config.TOKEN) throw new Error('Missing TOKEN. Add it to your .env file.');
        await client.login(config.TOKEN);
        console.log('Client logged in successfully.');
    } catch (error) {
        console.error('An error occurred during initialization:', error);
    }
})();
