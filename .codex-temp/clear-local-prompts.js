require('dotenv').config();
const { Database } = require('quickmongo');
(async () => {
  const db = new Database(process.env.MONGO_DB);
  await db.connect();
  const all = await db.all();
  const keys = all.map((item) => item.id || item.ID).filter((key) => key && key.startsWith('local_chatbot_prompt_'));
  for (const key of keys) await db.delete(key);
  console.log('deleted_prompt_keys=' + keys.length);
  process.exit(0);
})().catch((err) => { console.error(err.message); process.exit(1); });
