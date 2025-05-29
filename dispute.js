module.exports = (client) => {
  const { disputeChannelId, logChannelId } = require('./config.json');
  const { Events } = require('discord.js');
  const PREFIX = '+';
  const disputes = new Set();
  const stats = {};

  client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    async function getTargetMember(input) {
      let member = message.mentions.members.first();
      if (!member && input) {
        try {
          member = await message.guild.members.fetch(input);
        } catch {
          return null;
        }
      }
      return member;
    }

    if (command === 'dispute') {
      const target = await getTargetMember(args[0]);
      if (!target) return message.reply('❌ You must mention a user or provide a valid user ID.');
      if (target.id === message.author.id) return message.reply('❌ You cannot dispute yourself.');

      disputes.add(`${message.author.id}-${target.id}`);
      disputes.add(`${target.id}-${message.author.id}`);

      stats[message.author.id] = stats[message.author.id] || { started: 0, received: 0 };
      stats[target.id] = stats[target.id] || { started: 0, received: 0 };
      stats[message.author.id].started++;
      stats[target.id].received++;

      message.reply(`⚠️ You are now in a dispute with ${target.user.tag}. You cannot join the same voice channel.`);

      const logChannel = message.guild.channels.cache.get(logChannelId);
      if (logChannel) {
        logChannel.send(`📝 ${message.author.tag} started a dispute with ${target.user.tag}.`);
      }

      if (target.voice.channel && target.voice.channel.id !== disputeChannelId) {
        try {
          await target.voice.setChannel(disputeChannelId);
          message.channel.send(`🚫 ${target.user.tag} has been moved to the dispute channel.`);
        } catch (error) {
          console.error(error);
          message.channel.send(`❌ Couldn't move ${target.user.tag}.`);
        }
      }
    }

    if (command === 'undispute') {
      const target = await getTargetMember(args[0]);
      if (!target) return message.reply('❌ You must mention a user or provide a valid user ID.');

      disputes.delete(`${message.author.id}-${target.id}`);
      disputes.delete(`${target.id}-${message.author.id}`);

      message.reply(`✅ Dispute with ${target.user.tag} has been resolved.`);

      const logChannel = message.guild.channels.cache.get(logChannelId);
      if (logChannel) {
        logChannel.send(`✅ ${message.author.tag} ended a dispute with ${target.user.tag}.`);
      }
    }

    if (command === 'disputelist') {
      if (disputes.size === 0) return message.reply('📭 No active disputes.');

      const shownPairs = new Set();
      const lines = [];

      for (let key of disputes) {
        const [id1, id2] = key.split('-');
        const pairKey = [id1, id2].sort().join('-');
        if (shownPairs.has(pairKey)) continue;
        shownPairs.add(pairKey);

        try {
          const user1 = await message.guild.members.fetch(id1);
          const user2 = await message.guild.members.fetch(id2);
          lines.push(`• ${user1.user.tag} 🆚 ${user2.user.tag}`);
        } catch {
          lines.push(`• <@${id1}> 🆚 <@${id2}>`);
        }
      }

      message.channel.send({ content: `📋 **Active Disputes:**\n${lines.join('\n')}` });
    }

    if (command === 'disputestats') {
      const target = await getTargetMember(args[0]) || message.member;
      const stat = stats[target.id];

      if (!stat) return message.reply(`📊 No stats found for ${target.user.tag}.`);

      message.reply(`📈 Dispute Stats for **${target.user.tag}**:\n• Started: ${stat.started}\n• Received: ${stat.received}`);
    }
  });

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const members = newState.channel?.members;
    if (!members || members.size < 2) return;

    members.forEach(member1 => {
      members.forEach(member2 => {
        if (
          member1.id !== member2.id &&
          disputes.has(`${member1.id}-${member2.id}`)
        ) {
          member2.voice.disconnect()
            .then(() => console.log(`⛔ Kicked ${member2.user.tag} due to dispute with ${member1.user.tag}`))
            .catch(console.error);
        }
      });
    });
  });
};
