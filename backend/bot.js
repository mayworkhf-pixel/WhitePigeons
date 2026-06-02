const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('./database');
const axios = require('axios');

const cleanName = (name) => (name || '').normalize('NFKD').toLowerCase();

const findChannel = async (guild, filterFn) => {
  try {
    await guild.channels.fetch();
  } catch (err) {
    console.warn('[Bot] Failed to fetch guild channels, falling back to cache:', err.message);
  }
  return guild.channels.cache.find(c => {
    if (typeof c.isTextBased === 'function' && !c.isTextBased()) return false;
    return filterFn(c);
  });
};

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

  handleRosterLeaveNotifications: async (eventId, leavingUsername, promotedMember) => {
    botService.logSimulated(`Notification triggered: ${leavingUsername} left queue ${eventId}. Promoted: ${promotedMember ? promotedMember.username : 'None'}`);

    if (client) {
      try {
        const config = await db.getConfig();
        const guild = await client.guilds.fetch(config.guildId).catch(() => null);
        if (guild) {
          const channel = await findChannel(guild, c => cleanName(c.name).includes('signup'));
          if (channel) {
            if (promotedMember) {
              await channel.send(`👋 **[Roster Update]** @${leavingUsername} has left the queue. Reserve player <@${promotedMember.memberId}> has been promoted to the Main Roster!`);
            } else {
              await channel.send(`👋 **[Roster Update]** @${leavingUsername} has left the queue.`);
            }
          }
        }
      } catch (err) {
        console.error('[Bot] Failed to send leave channel log:', err.message);
      }
    }

    if (promotedMember) {
      try {
        await botService.sendDirectMessage(
          promotedMember.memberId,
          `🎉 Good news! You have been promoted to the **confirmed** roster for the **${eventId === 'rp-signup' ? 'RP' : 'Informal'} Signup**!`
        );
      } catch (err) {
        console.error('[Bot] Failed to send promotion DM:', err.message);
      }
    }
  },

  // Initialize the Discord Bot Client
  init: async () => {
    if (client) {
      try {
        client.destroy();
      } catch (err) {
        console.error('[Bot] Error destroying old client:', err.message);
      }
      client = null;
    }
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
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildVoiceStates
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
          
          else if (customId === 'refresh_stats') {
            try {
              const stats = await db.getFamilyStats();
              const updatedEmbed = await botService.buildStatsEmbed(stats);
              
              const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('refresh_stats')
                  .setLabel('🔄 Refresh Stats')
                  .setStyle(ButtonStyle.Secondary)
              );
              
              await interaction.update({ embeds: [updatedEmbed], components: [row] });
            } catch (err) {
              console.error('[Bot] Failed to refresh family stats in Discord:', err.message);
              await interaction.reply({ content: '⚠️ Failed to refresh stats. Please try again later.', ephemeral: true });
            }
          }
          else if (customId === 'my_strikes') {
            try {
              const members = await db.getMembers();
              const member = members.find(m => m.discordId === interaction.user.id);
              
              if (!member || !member.strikes || member.strikes.length === 0) {
                return interaction.reply({ content: '✅ **You have 0 active strikes.** Keep up the good work!', ephemeral: true });
              }
              
              const list = member.strikes.map((st, idx) => `${idx + 1}. **"${st.reason}"** (Issued by: @${st.issuedBy} on ${new Date(st.date).toLocaleDateString()})`).join('\n');
              await interaction.reply({
                content: `🚨 **Your Active Strikes (${member.strikes.length}/3)**:\n\n${list}\n\n*Accumulating 3 strikes will result in automatic blacklist / suspension.*`,
                ephemeral: true
              });
            } catch (err) {
              console.error('[Bot] Failed to retrieve user strikes:', err.message);
              await interaction.reply({ content: '⚠️ Failed to check your strikes. Please try again later.', ephemeral: true });
            }
          }
          else if (customId === 'priority_add_top5' || customId === 'priority_add_top10') {
            const type = customId.includes('top5') ? 'top5' : 'top10';
            const label = type === 'top5' ? 'Top 5' : 'Top 10';
            const modal = new ModalBuilder()
              .setCustomId(`priority_add_modal:${type}`)
              .setTitle(`Add to ${label} Members`);

            const input = new TextInputBuilder()
              .setCustomId('priority_member_input')
              .setLabel('Discord ID or Username')
              .setPlaceholder('e.g. VitoScaletta or 3572')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
          }
          else if (customId === 'priority_remove_top5' || customId === 'priority_remove_top10') {
            const type = customId.includes('top5') ? 'top5' : 'top10';
            const label = type === 'top5' ? 'Top 5' : 'Top 10';
            const modal = new ModalBuilder()
              .setCustomId(`priority_remove_modal:${type}`)
              .setTitle(`Remove from ${label} Members`);

            const input = new TextInputBuilder()
              .setCustomId('priority_member_input')
              .setLabel('Discord ID or Username')
              .setPlaceholder('e.g. VitoScaletta or 3572')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
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
                const descriptionMatch = originalEmbed.description.match(/\*\*Event Directives:\*\*\n([\s\S]+?)\n\n/);
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

              // Send direct message confirmation
              await botService.sendSignupDm(eventId, discordId, result.action);

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
          else if (customId.startsWith('leave:')) {
            const eventId = customId.split(':')[1];
            const discordId = interaction.user.id;
            const username = interaction.user.username;

            const result = await db.removeSignup(eventId, discordId);
            
            if (result.success) {
              try {
                const originalEmbed = interaction.message.embeds[0];
                const descriptionMatch = originalEmbed.description.match(/\*\*Event Directives:\*\*\n([\s\S]+?)\n\n/);
                const directives = descriptionMatch ? descriptionMatch[1] : '';
                
                const updatedEmbed = await botService.buildSignupEmbed(eventId, originalEmbed.title, directives, false);
                await interaction.message.edit({ embeds: [updatedEmbed] });
              } catch (err) {
                console.error('[Bot] Failed to edit live roster message on leave:', err.message);
              }

              if (ioInstance) {
                ioInstance.emit('signup_change', { eventId, signups: await db.getSignups(eventId) });
                ioInstance.emit('system_notification', {
                  title: 'Discord Leave Queue',
                  message: `${username} left the queue.`,
                  type: 'info'
                });
              }

              // Send channel notifications and direct messages
              await botService.handleRosterLeaveNotifications(eventId, username, result.promoted);

              await interaction.reply({ content: `👋 You have successfully left the signup queue.`, ephemeral: true });
            } else {
              await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
            }
          }
          else if (customId.startsWith('admin_actions:')) {
            const eventId = customId.split(':')[1];
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            const isLead = member ? member.roles.cache.some(r => r.name.toLowerCase().includes('leadership') || r.name.toLowerCase().includes('admin')) : false;

            if (!isLead) {
              return interaction.reply({ content: '❌ You do not have permission to use admin actions.', ephemeral: true });
            }

            const signups = await db.getSignups(eventId);
            if (signups.length === 0) {
              return interaction.reply({ content: '⚠️ The roster is currently empty.', ephemeral: true });
            }

            const kickSelect = new StringSelectMenuBuilder()
              .setCustomId(`admin_kick_select:${eventId}`)
              .setPlaceholder('Select a member to KICK...')
              .addOptions(signups.map(s => ({
                label: `@${s.username} (${s.status.toUpperCase()})`,
                value: s.memberId
              })));

            const swapSelect = new StringSelectMenuBuilder()
              .setCustomId(`admin_swap_first_select:${eventId}`)
              .setPlaceholder('Select first member to SWAP...')
              .addOptions(signups.map(s => ({
                label: `@${s.username} (${s.status.toUpperCase()})`,
                value: s.memberId
              })));

            const row1 = new ActionRowBuilder().addComponents(kickSelect);
            const row2 = new ActionRowBuilder().addComponents(swapSelect);

            await interaction.reply({
              content: '🛠️ **Roster Administrative Actions**\nSelect an action below:',
              components: [row1, row2],
              ephemeral: true
            });
          }
          else if (customId === 'trigger_bonus_ticket') {
            const modal = new ModalBuilder()
              .setCustomId('discord_ticket_bonus_modal')
              .setTitle('Bonus Problem Ticket');

            const subjectInput = new TextInputBuilder()
              .setCustomId('ticket_subject')
              .setLabel('Subject')
              .setPlaceholder('E.g., Missing bonus for contract')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const detailsInput = new TextInputBuilder()
              .setCustomId('ticket_details')
              .setLabel('Infraction / Bonus Details')
              .setPlaceholder('Provide full details about the bonus problem...')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true);

            modal.addComponents(
              new ActionRowBuilder().addComponents(subjectInput),
              new ActionRowBuilder().addComponents(detailsInput)
            );

            await interaction.showModal(modal);
          }
          else if (customId === 'trigger_support_ticket') {
            const modal = new ModalBuilder()
              .setCustomId('discord_ticket_support_modal')
              .setTitle('Support Problem Ticket');

            const subjectInput = new TextInputBuilder()
              .setCustomId('ticket_subject')
              .setLabel('Subject')
              .setPlaceholder('E.g., Conflict with another member')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const detailsInput = new TextInputBuilder()
              .setCustomId('ticket_details')
              .setLabel('Complaint / Support Details')
              .setPlaceholder('Provide full details about the support issue...')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true);

            modal.addComponents(
              new ActionRowBuilder().addComponents(subjectInput),
              new ActionRowBuilder().addComponents(detailsInput)
            );

            await interaction.showModal(modal);
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
          else if (interaction.customId === 'discord_ticket_bonus_modal' || interaction.customId === 'discord_ticket_support_modal') {
            const type = interaction.customId === 'discord_ticket_bonus_modal' ? 'bonus' : 'support';
            const subject = interaction.fields.getTextInputValue('ticket_subject');
            const description = interaction.fields.getTextInputValue('ticket_details');

            const ticket = await db.createTicket({
              memberId: interaction.user.id,
              username: interaction.user.username,
              type,
              subject,
              description
            });

            const embed = {
              title: `🎫 NEW SUPPORT TICKET RAISED [${ticket.id}]`,
              description: `Ticket raised by **${interaction.user.username}** via Discord.`,
              color: type === 'bonus' ? 0x3a86ff : 0xffaa00,
              fields: [
                { name: 'Type', value: type.toUpperCase(), inline: true },
                { name: 'Subject', value: subject, inline: true },
                { name: 'Description', value: description }
              ]
            };

            await botService.sendWebhook('tickets', embed);
            botService.logSimulated(`Support ticket ${ticket.id} (${type}) raised by @${interaction.user.username} via Discord.`);

            botService.broadcastSocket('tickets_update', await db.getTickets());
            if (ioInstance) {
              ioInstance.emit('system_notification', {
                title: `New Discord Ticket [${ticket.id}]`,
                message: `@${interaction.user.username} submitted a ${type} ticket: "${subject}"`,
                type: 'info'
              });
            }

            await interaction.reply({ content: `✅ Your ticket **[${ticket.id}]** has been submitted and is under review.`, ephemeral: true });
          }
          else if (interaction.customId.startsWith('priority_add_modal:')) {
            const type = interaction.customId.split(':')[1];
            const value = interaction.fields.getTextInputValue('priority_member_input').trim();

            const members = await db.getMembers();
            const found = members.find(m => 
              m.discordId === value || 
              m.username.toLowerCase() === value.toLowerCase() ||
              m.nickname.toLowerCase().includes(value.toLowerCase())
            );

            if (!found) {
              return interaction.reply({ content: `❌ Member "${value}" not found in database.`, ephemeral: true });
            }

            const list = await db.getPriorityList();
            if (type === 'top5') {
              if (!list.top5) list.top5 = [];
              if (list.top5.includes(found.discordId)) {
                return interaction.reply({ content: `⚠️ ${found.username} is already in the TOP 5 list.`, ephemeral: true });
              }
              list.top5.push(found.discordId);
            } else {
              if (!list.top10) list.top10 = [];
              if (list.top10.includes(found.discordId)) {
                return interaction.reply({ content: `⚠️ ${found.username} is already in the TOP 10 list.`, ephemeral: true });
              }
              list.top10.push(found.discordId);
            }

            await db.savePriorityList(list);
            await botService.syncPriorityListMessage();
            const resolved = await botService.getResolvedPriorityList();
            botService.broadcastSocket('priority_list_update', resolved);

            await interaction.reply({ content: `✅ Added **${found.username}** to Priority ${type === 'top5' ? 'TOP 5' : 'TOP 10'}!`, ephemeral: true });
          }
          else if (interaction.customId.startsWith('priority_remove_modal:')) {
            const type = interaction.customId.split(':')[1];
            const value = interaction.fields.getTextInputValue('priority_member_input').trim();

            const members = await db.getMembers();
            const found = members.find(m => 
              m.discordId === value || 
              m.username.toLowerCase() === value.toLowerCase() ||
              m.nickname.toLowerCase().includes(value.toLowerCase())
            );

            if (!found) {
              return interaction.reply({ content: `❌ Member "${value}" not found in database.`, ephemeral: true });
            }

            const list = await db.getPriorityList();
            if (type === 'top5') {
              if (!list.top5 || !list.top5.includes(found.discordId)) {
                return interaction.reply({ content: `⚠️ ${found.username} is not in the TOP 5 list.`, ephemeral: true });
              }
              list.top5 = list.top5.filter(id => id !== found.discordId);
            } else {
              if (!list.top10 || !list.top10.includes(found.discordId)) {
                return interaction.reply({ content: `⚠️ ${found.username} is not in the TOP 10 list.`, ephemeral: true });
              }
              list.top10 = list.top10.filter(id => id !== found.discordId);
            }

            await db.savePriorityList(list);
            await botService.syncPriorityListMessage();
            const resolved = await botService.getResolvedPriorityList();
            botService.broadcastSocket('priority_list_update', resolved);

            await interaction.reply({ content: `✅ Removed **${found.username}** from Priority ${type === 'top5' ? 'TOP 5' : 'TOP 10'}.`, ephemeral: true });
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
          else if (interaction.customId.startsWith('admin_kick_select:')) {
            const eventId = interaction.customId.split(':')[1];
            const memberId = interaction.values[0];

            const signups = await db.getSignups(eventId);
            const target = signups.find(s => s.memberId === memberId);
            const targetName = target ? target.username : memberId;

            const result = await db.removeSignup(eventId, memberId);
            if (result.success) {
              await botService.syncRpSignupEmbed(eventId);
              await interaction.update({ content: `✅ Successfully **KICKED** @${targetName} from the roster.`, components: [] });
            } else {
              await interaction.update({ content: `❌ Failed to kick: ${result.message}`, components: [] });
            }
          }
          else if (interaction.customId.startsWith('admin_swap_first_select:')) {
            const eventId = interaction.customId.split(':')[1];
            const memberId1 = interaction.values[0];

            const signups = await db.getSignups(eventId);
            const member1 = signups.find(s => s.memberId === memberId1);
            const m1Name = member1 ? member1.username : memberId1;
            const otherSignups = signups.filter(s => s.memberId !== memberId1);

            if (otherSignups.length === 0) {
              return interaction.update({ content: `⚠️ No other members in the roster to swap with.`, components: [] });
            }

            const swap2Select = new StringSelectMenuBuilder()
              .setCustomId(`admin_swap_second_select:${eventId}:${memberId1}`)
              .setPlaceholder(`Select who to swap @${m1Name} with...`)
              .addOptions(otherSignups.map(s => ({
                label: `@${s.username} (${s.status.toUpperCase()})`,
                value: s.memberId
              })));

            const row = new ActionRowBuilder().addComponents(swap2Select);
            await interaction.update({
              content: `🔄 Swapping @${m1Name}.\nChoose the second player to swap places with:`,
              components: [row]
            });
          }
          else if (interaction.customId.startsWith('admin_swap_second_select:')) {
            const parts = interaction.customId.split(':');
            const eventId = parts[1];
            const memberId1 = parts[2];
            const memberId2 = interaction.values[0];

            const result = await db.swapSignups(eventId, memberId1, memberId2);
            if (result.success) {
              await botService.syncRpSignupEmbed(eventId);
              
              const signups = await db.getSignups(eventId);
              const m1 = signups.find(s => s.memberId === memberId1);
              const m2 = signups.find(s => s.memberId === memberId2);
              const m1Name = m1 ? m1.username : memberId1;
              const m2Name = m2 ? m2.username : memberId2;
              
              await interaction.update({
                content: `✅ Successfully swapped roster positions of @${m1Name} and @${m2Name}.`,
                components: []
              });
            } else {
              await interaction.update({ content: `❌ Failed to swap: ${result.message}`, components: [] });
            }
          }
        }
      });

      client.on('voiceStateUpdate', async (oldState, newState) => {
        try {
          const config = await db.getConfig();
          const voiceChannelId = config.factoryVoiceChannelId || 'mock-voice-id';
          if (oldState.channelId === voiceChannelId || newState.channelId === voiceChannelId) {
            await botService.syncRpSignupEmbed('rp-signup');
            await botService.syncRpSignupEmbed('informal-signup');
          }
        } catch (err) {
          console.error('[Bot] voiceStateUpdate handler failed:', err.message);
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

  // Send direct message confirmation on successful signup
  sendSignupDm: async (eventId, discordId, action) => {
    if (eventId !== 'rp-signup') return;
    
    let rosterType = 'Waitlist';
    if (action === 'confirmed' || action === 'displaced') {
      rosterType = 'Main Roster';
    }
    
    const text = `✅ You have joined the event: RP Ticket (${rosterType})`;
    await botService.sendDirectMessage(discordId, text);
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

  getClient: () => client,

  getEnrichedSignups: async (eventId) => {
    const signups = await db.getSignups(eventId);
    const config = await db.getConfig();
    let voiceMemberIds = new Set();
    if (client) {
      try {
        const guild = await client.guilds.fetch(config.guildId).catch(() => null);
        if (guild) {
          const voiceChannel = guild.channels.cache.get(config.factoryVoiceChannelId || 'mock-voice-id');
          if (voiceChannel && voiceChannel.type === 2) {
            for (const memberId of voiceChannel.members.keys()) {
              voiceMemberIds.add(memberId);
            }
          }
        }
      } catch (err) {
        console.error('[Bot] Failed to fetch voice channel members for enrichment:', err.message);
      }
    }
    const simulatedVoice = config.simulatedVoice || ['anvy-mock', 'alikagan-mock', '70941', '101254'];
    for (const id of simulatedVoice) {
      voiceMemberIds.add(id);
    }
    return signups.map(s => ({
      ...s,
      inVoice: voiceMemberIds.has(s.memberId)
    }));
  },

  syncRpSignupEmbed: async (eventId) => {
    const enriched = await botService.getEnrichedSignups(eventId);
    if (ioInstance) {
      ioInstance.emit('signup_change', { eventId, signups: enriched });
    }

    if (!client) return;
    try {
      const config = await db.getConfig();
      const guild = await client.guilds.fetch(config.guildId).catch(() => null);
      if (!guild) return;
      const channel = await findChannel(guild, c => cleanName(c.name).includes('signup'));
      if (channel) {
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

          const updatedEmbed = await botService.buildSignupEmbed(eventId, originalEmbed.title, directives, false);
          await signupMessage.edit({ embeds: [updatedEmbed] });
          botService.logSimulated(`Synced active signup message in Discord channel #${channel.name}`);
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to sync signup message in Discord:', err.message);
    }
  },

  // Build a complete, live updating signup embed list matching reference layout
  buildSignupEmbed: async (eventId, title, description, isClosed = false) => {
    const signups = await db.getSignups(eventId);
    const confirmed = signups.filter(s => s.status === 'confirmed');
    const reserve = signups.filter(s => s.status === 'reserve' || s.status === 'displaced');

    // Strip blockquote markers if already present to avoid duplication during sync edits
    let cleanDescription = description || '';
    if (cleanDescription.startsWith('>>> ')) {
      cleanDescription = cleanDescription.slice(4);
    }

    // Get voice members
    let voiceMemberIds = new Set();
    const config = await db.getConfig();
    if (client) {
      try {
        const guild = await client.guilds.fetch(config.guildId).catch(() => null);
        if (guild) {
          const voiceChannel = guild.channels.cache.get(config.factoryVoiceChannelId || 'mock-voice-id');
          if (voiceChannel && voiceChannel.type === 2) {
            for (const memberId of voiceChannel.members.keys()) {
              voiceMemberIds.add(memberId);
            }
          }
        }
      } catch (err) {
        console.error('[Bot] Failed to fetch voice channel members for embed:', err.message);
      }
    }
    const simulatedVoice = config.simulatedVoice || ['anvy-mock', 'alikagan-mock', '70941', '101254'];
    for (const id of simulatedVoice) {
      voiceMemberIds.add(id);
    }

    // Determine normal rankings for medals
    let normalCount = 0;
    const mainRosterLines = confirmed.map((s, idx) => {
      let icon = '⚔️';
      if (s.isTop10) {
        icon = '👑';
      } else {
        normalCount++;
        if (normalCount === 1) icon = '🥇';
        else if (normalCount === 2) icon = '🥈';
        else if (normalCount === 3) icon = '🥉';
        else if (normalCount === 4) icon = '🏅';
        else if (normalCount === 5) icon = '🎖️';
      }
      const inVoice = voiceMemberIds.has(s.memberId);
      const voiceIcon = inVoice ? '✅' : '❌';
      return `${voiceIcon} **${idx + 1}.** ${icon} <@${s.memberId}>`;
    });

    let normalSubCount = 0;
    const reserveLines = reserve.map((s, idx) => {
      let icon = '⚔️';
      if (s.isTop10) {
        icon = '👑';
      } else {
        normalSubCount++;
        if (normalSubCount === 1) icon = '🥇';
        else if (normalSubCount === 2) icon = '🥈';
        else if (normalSubCount === 3) icon = '🥉';
        else if (normalSubCount === 4) icon = '🏅';
        else if (normalSubCount === 5) icon = '🎖️';
      }
      const inVoice = voiceMemberIds.has(s.memberId);
      const voiceIcon = inVoice ? '✅' : '❌';
      return `${voiceIcon} **${idx + 1}.** ${icon} <@${s.memberId}>`;
    });

    const statusBadge = isClosed ? '🔴 **Registration is closed!**' : '🟢 **Registration is active!**';
    const embedColor = isClosed ? 0xff003c : 0x00f0ff;

    const embedDescription = [
      `**Event Directives:**`,
      `>>> ${cleanDescription}\n`,
      statusBadge,
      `📊 **Participants:** ${confirmed.length}/25\n`
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

    // Roster Fields for two columns
    if (mainRosterLines.length > 0) {
      const midPoint = Math.ceil(mainRosterLines.length / 2);
      const leftColumn = mainRosterLines.slice(0, midPoint);
      const rightColumn = mainRosterLines.slice(midPoint);
      
      embed.addFields(
        { name: `⚔️ Main Roster (1-${midPoint})`, value: leftColumn.join('\n'), inline: true }
      );
      if (rightColumn.length > 0) {
        embed.addFields(
          { name: `⚔️ Main Roster (${midPoint + 1}-${mainRosterLines.length})`, value: rightColumn.join('\n'), inline: true }
        );
      }
    } else {
      embed.addFields(
        { name: '⚔️ Main Roster', value: '*Roster is vacant. Claim a slot!*', inline: false }
      );
    }

    // Substitutes Field
    if (reserveLines.length > 0) {
      embed.addFields(
        { name: `⏳ Substitutes List (${reserveLines.length})`, value: reserveLines.join('\n'), inline: false }
      );
    } else {
      embed.addFields(
        { name: '⏳ Substitutes List', value: '*No substitutes yet.*', inline: false }
      );
    }

    return embed;
  },

  // Close an active signup message in Discord by removing components and setting to CLOSED style
  closeSignupMessage: async (eventId) => {
    if (!client) return;
    try {
      const config = await db.getConfig();
      const guild = await client.guilds.fetch(config.guildId);
      const channel = await findChannel(guild, c => cleanName(c.name).includes('signup'));
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

    const fallbackEmbed = {
      title: `🚀 ${eventId === 'rp-signup' ? 'RP Ticket' : 'Informal Fight'} - OPEN ⚔️`,
      description: `**Event Directives:**\n${description}\n\n🟢 **Registration is active!**\n\nHave fun! 🎉`,
      color: 0x00f0ff,
      timestamp: new Date().toISOString()
    };

    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        const channel = await findChannel(guild, c => cleanName(c.name).includes('signup'));
        if (channel) {
          const embedBuilder = await botService.buildSignupEmbed(eventId, title, description, false);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`signup:${eventId}`)
              .setLabel('⚔️ SIGN UP')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`leave:${eventId}`)
              .setLabel('👋 LEAVE')
              .setStyle(ButtonStyle.Danger)
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
        const channel = guild.channels.cache.find(c => cleanName(c.name).includes('review') || cleanName(c.name).includes('rolereq'));
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
      const channel = guild.channels.cache.find(c => cleanName(c.name).includes('review') || cleanName(c.name).includes('rolereq'));
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
        const channel = guild.channels.cache.find(c => cleanName(c.name).includes('request') || cleanName(c.name).includes('role'));
        
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
  },

  buildStatsEmbed: async (stats) => {
    const updatedTime = stats.updatedAt ? new Date(stats.updatedAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) : '9:25 PM';

    return new EmbedBuilder()
      .setTitle('White Pigeons #TOP1 Family Stats!')
      .setDescription('**White Pigeons #TOP1 On Top!**')
      .addFields(
        { name: '👥 Total Family Members', value: `${stats.totalMembers || 0}`, inline: true },
        { name: '🎁 Total Giveaways', value: `${stats.totalGiveaways || 0}`, inline: true },
        { name: '💰 Total Bonuses', value: `$${Number(stats.totalBonuses || 0).toLocaleString()}`, inline: true },
        { name: '✅ HC Work Done', value: `${stats.hcWorkDone || 0}`, inline: true },
        { name: '⚠️ Total Strikes', value: `${stats.totalStrikes || 0}`, inline: true },
        { name: '🚫 Total Blacklisted', value: `${stats.totalBlacklisted || 0}`, inline: true },
        { name: '🏆 RP Won', value: `${stats.rpWon || 0}`, inline: true },
        { name: '🎮 Events Won', value: `${stats.eventsWon || 0}`, inline: true },
        { name: '⭐ Family Ranking Points', value: `${stats.familyRankingPoints || 0}`, inline: true },
        { name: '📊 Family Rank', value: `${stats.familyRank || '#1'}`, inline: true }
      )
      .setColor(0x8f00ff)
      .setThumbnail('https://whitepigeons-35431.web.app/logo.png')
      .setFooter({ text: `White Pigeons #TOP1 • Updated • Today at ${updatedTime}` });
  },

  sendStatsBroadcast: async (channelKey, stats) => {
    botService.logSimulated(`Firing stats broadcast to channel ${channelKey}...`);
    const config = await db.getConfig();
    
    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        
        let channel = guild.channels.cache.get(channelKey);
        if (!channel) {
          channel = guild.channels.cache.find(c => 
            cleanName(c.name).includes(cleanName(channelKey)) || 
            c.id === channelKey ||
            cleanName(c.name).includes('announcement') ||
            cleanName(c.name).includes('general')
          );
        }
        
        if (channel) {
          const embed = await botService.buildStatsEmbed(stats);
          
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('refresh_stats')
              .setLabel('🔄 Refresh Stats')
              .setStyle(ButtonStyle.Secondary)
          );
          
          await channel.send({ embeds: [embed], components: [row] });
          botService.logSimulated(`Successfully broadcast stats embed to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to send live stats embed to Discord:', err.message);
      }
    }
    
    botService.logSimulated(`[Mock Broadcast] Sent Stats Embed to Discord channel key "${channelKey}":\n` + JSON.stringify(stats));
    return true;
  },

  deployStrikeSystemPrompt: async () => {
    botService.logSimulated('Attempting to deploy Strike System panel to Discord channel...');
    const config = await db.getConfig();
    const members = await db.getMembers();
    
    // Build the list of active strikes
    const strikers = members.filter(m => m.strikes && m.strikes.length > 0);
    let strikeList = strikers.map(m => `• <@${m.discordId}> (${m.strikes.length}/3)`).join('\n');
    if (!strikeList) {
      strikeList = '• *No active infractions registered.*';
    }

    const updatedTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = guild.channels.cache.find(c => cleanName(c.name).includes('strike') || cleanName(c.name).includes('infraction') || cleanName(c.name).includes('discipline'));
        if (!channel) {
          channel = guild.channels.cache.find(c => cleanName(c.name).includes('general') || cleanName(c.name).includes('announcement'));
        }
        
        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('Strike System')
            .setDescription(strikeList)
            .setImage('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800') // purple-red warning vibe neon
            .setColor(0xff0000)
            .setFooter({ text: `Strike System • 3 strikes max • Updated • Today at ${updatedTime}` });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('my_strikes')
              .setLabel('⚠️ My Strikes')
              .setStyle(ButtonStyle.Danger)
          );

          const message = await channel.send({ embeds: [embed], components: [row] });
          
          // Save message and channel ID in config for auto-updates when strikes are issued/resolved on website
          const currentWebhooks = config.webhooks || {};
          currentWebhooks.strikeMessageId = message.id;
          currentWebhooks.strikeChannelId = channel.id;
          await db.saveConfig({ ...config, webhooks: currentWebhooks });
          
          botService.logSimulated(`Successfully deployed Strike System panel to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy Strike System panel:', err.message);
      }
    }

    botService.logSimulated('[Mock Panel] Deployed Strike System panel in #strikes channel.');
    return true;
  },

  syncStrikeSystemMessage: async () => {
    const config = await db.getConfig();
    const webhooks = config.webhooks || {};
    const messageId = webhooks.strikeMessageId;
    const channelId = webhooks.strikeChannelId;
    
    if (!messageId || !channelId || !client) return;
    
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          const members = await db.getMembers();
          const strikers = members.filter(m => m.strikes && m.strikes.length > 0);
          let strikeList = strikers.map(m => `• <@${m.discordId}> (${m.strikes.length}/3)`).join('\n');
          if (!strikeList) {
            strikeList = '• *No active infractions registered.*';
          }

          const updatedTime = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });

          const embed = new EmbedBuilder()
            .setTitle('Strike System')
            .setDescription(strikeList)
            .setImage('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800')
            .setColor(0xff0000)
            .setFooter({ text: `Strike System • 3 strikes max • Updated • Today at ${updatedTime}` });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('my_strikes')
              .setLabel('⚠️ My Strikes')
              .setStyle(ButtonStyle.Danger)
          );

          await message.edit({ embeds: [embed], components: [row] });
          botService.logSimulated('Successfully updated active Discord Strike System message.');
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to sync Strike System message:', err.message);
    }
  },

  deployTicketsPrompt: async () => {
    botService.logSimulated('Attempting to deploy Ticket System panel to Discord channel...');
    const config = await db.getConfig();

    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = await findChannel(guild, c => cleanName(c.name).includes('ticket'));
        if (!channel) {
          channel = await findChannel(guild, c => cleanName(c.name).includes('general') || cleanName(c.name).includes('announcement'));
        }

        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('White Pigeons Ticket System')
            .setDescription('If you have any problem about anything like bonus or general,\nopen ticket.\n\nDont DM HC\'s')
            .setColor(0x3a86ff)
            .setFooter({ text: 'White Pigeons • Support System' })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('trigger_bonus_ticket')
              .setLabel('💰 Bonus Problem')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('trigger_support_ticket')
              .setLabel('⚠️ Support Problem')
              .setStyle(ButtonStyle.Danger)
          );

          await channel.send({ embeds: [embed], components: [row] });
          botService.logSimulated(`Successfully deployed Ticket System panel to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy Ticket System panel:', err.message);
      }
    }

    botService.logSimulated('[Mock Panel] Deployed Ticket System panel in #tickets channel.');
    return true;
  },

  deployBalanceSystemPrompt: async () => {
    botService.logSimulated('Attempting to deploy Balance System panel to Discord channel...');
    const config = await db.getConfig();

    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = await findChannel(guild, c => cleanName(c.name).includes('balance') || cleanName(c.name).includes('check'));
        if (!channel) {
          channel = await findChannel(guild, c => cleanName(c.name).includes('general') || cleanName(c.name).includes('announcement'));
        }

        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('💰 BONUS SYSTEM White Pigeons 💰')
            .setDescription('🎯 Bonus Rewards System\n\n🟫 Informal: 70k\n💥 Biz War: 200k\n🎟️ RP Ticket: 1 RP per ticket\n\nClick below to check your balance!')
            .setColor(0x00ff00)
            .setThumbnail('https://whitepigeons-35431.web.app/logo.png')
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('check_my_balance')
              .setLabel('💰 My Balance')
              .setStyle(ButtonStyle.Primary)
          );

          await channel.send({ embeds: [embed], components: [row] });
          botService.logSimulated(`Successfully deployed Balance System panel to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy Balance System panel:', err.message);
      }
    }

    botService.logSimulated('[Mock Panel] Deployed Balance System panel in #check-balance channel.');
    return true;
  },

  deployWeeklyLeaderboardPrompt: async () => {
    botService.logSimulated('Attempting to deploy Weekly Event Leaderboard prompt to Discord channel...');
    const config = await db.getConfig();

    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = await findChannel(guild, c => cleanName(c.name).includes('kill-list') || cleanName(c.name).includes('leaderboard') || cleanName(c.name).includes('weekly'));
        if (!channel) {
          channel = await findChannel(guild, c => cleanName(c.name).includes('general') || cleanName(c.name).includes('announcement'));
        }

        if (channel) {
          const members = await db.getMembers();
          
          // Sort by weeklyPoints descending, limit to top 20
          const leaderboardList = [...members]
            .filter(m => m.weeklyPoints !== undefined)
            .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
            .slice(0, 20);

          const totalPoints = members.reduce((acc, curr) => acc + (curr.weeklyPoints || 0), 0);
          const totalPlayers = members.filter(m => (m.weeklyPoints || 0) > 0).length;

          // Format leaderboard entries
          const entries = leaderboardList.map((m, idx) => {
            let rankIcon = `**#${idx + 1}**`;
            let specIcon = '⚔️';
            
            if (idx === 0) {
              rankIcon = '👑 **#1**';
            } else if (idx === 1) {
              rankIcon = '⭐ **#2**';
            } else if (idx === 2) {
              rankIcon = '⚡ **#3**';
            }
            
            // Spec icon logic: #8 Anvy has 🏆
            if (m.username.toLowerCase() === 'anvy') {
              specIcon = '🏆';
            }

            return `• ${rankIcon} ${specIcon} <@${m.discordId}> 💰 **${m.weeklyPoints}** points`;
          }).join('\n');

          const embed = new EmbedBuilder()
            .setTitle('📊 WEEKLY EVENT LEADERBOARD 🎯')
            .setDescription(`🔥 Top Event Participants This Week 🔥\n\n${entries}\n\n` + 
              `---------------------------\n` +
              `📊 Total Points: **${totalPoints}**\n` +
              `👥 Total Players: **${totalPlayers}**\n` +
              `🔄 Next Reset: in 4 days\n` +
              `---------------------------\n\n` +
              `💰 **Point System:**\n` +
              `• Harbor: 1 point\n` +
              `• Weapons Factory: 2 points\n` +
              `• RP Ticket: 2 points\n` +
              `• Foundry: 3 points`
            )
            .setColor(0xff003c) // Vibrant red-pink or matching screenshot
            .setThumbnail('https://whitepigeons-35431.web.app/logo.png')
            .setTimestamp();

          const message = await channel.send({ embeds: [embed] });
          
          // Save in config webhooks
          const currentWebhooks = config.webhooks || {};
          currentWebhooks.leaderboardMessageId = message.id;
          currentWebhooks.leaderboardChannelId = channel.id;
          await db.saveConfig({ ...config, webhooks: currentWebhooks });

          botService.logSimulated(`Successfully deployed Weekly Event Leaderboard panel to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy Weekly Event Leaderboard panel:', err.message);
      }
    }

    botService.logSimulated('[Mock Panel] Deployed Weekly Event Leaderboard panel in #weekly-kill-list channel.');
    return true;
  },

  syncWeeklyLeaderboardMessage: async () => {
    const config = await db.getConfig();
    const webhooks = config.webhooks || {};
    const messageId = webhooks.leaderboardMessageId;
    const channelId = webhooks.leaderboardChannelId;

    if (!messageId || !channelId || !client) return;

    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          const members = await db.getMembers();
          
          const leaderboardList = [...members]
            .filter(m => m.weeklyPoints !== undefined)
            .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
            .slice(0, 20);

          const totalPoints = members.reduce((acc, curr) => acc + (curr.weeklyPoints || 0), 0);
          const totalPlayers = members.filter(m => (m.weeklyPoints || 0) > 0).length;

          const entries = leaderboardList.map((m, idx) => {
            let rankIcon = `**#${idx + 1}**`;
            let specIcon = '⚔️';
            
            if (idx === 0) {
              rankIcon = '👑 **#1**';
            } else if (idx === 1) {
              rankIcon = '⭐ **#2**';
            } else if (idx === 2) {
              rankIcon = '⚡ **#3**';
            }
            
            if (m.username.toLowerCase() === 'anvy') {
              specIcon = '🏆';
            }

            return `• ${rankIcon} ${specIcon} <@${m.discordId}> 💰 **${m.weeklyPoints}** points`;
          }).join('\n');

          const embed = new EmbedBuilder()
            .setTitle('📊 WEEKLY EVENT LEADERBOARD 🎯')
            .setDescription(`🔥 Top Event Participants This Week 🔥\n\n${entries}\n\n` + 
              `---------------------------\n` +
              `📊 Total Points: **${totalPoints}**\n` +
              `👥 Total Players: **${totalPlayers}**\n` +
              `🔄 Next Reset: in 4 days\n` +
              `---------------------------\n\n` +
              `💰 **Point System:**\n` +
              `• Harbor: 1 point\n` +
              `• Weapons Factory: 2 points\n` +
              `• RP Ticket: 2 points\n` +
              `• Foundry: 3 points`
            )
            .setColor(0xff003c)
            .setThumbnail('https://whitepigeons-35431.web.app/logo.png')
            .setTimestamp();

          await message.edit({ embeds: [embed] });
          botService.logSimulated('Successfully updated active Discord Weekly Event Leaderboard message.');
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to sync Weekly Event Leaderboard message:', err.message);
    }
  },

  deployAllTimeKillsPrompt: async () => {
    botService.logSimulated('Attempting to deploy All Time Kills Leaderboard prompt to Discord channel...');
    const config = await db.getConfig();

    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = await findChannel(guild, c => cleanName(c.name).includes('long-time-kill') || cleanName(c.name).includes('all-time') || cleanName(c.name).includes('kill-list'));
        if (!channel) {
          channel = await findChannel(guild, c => cleanName(c.name).includes('general') || cleanName(c.name).includes('announcement'));
        }

        if (channel) {
          const members = await db.getMembers();
          const sorted = [...members]
            .filter(m => !['PigeonBoss', 'VitoScaletta', 'TonyMontana'].includes(m.username))
            .sort((a, b) => b.kills - a.kills)
            .slice(0, 30);

          const entries = sorted.map((m, idx) => {
            let rankIcon = `#${idx + 1}`;
            if (idx === 0) rankIcon = '👑 #1';
            else if (idx === 1) rankIcon = '⭐ #2';
            else if (idx === 2) rankIcon = '⚡ #3';
            return `• ${rankIcon} <@${m.discordId}> 💀 **${m.kills}** kills`;
          }).join('\n');

          const embed = new EmbedBuilder()
            .setTitle('💀 ALL TIME KILLS LEADERBOARD 💀')
            .setDescription(`🔥 Elite Marksmen of White Pigeons 🔥\n\n${entries}`)
            .setColor(0xff0000)
            .setThumbnail('https://whitepigeons-35431.web.app/logo.png')
            .setTimestamp();

          const message = await channel.send({ embeds: [embed] });
          
          const currentWebhooks = config.webhooks || {};
          currentWebhooks.allTimeKillsMessageId = message.id;
          currentWebhooks.allTimeKillsChannelId = channel.id;
          await db.saveConfig({ ...config, webhooks: currentWebhooks });

          botService.logSimulated(`Successfully deployed All Time Kills Leaderboard to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy All Time Kills Leaderboard:', err.message);
      }
    }

    botService.logSimulated('[Mock Panel] Deployed All Time Kills Leaderboard in #long-time-kill-list channel.');
    return true;
  },

  syncAllTimeKillsMessage: async () => {
    const config = await db.getConfig();
    const webhooks = config.webhooks || {};
    const messageId = webhooks.allTimeKillsMessageId;
    const channelId = webhooks.allTimeKillsChannelId;

    if (!messageId || !channelId || !client) return;

    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          const members = await db.getMembers();
          const sorted = [...members]
            .filter(m => !['PigeonBoss', 'VitoScaletta', 'TonyMontana'].includes(m.username))
            .sort((a, b) => b.kills - a.kills)
            .slice(0, 30);

          const entries = sorted.map((m, idx) => {
            let rankIcon = `#${idx + 1}`;
            if (idx === 0) rankIcon = '👑 #1';
            else if (idx === 1) rankIcon = '⭐ #2';
            else if (idx === 2) rankIcon = '⚡ #3';
            return `• ${rankIcon} <@${m.discordId}> 💀 **${m.kills}** kills`;
          }).join('\n');

          const embed = new EmbedBuilder()
            .setTitle('💀 ALL TIME KILLS LEADERBOARD 💀')
            .setDescription(`🔥 Elite Marksmen of White Pigeons 🔥\n\n${entries}`)
            .setColor(0xff0000)
            .setThumbnail('https://whitepigeons-35431.web.app/logo.png')
            .setTimestamp();

          await message.edit({ embeds: [embed] });
          botService.logSimulated('Successfully updated active Discord All Time Kills Leaderboard message.');
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to sync All Time Kills Leaderboard:', err.message);
    }
  },

  deployWeeklyKillsPrompt: async () => {
    botService.logSimulated('Attempting to deploy Weekly Kills Leaderboard prompt to Discord channel...');
    const config = await db.getConfig();

    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = await findChannel(guild, c => cleanName(c.name).includes('weekly-kill') || cleanName(c.name).includes('weekly') || cleanName(c.name).includes('kill-list'));
        if (!channel) {
          channel = await findChannel(guild, c => cleanName(c.name).includes('general') || cleanName(c.name).includes('announcement'));
        }

        if (channel) {
          const members = await db.getMembers();
          const sorted = [...members]
            .filter(m => !['PigeonBoss', 'VitoScaletta', 'TonyMontana'].includes(m.username))
            .sort((a, b) => b.weeklyKills - a.weeklyKills)
            .slice(0, 25);

          const entries = sorted.map((m, idx) => {
            let rankIcon = `#${idx + 1}`;
            if (idx === 0) rankIcon = '🥇 #1';
            else if (idx === 1) rankIcon = '🥈 #2';
            else if (idx === 2) rankIcon = '🥉 #3';
            return `• ${rankIcon} - <@${m.discordId}> - 💀 **${m.weeklyKills}** kills`;
          }).join('\n');

          const embed = new EmbedBuilder()
            .setTitle('📊 WEEKLY KILLS LEADERBOARD 📊')
            .setDescription(`🔥 Top Marksmen This Week 🔥\n\n${entries}`)
            .setColor(0xff003c)
            .setThumbnail('https://whitepigeons-35431.web.app/logo.png')
            .setTimestamp();

          const message = await channel.send({ embeds: [embed] });
          
          const currentWebhooks = config.webhooks || {};
          currentWebhooks.weeklyKillsMessageId = message.id;
          currentWebhooks.weeklyKillsChannelId = channel.id;
          await db.saveConfig({ ...config, webhooks: currentWebhooks });

          botService.logSimulated(`Successfully deployed Weekly Kills Leaderboard to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy Weekly Kills Leaderboard:', err.message);
      }
    }

    botService.logSimulated('[Mock Panel] Deployed Weekly Kills Leaderboard in #weekly-kill-list channel.');
    return true;
  },

  syncWeeklyKillsMessage: async () => {
    const config = await db.getConfig();
    const webhooks = config.webhooks || {};
    const messageId = webhooks.weeklyKillsMessageId;
    const channelId = webhooks.weeklyKillsChannelId;

    if (!messageId || !channelId || !client) return;

    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          const members = await db.getMembers();
          const sorted = [...members]
            .filter(m => !['PigeonBoss', 'VitoScaletta', 'TonyMontana'].includes(m.username))
            .sort((a, b) => b.weeklyKills - a.weeklyKills)
            .slice(0, 25);

          const entries = sorted.map((m, idx) => {
            let rankIcon = `#${idx + 1}`;
            if (idx === 0) rankIcon = '🥇 #1';
            else if (idx === 1) rankIcon = '🥈 #2';
            else if (idx === 2) rankIcon = '🥉 #3';
            return `• ${rankIcon} - <@${m.discordId}> - 💀 **${m.weeklyKills}** kills`;
          }).join('\n');

          const embed = new EmbedBuilder()
            .setTitle('📊 WEEKLY KILLS LEADERBOARD 📊')
            .setDescription(`🔥 Top Marksmen This Week 🔥\n\n${entries}`)
            .setColor(0xff003c)
            .setThumbnail('https://whitepigeons-35431.web.app/logo.png')
            .setTimestamp();

          await message.edit({ embeds: [embed] });
          botService.logSimulated('Successfully updated active Discord Weekly Kills Leaderboard message.');
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to sync Weekly Kills Leaderboard:', err.message);
    }
  },

  formatMemberForEmbed: (m) => {
    if (!m) return 'Unknown';
    if (m.discordId.includes('mock') || m.discordId === 'admin-local') {
      return `@${m.username || 'Unknown'}`;
    }
    if (m.discordId.length < 15) {
      let name = m.nickname || m.username || 'Unknown';
      if (name.startsWith('<@') || name.startsWith('@')) {
        return name;
      }
      return `@${name}`;
    }
    return `<@${m.discordId}>`;
  },

  getResolvedPriorityList: async () => {
    const list = await db.getPriorityList();
    const members = await db.getMembers();
    const memberMap = new Map(members.map(m => [m.discordId, m]));

    const top5Resolved = (list.top5 || []).map(id => memberMap.get(id)).filter(Boolean);
    const top10Resolved = (list.top10 || []).map(id => memberMap.get(id)).filter(Boolean);

    return {
      top5: top5Resolved,
      top10: top10Resolved
    };
  },

  deployPriorityListPrompt: async () => {
    botService.logSimulated('Attempting to deploy Priority Members list to Discord channel...');
    const config = await db.getConfig();

    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = await findChannel(guild, c => cleanName(c.name).includes('top-10') || cleanName(c.name).includes('priority') || cleanName(c.name).includes('roster') || cleanName(c.name).includes('members'));
        if (!channel) {
          channel = await findChannel(guild, c => cleanName(c.name).includes('general') || cleanName(c.name).includes('announcement'));
        }

        if (channel) {
          const resolved = await botService.getResolvedPriorityList();
          const top5Entries = resolved.top5.map((m, idx) => `${idx + 1}. ${botService.formatMemberForEmbed(m)}`).join('\n') || '*No members*';
          const top10Entries = resolved.top10.map((m, idx) => `${idx + 1}. ${botService.formatMemberForEmbed(m)}`).join('\n') || '*No members*';

          const embed = new EmbedBuilder()
            .setTitle('Priority Members')
            .setColor(0xffd700)
            .addFields(
              { name: 'TOP 5 Members', value: top5Entries, inline: true },
              { name: 'TOP 10 Members', value: top10Entries, inline: true }
            )
            .setThumbnail('https://whitepigeons-35431.web.app/logo.png')
            .setFooter({ text: 'White Pigeons #TOP1 • Priority List' });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('priority_add_top5')
              .setLabel('+ Add Top 5 Member')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('priority_add_top10')
              .setLabel('+ Add Top 10 Member')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('priority_remove_top5')
              .setLabel('X Remove Top 5 Member')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('priority_remove_top10')
              .setLabel('X Remove Top 10 Member')
              .setStyle(ButtonStyle.Danger)
          );

          const message = await channel.send({ embeds: [embed], components: [row] });
          
          const currentWebhooks = config.webhooks || {};
          currentWebhooks.priorityMessageId = message.id;
          currentWebhooks.priorityChannelId = channel.id;
          await db.saveConfig({ ...config, webhooks: currentWebhooks });

          botService.logSimulated(`Successfully deployed Priority Members list to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy Priority Members list:', err.message);
      }
    }

    botService.logSimulated('[Mock Panel] Deployed Priority Members embed in #top-10-list channel.');
    return true;
  },

  syncPriorityListMessage: async () => {
    const config = await db.getConfig();
    const webhooks = config.webhooks || {};
    const messageId = webhooks.priorityMessageId;
    const channelId = webhooks.priorityChannelId;

    if (!messageId || !channelId || !client) return;

    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          const resolved = await botService.getResolvedPriorityList();
          const top5Entries = resolved.top5.map((m, idx) => `${idx + 1}. ${botService.formatMemberForEmbed(m)}`).join('\n') || '*No members*';
          const top10Entries = resolved.top10.map((m, idx) => `${idx + 1}. ${botService.formatMemberForEmbed(m)}`).join('\n') || '*No members*';

          const embed = new EmbedBuilder()
            .setTitle('Priority Members')
            .setColor(0xffd700)
            .addFields(
              { name: 'TOP 5 Members', value: top5Entries, inline: true },
              { name: 'TOP 10 Members', value: top10Entries, inline: true }
            )
            .setThumbnail('https://whitepigeons-35431.web.app/logo.png')
            .setFooter({ text: 'White Pigeons #TOP1 • Priority List' });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('priority_add_top5')
              .setLabel('+ Add Top 5 Member')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('priority_add_top10')
              .setLabel('+ Add Top 10 Member')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('priority_remove_top5')
              .setLabel('X Remove Top 5 Member')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('priority_remove_top10')
              .setLabel('X Remove Top 10 Member')
              .setStyle(ButtonStyle.Danger)
          );

          await message.edit({ embeds: [embed], components: [row] });
          botService.logSimulated('Successfully updated active Discord Priority Members list.');
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to sync Priority Members list:', err.message);
    }
  }
};

module.exports = botService;
