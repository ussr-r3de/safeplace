module.exports = (client) => {
  const { EmbedBuilder } = require('discord.js');
  const FORWARD_CHANNEL_ID = '1377031675447476286';

  client.on('messageCreate', async (message) => {
    if (message.guild === null && !message.author.bot) {
      try {
        const logChannel = await client.channels.fetch(FORWARD_CHANNEL_ID);
        if (!logChannel || !logChannel.isTextBased()) return;

        const embed = new EmbedBuilder()
          .setTitle('📩 New DM Received')
          .addFields(
            { name: 'From', value: `${message.author.tag} (${message.author.id})`, inline: false },
            { name: 'Message', value: message.content || '[No content]', inline: false }
          )
          .setColor('Blue')
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });

        if (message.attachments.size > 0) {
          for (const attachment of message.attachments.values()) {
            await logChannel.send({ content: `📎 Attachment from ${message.author.tag}:`, files: [attachment.url] });
          }
        }
      } catch (err) {
        console.error('Failed to forward DM:', err);
      }
      return;
    }

    if (message.content.startsWith('!dm') && !message.author.bot) {
      const args = message.content.split(' ').slice(1);
      const userIdOrMention = args.shift();
      const dmMessage = args.join(' ');

      if (!userIdOrMention || !dmMessage) {
        return message.reply('Usage: `!dm <userID or @mention> <message>`');
      }

      const userId = userIdOrMention.replace(/[<@!>]/g, '');

      try {
        const user = await client.users.fetch(userId);
        await user.send(dmMessage);
        message.reply(`✅ Message sent to ${user.tag}`);
      } catch (error) {
        console.error(error);
        message.reply('❌ Could not send the message. Make sure the user ID is valid and DMs are enabled.');
      }
    }
  });
};
