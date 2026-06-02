const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
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

  broadcastSocket: (event, data) => {
    if (ioInstance) {
      ioInstance.emit(event, data);
      return true;
    }
    return false;
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

      // Discord interaction listener for components and modals
      client.on('interactionCreate', async (interaction) => {
        // 1. Button interactions
        if (interaction.isButton()) {
          const customId = interaction.customId;
          
          if (customId === 'trigger_role_request') {
            const modal = new ModalBuilder()
              .setCustomId('role_request_modal')
              .setTitle('Role Request Form');

            const nameInput = new TextInputBuilder()
              .setCustomId('modal_name')
              .setLabel('Your Name (In-game name)')
              .setPlaceholder('Enter your in-game name')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const charIdInput = new TextInputBuilder()
              .setCustomId('modal_char_id')
              .setLabel('Your ID')
              .setPlaceholder('Enter your character ID')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const levelInput = new TextInputBuilder()
              .setCustomId('modal_level')
              .setLabel('Level in City')
              .setPlaceholder('Enter your current level')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const rankInput = new TextInputBuilder()
              .setCustomId('modal_rank')
              .setLabel('Rank in Family')
              .setPlaceholder('Enter your desired rank')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const forumInput = new TextInputBuilder()
              .setCustomId('modal_forum')
              .setLabel('Forum Account Link')
              .setPlaceholder('Enter your forum account Link')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            modal.addComponents(
              new ActionRowBuilder().addComponents(nameInput),
              new ActionRowBuilder().addComponents(charIdInput),
              new ActionRowBuilder().addComponents(levelInput),
              new ActionRowBuilder().addComponents(rankInput),
              new ActionRowBuilder().addComponents(forumInput)
            );

            await interaction.showModal(modal);
          }
          
          else if (customId.startsWith('role_approve:')) {
            const requestId = customId.split(':')[1];
            const reqs = await db.getRoleRequests();
            const reqObj = reqs.find(r => r.id === requestId);
            if (!reqObj) {
              return interaction.reply({ content: '❌ Role request not found in database.', ephemeral: true });
            }
            if (reqObj.status !== 'pending') {
              return interaction.reply({ content: `❌ This request has already been reviewed (${reqObj.status}).`, ephemeral: true });
            }
            
            const selected = reqObj.selectedRoles || [];
            if (selected.length === 0) {
              return interaction.reply({ content: '⚠️ Please select at least one role from the dropdown first before approving.', ephemeral: true });
            }
            
            const roleToGrant = selected.join(', ');
            const nickname = `WP | ${reqObj.inGameName}`;

            await db.updateRoleRequest(requestId, {
              status: 'approved',
              reviewer: interaction.user.username,
              roleToGrant
            });

            const member = await db.getMember(reqObj.discordId);
            const currentRoles = member ? (member.roles || []) : [];
            selected.forEach(r => {
              if (!currentRoles.includes(r)) currentRoles.push(r);
            });
            
            const hasTop10 = selected.some(r => r.toLowerCase().includes('top 10') || r.toLowerCase().includes('top-10'));
            
            if (member) {
              await db.updateMember(reqObj.discordId, {
                nickname,
                roles: currentRoles,
                isTop10: hasTop10 ? true : member.isTop10
              });
            } else {
              await db.createMember({
                discordId: reqObj.discordId,
                username: reqObj.username,
                nickname,
                roles: currentRoles,
                isTop10: hasTop10,
                balance: 0,
                kills: 0,
                points: 0
              });
            }

            await botService.updateMemberNicknameAndRoles(reqObj.discordId, nickname, selected, []);
            await botService.sendDirectMessage(reqObj.discordId, `🎉 Your role request for **${roleToGrant}** was approved! Nickname updated to: ${nickname}.`);

            const approvedEmbed = await botService.buildRoleReviewEmbed(requestId);
            await interaction.message.edit({ embeds: [approvedEmbed], components: [] });
            await interaction.reply({ content: '✅ Role request approved and roles assigned.', ephemeral: true });

            botService.broadcastSocket('role_requests_update', await db.getRoleRequests());
          }
          
          else if (customId.startsWith('role_reject:')) {
            const requestId = customId.split(':')[1];
            const reqs = await db.getRoleRequests();
            const reqObj = reqs.find(r => r.id === requestId);
            if (!reqObj) {
              return interaction.reply({ content: '❌ Role request not found in database.', ephemeral: true });
            }
            if (reqObj.status !== 'pending') {
              return interaction.reply({ content: `❌ This request has already been reviewed (${reqObj.status}).`, ephemeral: true });
            }

            await db.updateRoleRequest(requestId, {
              status: 'rejected',
              reviewer: interaction.user.username
            });

            await botService.sendDirectMessage(reqObj.discordId, `⚠️ Your role request was declined. Reason: Disapproved by leadership.`);

            const rejectedEmbed = await botService.buildRoleReviewEmbed(requestId);
            await interaction.message.edit({ embeds: [rejectedEmbed], components: [] });
            await interaction.reply({ content: '❌ Role request rejected.', ephemeral: true });

            botService.broadcastSocket('role_requests_update', await db.getRoleRequests());
          }

          else if (customId.startsWith('signup:')) {
            const eventId = customId.split(':')[1];
            const discordId = interaction.user.id;
            const username = interaction.user.username;
            
            const member = await interaction.guild.members.fetch(discordId).catch(() => null);
            const isTop10 = member ? member.roles.cache.some(r => r.name.toLowerCase().includes('top 10') || r.name.toLowerCase().includes('top-10')) : false;

            const result = await db.createSignup(eventId, discordId, username, isTop10);
            
            if (result.success) {
              try {
                const originalEmbed = interaction.message.embeds[0];
                const descriptionMatch = originalEmbed.description.match(/\*\*Event Directives:\*\*\n([\s\S]+?)\n\n\*\*Status:\*\*/);
                const directives = descriptionMatch ? descriptionMatch[1] : '';
                
                const updatedEmbed = await botService.buildSignupEmbed(eventId, originalEmbed.title, directives, false);
                await interaction.message.edit({ embeds: [updatedEmbed] });
              } catch (err) {
                console.error('[Bot] Failed to edit live roster message:', err.message);
              }

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
        }

        // 2. Modal submissions
        else if (interaction.isModalSubmit()) {
          if (interaction.customId === 'role_request_modal') {
            const inGameName = interaction.fields.getTextInputValue('modal_name');
            const characterId = interaction.fields.getTextInputValue('modal_char_id');
            const level = interaction.fields.getTextInputValue('modal_level');
            const rank = interaction.fields.getTextInputValue('modal_rank');
            const forumLink = interaction.fields.getTextInputValue('modal_forum');

            const reqData = {
              discordId: interaction.user.id,
              username: interaction.user.username,
              inGameName,
              characterId,
              level,
              rank,
              forumLink,
              status: 'pending',
              selectedRoles: []
            };

            const newRequest = await db.createRoleRequest(reqData);
            await botService.sendRoleReviewNotification(newRequest);
            await interaction.reply({ content: '✅ Your role request form was submitted successfully and is under review.', ephemeral: true });

            botService.broadcastSocket('role_requests_update', await db.getRoleRequests());
          }
        }

        // 3. Select menu interactions
        else if (interaction.isStringSelectMenu()) {
          if (interaction.customId.startsWith('role_select:')) {
            const requestId = interaction.customId.split(':')[1];
            const selectedRoles = interaction.values;

            await db.updateRoleRequest(requestId, { selectedRoles });

            const updatedEmbed = await botService.buildRoleReviewEmbed(requestId);
            await interaction.update({ embeds: [updatedEmbed] });
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

  // Build a complete, live updating signup embed list matching reference layout
  buildSignupEmbed: async (eventId, title, description, isClosed = false) => {
    const signups = await db.getSignups(eventId);
    const confirmed = signups.filter(s => s.status === 'confirmed');
    const reserve = signups.filter(s => s.status === 'reserve' || s.status === 'displaced');

    const mainRosterLines = confirmed.map((s, idx) => {
      const icon = s.isTop10 ? '👑' : '⚔️';
      return `**${idx + 1}.** ${icon} <@${s.memberId}> ✅`;
    });

    const reserveLines = reserve.map((s, idx) => {
      const icon = s.isTop10 ? '👑' : '⚔️';
      return `**${idx + 1}.** ${icon} <@${s.memberId}>`;
    });

    const statusBadge = isClosed ? '🔴 **Registration is closed!**' : '🟢 **Registration is active!**';
    const embedColor = isClosed ? 0xff003c : 0x00f0ff;

    const embedDescription = [
      `**Event Directives:**\n${description}\n`,
      statusBadge,
      `**Participants:** ${confirmed.length}/25\n`,
      `**Main Roster:**`,
      mainRosterLines.length > 0 ? mainRosterLines.join('\n') : '*Roster is vacant. Claim a slot!*',
      `\n**Subs List:**`,
      reserveLines.length > 0 ? reserveLines.join('\n') : '*No substitutes yet.*',
      `\nHave fun! 🎉`
    ].join('\n');

    const bannerImage = eventId === 'rp-signup'
      ? 'https://whitepigeons-35431.web.app/rp_ticket_banner.png'
      : 'https://whitepigeons-35431.web.app/informal_fight_banner.png';

    const embed = new EmbedBuilder()
      .setTitle(`🚀 ${eventId === 'rp-signup' ? 'RP Ticket' : 'Informal Fight'} - ${isClosed ? 'CLOSED' : 'OPEN'} ⚔️`)
      .setDescription(embedDescription)
      .setColor(embedColor)
      .setImage(bannerImage)
      .setTimestamp();

    return embed;
  },

  // Close an active signup message in Discord by removing components and setting to CLOSED style
  closeSignupMessage: async (eventId) => {
    if (!client) return;
    try {
      const config = await db.getConfig();
      const guild = await client.guilds.fetch(config.guildId);
      const channel = guild.channels.cache.find(c => c.name.includes('signup'));
      if (channel) {
        // Fetch last 15 messages in the channel to locate the active roster embed
        const messages = await channel.messages.fetch({ limit: 15 });
        const signupMessage = messages.find(m => {
          return m.author.id === client.user.id && 
                 m.embeds.length > 0 && 
                 m.embeds[0].title && 
                 m.embeds[0].title.includes(eventId === 'rp-signup' ? 'RP Ticket' : 'Informal Fight') &&
                 m.components.length > 0;
        });

        if (signupMessage) {
          const originalEmbed = signupMessage.embeds[0];
          const descriptionMatch = originalEmbed.description.match(/\*\*Event Directives:\*\*\n([\s\S]+?)\n\n/);
          const directives = descriptionMatch ? descriptionMatch[1] : '';

          const closedEmbed = await botService.buildSignupEmbed(eventId, originalEmbed.title, directives, true);
          await signupMessage.edit({ embeds: [closedEmbed], components: [] });
          botService.logSimulated(`Closed active signup message in Discord channel #${channel.name}`);
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to close signup message in Discord:', err.message);
    }
  },

  // Trigger automated RP Sign Up window in Discord
  triggerEventSignup: async (eventId, title, description, durationMinutes = 15) => {
    botService.logSimulated(`Fired Event Signup: "${title}" for event ID "${eventId}"`);

    // If bot client is connected, we can send a rich button message
    const config = await db.getConfig();
    const channelKey = eventId === 'rp-signup' ? 'rp-signup' : 'informal-signup';
    const webhookUrl = config.webhooks ? config.webhooks[channelKey] : null;

    if (client && webhookUrl) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        const channel = guild.channels.cache.find(c => c.name.includes('signup'));
        if (channel) {
          const embedBuilder = await botService.buildSignupEmbed(eventId, title, description, false);

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

    await botService.sendWebhook(channelKey, fallbackEmbed);
    return true;
  },

  // Build interactive role review embed matching screenshot format
  buildRoleReviewEmbed: async (requestId) => {
    const reqs = await db.getRoleRequests();
    const req = reqs.find(r => r.id === requestId);
    if (!req) return null;

    const formattedRoles = req.selectedRoles && req.selectedRoles.length > 0
      ? req.selectedRoles.map(r => `\`@${r}\``).join(', ')
      : '*None selected yet*';

    const embedColor = req.status === 'approved'
      ? 0x00ff00
      : req.status === 'rejected'
        ? 0xff0000
        : 0x00f0ff;

    const embed = new EmbedBuilder()
      .setTitle(`📋 ${req.status === 'approved' ? 'ROLE REQUEST APPROVED' : req.status === 'rejected' ? 'ROLE REQUEST REJECTED' : 'New Role Request'}`)
      .setDescription(req.status === 'pending' ? 'Select roles below and click Approve or Reject.' : `Status: **${req.status.toUpperCase()}** | Reviewed by: @${req.reviewer || 'Admin'}`)
      .setColor(embedColor)
      .addFields(
        { name: '👤 Applicant', value: `<@${req.discordId}>`, inline: true },
        { name: '🏷️ Username', value: req.username, inline: true },
        { name: '✍️ Name', value: req.inGameName, inline: true },
        { name: 'ID', value: req.characterId, inline: true },
        { name: 'Level in City', value: req.level, inline: true },
        { name: 'Rank in Family', value: req.rank, inline: true },
        { name: 'Forum Account Link', value: req.forumLink, inline: false },
        { name: '✅ Selected Roles to Give', value: formattedRoles, inline: false }
      )
      .setFooter({ text: `Request ID: ${req.id}` })
      .setTimestamp(new Date(req.requestedAt));

    return embed;
  },

  // Post interactive role review embed to reviewer Discord channel
  sendRoleReviewNotification: async (req) => {
    const config = await db.getConfig();
    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        const channel = guild.channels.cache.find(c => c.name.includes('review') || c.name.includes('rolereq'));
        if (channel) {
          const embed = await botService.buildRoleReviewEmbed(req.id);
          
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`role_select:${req.id}`)
            .setPlaceholder('Select roles to give (can select multiple)')
            .setMinValues(1)
            .setMaxValues(6)
            .addOptions([
              { label: 'Family Member', value: 'Family Member' },
              { label: 'Informal Role', value: 'Informal Role' },
              { label: 'Events Role', value: 'Events Role' },
              { label: 'RP Ticket Roaster', value: 'RP Ticket Roaster' },
              { label: 'Turfer', value: 'Turfer' },
              { label: 'Top 10', value: 'Top 10' },
              { label: 'Broski', value: 'Broski' }
            ]);

          const selectRow = new ActionRowBuilder().addComponents(selectMenu);

          const approveBtn = new ButtonBuilder()
            .setCustomId(`role_approve:${req.id}`)
            .setLabel('Approve & Give Roles')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');

          const rejectBtn = new ButtonBuilder()
            .setCustomId(`role_reject:${req.id}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌');

          const btnRow = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

          await channel.send({ embeds: [embed], components: [selectRow, btnRow] });
          botService.logSimulated(`Fired interactive role review embed for @${req.username} to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to send interactive role review:', err.message);
      }
    }

    // Fallback: send simple webhook
    const fallbackEmbed = {
      title: '📋 NEW ROLE REQUEST SUBMISSION',
      description: `A member has submitted a role request via White Pigeon Portal.`,
      color: 0x00f0ff,
      fields: [
        { name: 'Applicant', value: `<@${req.discordId}> (${req.username})`, inline: true },
        { name: 'Name', value: req.inGameName, inline: true },
        { name: 'ID', value: req.characterId, inline: true },
        { name: 'Level in City', value: req.level, inline: true },
        { name: 'Rank in Family', value: req.rank, inline: true },
        { name: 'Forum Link', value: req.forumLink, inline: false }
      ]
    };
    await botService.sendWebhook('role-request', fallbackEmbed);
    return true;
  },

  // Close active role review embed in Discord by removing components
  closeRoleReviewMessage: async (requestId, status, approvedRole) => {
    if (!client) return;
    try {
      const config = await db.getConfig();
      const guild = await client.guilds.fetch(config.guildId);
      const channel = guild.channels.cache.find(c => c.name.includes('review') || c.name.includes('rolereq'));
      if (channel) {
        const messages = await channel.messages.fetch({ limit: 30 });
        const reviewMessage = messages.find(m => {
          return m.author.id === client.user.id &&
                 m.embeds.length > 0 &&
                 m.embeds[0].footer &&
                 m.embeds[0].footer.text === `Request ID: ${requestId}`;
        });

        if (reviewMessage) {
          const closedEmbed = await botService.buildRoleReviewEmbed(requestId);
          await reviewMessage.edit({ embeds: [closedEmbed], components: [] });
          botService.logSimulated(`Closed active role review message for ID ${requestId} in Discord channel #${channel.name}`);
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to close role review message in Discord:', err.message);
    }
  },

  // Deploy the "Submit Role Request" button prompt in the #role-request channel
  deployRoleRequestPrompt: async () => {
    botService.logSimulated('Attempting to deploy Role Request prompt to Discord channel...');
    const config = await db.getConfig();
    
    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        const channel = guild.channels.cache.find(c => c.name.includes('request') || c.name.includes('role'));
        
        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('👑 Role Request Panel')
            .setDescription('Fill your data for the database and request active roles inside the White Pigeon family.\n\nClick the button below to open the role request submission form.')
            .setColor(0x00f0ff)
            .setFooter({ text: 'White Pigeon Roster Verification' });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('trigger_role_request')
              .setLabel('📝 Submit Role Request')
              .setStyle(ButtonStyle.Primary)
          );

          await channel.send({ embeds: [embed], components: [row] });
          botService.logSimulated(`Successfully deployed interactive Submission panel to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy role request prompt:', err.message);
      }
    }

    // Mock mode / fallback log
    botService.logSimulated('[Mock Panel] Deployed Submit Role Request Button in #role-request channel.');
    return true;
  }
};

module.exports = botService;
