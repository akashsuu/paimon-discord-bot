const { ClusterManager , HeartbeatManager } = require('discord-hybrid-sharding');
require('dotenv').config();
const config = require('./config.json')
config.TOKEN = process.env.TOKEN || config.TOKEN;
if (!config.TOKEN) throw new Error('Missing TOKEN. Add it to your .env file.');

const manager = new ClusterManager(`${__dirname}/index.js`, {
    totalShards: 2,
    shardsPerClusters: 2,
     totalClusters: 2,
    mode: 'process', 
    token: config.TOKEN,
});

manager.on('clusterCreate', cluster => console.log(`Launched Cluster ${cluster.id}`));
manager.spawn({ timeout: -1 });
manager.extend(
    new HeartbeatManager({
        interval: 2000,
        maxMissedHeartbeats: 5, 
    })
)
