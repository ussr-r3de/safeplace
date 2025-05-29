const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { token } = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

require('./dispute')(client);
require('./message')(client);
require('./spy')(client);
require('./voice')(client);

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(token);