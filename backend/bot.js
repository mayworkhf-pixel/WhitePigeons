const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./database');
const axios = require('axios');

let client = null;
let ioInstance = null; // Socket.io reference to broadcast simulated logs

const botService = {
  setIo: (io) => {
    ioInstance = io;
  },

  isReady: () => {
    return client && client.readyAt !== null;
  },

  // Initialize the Discord Bot Client
  init: async () => {
    const config = await db.getConfig();
    if (!config.botToken || !config.guildId) {
      botService.logSimulated('Bot credentials missing. Running in Mock/Simulated Mode.');
      return false;
    }

    try {
      client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent
        ]
      });

      client.once('ready', () => {
        console.log(`[Bot] Connected as ${client.user.tag}`);
        botService.logSimulated(`Discord Bot Connected live as ${client.user.tag}`);
      });

      client.on('error', (err) => {
        console.error('[Bot] Client Error:', err);
        botService.logSimulated(`Bot Connection Error: ${err.message}`);
      });

      client.on('messageCreate', (message) => {
        if (message.author.bot) return;
        botService.logSimulated(`Message in #${message.channel.name} by @${message.author.username}: "${message.content}"`);
      });

      // Simple listener for discord interactions (like buttons)
      client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        
        // Handle signup buttons
        if (interaction.customId.startsWith('signup:')) {
          const eventId = interaction.customId.split(':')[1];
          const discordId = interaction.user.id;
          const username = interaction.user.username;
          
          // Check guild roles for Top 10 and Member
          const member = await interaction.guild.members.fetch(discordId).catch(() => null);
          const isTop10 = member ? member.roles.cache.some(r => r.name.toLowerCase().includes('top 10') || r.name.toLowerCase().includes('top-10')) : false;

          // Process signup in DB
          const result = await db.createSignup(eventId, discordId, username, isTop10);
          
          if (result.success) {
            // Update website via Socket.io
            if (ioInstance) {
              ioInstance.emit('signup_change', { eventId, signups: await db.getSignups(eventId) });
              ioInstance.emit('system_notification', {
                title: 'Discord Sign Up',
                message: `${username} signed up via Discord!`,
                type: 'info'
              });
            }

            if (result.action === 'confirmed') {
              await interaction.reply({ content: `✅ Spot confirmed! Status: Confirmed.`, ephemeral: true });
            } else if (result.action === 'displaced') {
              await interaction.reply({ content: `🔥 Spot confirmed! As a Top 10 shooter, you displaced the latest non-Top 10 signup.`, ephemeral: true });
              // Alert displaced user via DM if possible
              if (result.displaced) {
                botService.sendDirectMessage(
                  result.displaced.memberId, 
                  `⚠️ You have been displaced from the **${eventId === 'rp-signup' ? 'RP Signup' : 'Informal Signup'}** queue by a Top 10 member. You are now in the reserve list.`
                );
              }
            } else {
              await interaction.reply({ content: `⏳ Queue full. You are on the Reserve List.`, ephemeral: true });
            }
          } else {
            await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
          }
        }
      });

      await client.login(config.botToken);
      return true;
    } catch (err) {
      console.error('[Bot] Failed to login Discord Bot:', err.message);
      botService.logSimulated(`Failed to connect Discord Bot: ${err.message}. Running in Mock Mode.`);
      client = null;
      return false;
    }
  },

  // Helper to log actions on the website & terminal
  logSimulated: (message) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[Discord Simulator] [${timestamp}] ${message}`);
    if (ioInstance) {
      ioInstance.emit('simulated_log', {
        timestamp: new Date().toISOString(),
        message
      });
    }
  },

  // Test webhook endpoint URL
  testWebhook: async (webhookUrl, channelName) => {
    if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      return { success: false, message: 'Invalid Webhook format.' };
    }
    try {
      await axios.post(webhookUrl, {
        embeds: [{
          title: 'White Pigeon Command Hub - Connection Test',
          description: `Successfully linked web tab with the **#${channelName}** Discord channel!`,
          color: 0xff007f, // Neon Magenta
          footer: { text: 'White Pigeon Integration Engine' },
          timestamp: new Date().toISOString()
        }]
      });
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // Send an Embed message to a specific channel's configured webhook
  sendWebhook: async (channelKey, embedData) => {
    const config = await db.getConfig();
    const webhookUrl = config.webhooks ? config.webhooks[channelKey] : null;

    if (!webhookUrl) {
      botService.logSimulated(`[Webhook MOCK] Channel #${channelKey} (Webhook URL empty). Embed: "${embedData.title || ''} - ${embedData.description || ''}"`);
      return false;
    }

    try {
      await axios.post(webhookUrl, {
        embeds: [{
          title: embedData.title,
          description: embedData.description,
          color: embedData.color || 0xff007f,
          fields: embedData.fields || [],
          image: embedData.image ? { url: embedData.image } : null,
          footer: { text: 'White Pigeon Command Hub' },
          timestamp: new Date().toISOString()
        }]
      });
      botService.logSimulated(`Successfully fired webhook to #${channelKey} Discord channel.`);
      return true;
    } catch (err) {
      console.error(`[Bot] Webhook error on channel #${channelKey}:`, err.message);
      botService.logSimulated(`[Webhook Error] Channel #${channelKey}: ${err.message}. Fallback to simulated log.`);
      return false;
    }
  },

  // Send DM to a user via Discord Bot
  sendDirectMessage: async (discordId, text) => {
    if (!client) {
      botService.logSimulated(`[DM MOCK] Send DM to Discord ID (${discordId}): "${text}"`);
      return false;
    }
    try {
      const user = await client.users.fetch(discordId);
      if (user) {
        await user.send(text);
        botService.logSimulated(`Sent DM to user @${user.username} (${discordId}).`);
        return true;
      }
    } catch (err) {
      console.error('[Bot] Failed to send DM:', err.message);
      botService.logSimulated(`[DM Failed] Could not DM user (${discordId}): ${err.message}`);
    }
    return false;
  },

  // Update member nicknames and roles inside the server
  updateMemberNicknameAndRoles: async (discordId, nickname, rolesToGrant = [], rolesToRemove = []) => {
    const config = await db.getConfig();
    if (!client || !config.guildId) {
      botService.logSimulated(`[Roles MOCK] Update Discord ID (${discordId}): Nickname: "${nickname}", Grant Roles: [${rolesToGrant.join(', ')}], Revoke Roles: [${rolesToRemove.join(', ')}]`);
      return false;
    }

    try {
      const guild = await client.guilds.fetch(config.guildId);
      if (!guild) {
        botService.logSimulated(`Guild not found: ${config.guildId}`);
        return false;
      }

      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member) {
        botService.logSimulated(`User ID ${discordId} is not a member of the configured server.`);
        return false;
      }

      // Update nickname
      if (nickname) {
        await member.setNickname(nickname);
        botService.logSimulated(`Updated nickname for @${member.user.username} to "${nickname}".`);
      }

      // Handle Roles
      for (const roleName of rolesToGrant) {
        const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        if (role) {
          await member.roles.add(role);
          botService.logSimulated(`Granted role "${role.name}" to @${member.user.username}.`);
        } else {
          botService.logSimulated(`Role "${roleName}" not found in Discord server.`);
        }
      }

      for (const roleName of rolesToRemove) {
        const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        if (role) {
          await member.roles.remove(role);
          botService.logSimulated(`Revoke role "${role.name}" from @${member.user.username}.`);
        }
      }

      return true;
    } catch (err) {
      console.error('[Bot] Failed to adjust guild member roles/nickname:', err.message);
      botService.logSimulated(`[Guild Sync Error] Failed to update member (${discordId}): ${err.message}`);
    }
    return false;
  },

  // Trigger automated RP Sign Up window in Discord
  triggerEventSignup: async (eventId, title, description, durationMinutes = 15) => {
    botService.logSimulated(`Fired Event Signup: "${title}" for event ID "${eventId}"`);

    // Webhook Embed
    const embed = {
      title: `⏰ WHITE PIGEON - EVENT SIGN UP OPEN!`,
      description: `**Event:** ${title}\n**Details:** ${description}\n\n*First 25 players to sign up secure a spot. Top 10 priorities apply.*`,
      color: 0x00f0ff // Neon Cyan
    };

    // If bot client is connected, we can send a rich button message
    const config = await db.getConfig();
    const webhookUrl = config.webhooks ? config.webhooks['rp-signup'] : null;

    if (client && webhookUrl) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        const channel = guild.channels.cache.find(c => c.name.includes('signup'));
        if (channel) {
          const embedBuilder = new EmbedBuilder()
            .setTitle(embed.title)
            .setDescription(embed.description)
            .setColor(0x00f0ff)
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`signup:${eventId}`)
              .setLabel('⚔️ SIGN UP')
              .setStyle(ButtonStyle.Success)
          );

          await channel.send({ embeds: [embedBuilder], components: [row] });
          botService.logSimulated(`Fired interactive signup embed to Discord channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Interactive button send failed, fallback to webhook:', err.message);
      }
    }

    // Fallback: send simple webhook
    await botService.sendWebhook('rp-signup', embed);
    return true;
  }
};

module.exports = botService;
