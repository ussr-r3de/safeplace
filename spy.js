module.exports = (client) => {
  const {
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    Collection,
    PermissionsBitField
  } = require('discord.js');

  const CHANNEL_ID = '1376613830209310771';
  const joinTimeout = 60000;
  const autoStartDelay = 30000;
  const voteDuration = 5 * 60 * 1000;
  const minPlayers = 3;

  const CONTROL_ROLE_ID = '1375900541950890124';
  const ROLE_IDS = {
    spyMaster: '1376967526738821235',
    susDetector: '1376967661774180483'
  };

  let game = {
    isRunning: false,
    players: new Collection(),
    joinMessage: null,
    joinTimeout: null,
    autoStartTimer: null,
    votes: new Map(),
    wordPacks: {
      default: ['Cat', 'Dog', 'Car', 'Banana', 'Tree']
    },
    selectedPack: 'default',
    blacklist: new Set()
  };

  let stats = new Map();

  const achievements = [
    { name: 'Spy Master', condition: (s) => s.spyWins >= 3, roleId: ROLE_IDS.spyMaster },
    { name: 'Sus Detector', condition: (s) => s.spyCatches >= 5, roleId: ROLE_IDS.susDetector }
  ];

  const funnyGifs = [
    'https://media.giphy.com/media/3og0IPxMM0erATueVW/giphy.gif',
    'https://media.giphy.com/media/fAnEC88LccN7a/giphy.gif',
    'https://media.giphy.com/media/3o6ZtaO9BZHcOjmErm/giphy.gif'
  ];

  client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
      if (interaction.customId === 'join_game') {
        if (!game.isRunning) return interaction.reply({ content: '❌ No active game.', ephemeral: true });
        if (game.players.has(interaction.user.id)) return interaction.reply({ content: '❌ Already joined.', ephemeral: true });
        if (game.blacklist.has(interaction.user.id)) return interaction.reply({ content: '🚫 You are blacklisted.', ephemeral: true });

        game.players.set(interaction.user.id, interaction.user);
        await interaction.deferUpdate();

        const playerList = [...game.players.values()].map(p => `• ${p.username}`).join('\n');
        const embed = EmbedBuilder.from(game.joinMessage.embeds[0])
          .setDescription(`Click the button to join!\n\n**Joined players (${game.players.size}):**\n${playerList}`);
        await game.joinMessage.edit({ embeds: [embed] });

        if (game.players.size >= minPlayers && !game.autoStartTimer) {
          const channel = await client.channels.fetch(CHANNEL_ID);
          channel.send(`🚀 Enough players! Game starts in ${autoStartDelay / 1000}s.`);
          game.autoStartTimer = setTimeout(() => startGame(), autoStartDelay);
        }
      }

      if (interaction.customId.startsWith('vote_')) {
        if (!game.players.has(interaction.user.id)) return interaction.reply({ content: '❌ You can\'t vote.', ephemeral: true });

        const votedId = interaction.customId.split('_')[1];
        if (!game.players.has(votedId)) return interaction.reply({ content: '❌ Invalid vote.', ephemeral: true });

        game.votes.set(interaction.user.id, votedId);
        await interaction.reply({ content: `🗳️ Voted for <@${votedId}>.`, ephemeral: true });
      }

      if (interaction.customId === 'play_again') {
        if (game.isRunning) {
          return interaction.reply({ content: '❌ A game is already running.', ephemeral: true });
        }

        await interaction.deferUpdate();
        const fakeMessage = {
          content: '!start',
          member: interaction.member,
          author: interaction.user
        };
        client.emit('messageCreate', fakeMessage);
      }
    }
  });

  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const member = message.member;
    const isController = member.roles.cache.has(CONTROL_ROLE_ID);
    const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

    if (message.content.startsWith('!start') && !game.isRunning) {
      game.isRunning = true;
      game.players = new Collection();
      game.votes = new Map();

      const vc = member.voice.channel;
      if (vc) vc.members.forEach(m => {
        if (!game.blacklist.has(m.user.id)) game.players.set(m.user.id, m.user);
      });

      const joinButton = new ButtonBuilder()
        .setCustomId('join_game')
        .setLabel('Join Game')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(joinButton);
      const embed = new EmbedBuilder()
        .setTitle('🎮 برا السالفة | Spy Game')
        .setDescription(`Click to join!\n\n**Joined players (${game.players.size}):**\n${[...game.players.values()].map(p => `• ${p.username}`).join('\n') || '_ _'}`)
        .setColor('Blue')
        .setImage('https://cdn.discordapp.com/attachments/1375898595869458492/1377014216883699872/c7033814c7d40599.jpg');

      const channel = await client.channels.fetch(CHANNEL_ID);
      game.joinMessage = await channel.send({ embeds: [embed], components: [row] });

      game.joinTimeout = setTimeout(() => {
        if (game.players.size < minPlayers) {
          channel.send('❌ Game canceled (not enough players).');
          resetGame();
        }
      }, joinTimeout);
    }

    if (message.content.startsWith('!cancel') && game.isRunning) {
      resetGame();
      message.channel.send('🚫 Game canceled.');
    }

    if (message.content.startsWith('!forcestart') && isAdmin && game.players.size >= minPlayers) {
      message.channel.send('🚀 Admin forced game start.');
      startGame();
    }

    if (message.content.startsWith('!blacklist') && isController) {
      const id = message.mentions.users.first()?.id;
      if (!id) return message.reply('❌ Mention a user.');
      game.blacklist.add(id);
      message.reply(`<@${id}> has been blacklisted.`);
    }

    if (message.content.startsWith('!whitelist') && isController) {
      const id = message.mentions.users.first()?.id;
      if (!id) return message.reply('❌ Mention a user.');
      game.blacklist.delete(id);
      message.reply(`<@${id}> has been removed from blacklist.`);
    }

    if (message.content.startsWith('!addpack') && isController) {
      const [_, name, ...words] = message.content.split(/\s+/);
      if (!name || words.length < 2) return message.reply('❌ Format: `!addpack packname word1 word2 ...`');
      game.wordPacks[name] = words;
      message.reply(`✅ Word pack \`${name}\` added with ${words.length} words.`);
    }

    if (message.content.startsWith('!listpacks') && isController) {
      const packs = Object.keys(game.wordPacks).map(p => `• ${p}`).join('\n');
      message.reply(`📦 Available word packs:\n${packs}`);
    }

    if (message.content.startsWith('!mystats')) {
      const s = stats.get(message.author.id) || { spyWins: 0, spyCatches: 0 };
      message.reply(`📊 Stats for ${message.author.username}:\n🕵️ Spy Wins: ${s.spyWins}\n🧐 Spies Caught: ${s.spyCatches}`);
    }

    if (message.content.startsWith('!leaderboard')) {
      const sorted = [...stats.entries()].sort(([, a], [, b]) => (b.spyWins + b.spyCatches) - (a.spyWins + a.spyCatches));
      const top = sorted.slice(0, 10).map(([id, s], i) => `${i + 1}. <@${id}> - 🕵️ ${s.spyWins} | 🧐 ${s.spyCatches}`).join('\n');
      message.channel.send(`🏆 **Leaderboard:**\n${top}`);
    }

    if (message.content.startsWith('!help')) {
      message.reply(
        '**🆘 Spy Game Bot Commands:**\n' +
        '`!start` - Start a new game\n' +
        '`!cancel` - Cancel the current game\n' +
        '`!forcestart` - Force start the game (admin only)\n' +
        '`!addpack` - Add custom word pack (controller only)\n' +
        '`!listpacks` - List word packs (controller only)\n' +
        '`!blacklist @user` - Blacklist player (controller only)\n' +
        '`!whitelist @user` - Remove from blacklist (controller only)\n' +
        '`!mystats` - View your stats\n' +
        '`!leaderboard` - View leaderboard\n' +
        '`!help` - Show this help message'
      );
    }
  });

  async function startGame() {
    const players = Array.from(game.players.values());
    const spy = players[Math.floor(Math.random() * players.length)];
    const subjects = game.wordPacks[game.selectedPack] || game.wordPacks.default;
    const subject = subjects[Math.floor(Math.random() * subjects.length)];

    for (const player of players) {
      try {
        await player.send(player.id === spy.id ? '🕵️ You are the SPY!' : `🧠 Subject: **${subject}**`);
      } catch {}
    }

    const voteEmbed = new EmbedBuilder()
      .setTitle('🗳️ Vote for the Spy')
      .setDescription(players.map(p => `• ${p.username}`).join('\n'))
      .setColor('Red');

    const styles = [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger];
    const rows = [];

    for (let i = 0; i < players.length; i += 5) {
      const row = new ActionRowBuilder();
      players.slice(i, i + 5).forEach(p => {
        row.addComponents(new ButtonBuilder()
          .setCustomId(`vote_${p.id}`)
          .setLabel(p.username)
          .setStyle(styles[Math.floor(Math.random() * styles.length)])
        );
      });
      rows.push(row);
    }

    const channel = await client.channels.fetch(CHANNEL_ID);
    await channel.send({ embeds: [voteEmbed], components: rows });

    setTimeout(() => endVoting(channel, spy.id), voteDuration);
  }

  async function endVoting(channel, spyId) {
    const voteCounts = {};
    for (const voted of game.votes.values()) {
      voteCounts[voted] = (voteCounts[voted] || 0) + 1;
    }

    const votedMost = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const spyCaught = votedMost === spyId;
    const gif = funnyGifs[Math.floor(Math.random() * funnyGifs.length)];

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('play_again')
        .setLabel('🔁 Play Again')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({
      content: `🎉 Game ended! Most voted: <@${votedMost}>\n${spyCaught ? 'They were the SPY! 🕵️‍♂️' : 'They were NOT the spy. 😬'}\n${gif}`,
      components: [row]
    });

    for (const [uid] of game.players) {
      const s = stats.get(uid) || { spyWins: 0, spyCatches: 0 };
      if (uid === spyId && !spyCaught) s.spyWins++;
      if (uid === votedMost && spyCaught) s.spyCatches++;
      stats.set(uid, s);

      const member = await channel.guild.members.fetch(uid).catch(() => null);
      if (!member) continue;

      for (const ach of achievements) {
        if (ach.condition(s)) {
          const roleId = ach.roleId;
          const role = channel.guild.roles.cache.get(roleId);
          if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role);
          }
        }
      }
    }

    resetGame();
  }

  function resetGame() {
    if (game.joinTimeout) clearTimeout(game.joinTimeout);
    if (game.autoStartTimer) clearTimeout(game.autoStartTimer);
    game.isRunning = false;
    game.players.clear();
    game.votes.clear();
    game.joinMessage = null;
  }
};
