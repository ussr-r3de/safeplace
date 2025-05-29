module.exports = (client) => {
  const { joinVoiceChannel } = require('@discordjs/voice');
  const GUILD_ID = '1212805656436805673';
  const VOICE_CHANNEL_ID = '1376576893259616266';

  client.on('messageCreate', async (message) => {
    if (message.content === '!joinroom') {
      try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

        if (!channel || channel.type !== 2) {
          return message.reply("❌ Voice channel not found or invalid type.");
        }

        joinVoiceChannel({
          channelId: channel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: true,
        });

        message.reply(`✅ Joined voice channel: ${channel.name} and will stay forever.`);
      } catch (err) {
        console.error(err);
        message.reply("❌ Failed to join the voice channel.");
      }
    }
  });
};