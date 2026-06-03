const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, MessageFlags, Partials } = require('discord.js');

const isProduction = () => {
  return process.env.NODE_ENV === 'production' || process.env.USE_FIRESTORE === 'true';
};

const getEnvPrefix = () => {
  return isProduction() ? 'prod:' : 'dev:';
};

const p = (id) => `${getEnvPrefix()}${id}`;

const db = require('./database');
const axios = require('axios');
const { isDiscordWebhookUrl, sanitizeString } = require('./security');

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

const findSignupChannel = async (guild, eventId) => {
  const eventClean = (eventId || '').toLowerCase();
  
  if (eventClean === 'rp-signup') {
    // 1. Try to find precise channel containing both 'rp' and either 'ticket', 'signup', or 'roster'
    let ch = await findChannel(guild, c => {
      const name = cleanName(c.name);
      return name.includes('rp') && (name.includes('ticket') || name.includes('signup') || name.includes('roster'));
    });
    if (ch) return ch;

    // 2. Try to find any channel containing both 'rp' and not containing 'collect', 'log', 'shop'
    ch = await findChannel(guild, c => {
      const name = cleanName(c.name);
      return name.includes('rp') && !name.includes('collect') && !name.includes('log') && !name.includes('shop');
    });
    if (ch) return ch;
  } 
  
  else if (eventClean === 'signup-event') {
    // 1. Try to find precise channel containing both 'event' and 'signup'
    let ch = await findChannel(guild, c => {
      const name = cleanName(c.name);
      return name.includes('event') && name.includes('signup');
    });
    if (ch) return ch;

    // 2. Try to find any channel containing 'event' but not containing 'rp' or 'informal'
    ch = await findChannel(guild, c => {
      const name = cleanName(c.name);
      return name.includes('event') && !name.includes('rp') && !name.includes('informal');
    });
    if (ch) return ch;
  } 
  
  else if (eventClean === 'informal-signup') {
    // 1. Try to find precise channel containing both 'informal' and either 'signup', 'roster', or 'gunfight'
    let ch = await findChannel(guild, c => {
      const name = cleanName(c.name);
      return name.includes('informal') && (name.includes('signup') || name.includes('roster') || name.includes('gunfight'));
    });
    if (ch) return ch;

    // 2. Try to find any channel containing 'informal'
    ch = await findChannel(guild, c => {
      const name = cleanName(c.name);
      return name.includes('informal') && !name.includes('log');
    });
    if (ch) return ch;
  }
  
  // Overall fallback if still not found: search by matching the exact key in names
  if (eventClean === 'rp-signup') {
    let chFallback = await findChannel(guild, c => {
      const name = cleanName(c.name);
      return name.includes('rp') && !name.includes('informal') && !name.includes('event') && !name.includes('collect') && !name.includes('log');
    });
    if (chFallback) return chFallback;
  } else if (eventClean === 'informal-signup') {
    let chFallback = await findChannel(guild, c => {
      const name = cleanName(c.name);
      return name.includes('informal') && !name.includes('rp') && !name.includes('event') && !name.includes('log');
    });
    if (chFallback) return chFallback;
  } else if (eventClean === 'signup-event') {
    let chFallback = await findChannel(guild, c => {
      const name = cleanName(c.name);
      return name.includes('event') && !name.includes('rp') && !name.includes('informal') && !name.includes('log');
    });
    if (chFallback) return chFallback;
  }

  // Final emergency fallback to any channel containing 'signup' prioritizing event types
  let chFinal = await findChannel(guild, c => {
    const name = cleanName(c.name);
    if (eventClean === 'rp-signup') return name.includes('rp') && name.includes('signup');
    if (eventClean === 'informal-signup') return name.includes('informal') && name.includes('signup');
    if (eventClean === 'signup-event') return name.includes('event') && name.includes('signup');
    return name.includes('signup');
  });
  if (chFinal) return chFinal;

  return await findChannel(guild, c => cleanName(c.name).includes('signup'));
};

const isAuthorizedAdmin = (member) => {
  if (!member) return false;
  if (member.permissions && (member.permissions.has('Administrator') || member.permissions.has('ManageMessages'))) return true;
  if (member.roles && member.roles.cache) {
    return member.roles.cache.some(r => {
      const name = cleanName(r.name);
      return name.includes('leadership') || name.includes('admin') || name.includes('leader') || name.includes('underboss') || name.includes('deputy') || name.includes('manager') || name.includes('high command') || name.includes('moderator');
    });
  }
  return false;
};

let client = null;
let bizwarClient = null;
let rpClient = null;
let ioInstance = null; // Socket.io reference to broadcast simulated logs

const botService = {
  setIo: (io) => {
    ioInstance = io;
  },

  isReady: () => {
    return client && client.readyAt !== null;
  },

  getGuild: async (guildId) => {
    if (!client) return null;
    let guild = client.guilds.cache.get(guildId);
    if (!guild) {
      try {
        guild = await client.guilds.fetch(guildId);
      } catch (err) {
        guild = client.guilds.cache.first();
      }
    }
    if (!guild) {
      guild = client.guilds.cache.first();
    }
    return guild;
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
          const channel = await findSignupChannel(guild, eventId);
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
          `🎉 Good news! You have been promoted to the **confirmed** roster for the **${eventId === 'rp-signup' ? 'RP' : eventId === 'signup-event' ? 'Signup-Event' : 'Informal'} Signup**!`
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
    if (bizwarClient && bizwarClient !== client) {
      try {
        bizwarClient.destroy();
      } catch (err) {
        console.error('[Bot] Error destroying old bizwarClient:', err.message);
      }
    }
    bizwarClient = null;
    if (rpClient && rpClient !== client) {
      try {
        rpClient.destroy();
      } catch (err) {
        console.error('[Bot] Error destroying old rpClient:', err.message);
      }
    }
    rpClient = null;
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
          GatewayIntentBits.GuildVoiceStates,
          GatewayIntentBits.GuildMessageReactions
        ],
        partials: [Partials.Message, Partials.Channel, Partials.Reaction]
      });

      client.once('ready', () => {
        console.log(`[Bot] Connected as ${client.user.tag}`);
        botService.logSimulated(`Discord Bot Connected live as ${client.user.tag}`);
        const guildIds = client.guilds.cache.map(g => `${g.name} (${g.id})`).join(', ');
        console.log(`[Bot] Connected to guilds: [${guildIds}]`);
      });

      client.on('error', (err) => {
        console.error('[Bot] Client Error:', err);
        botService.logSimulated(`Bot Connection Error: ${err.message}`);
      });

      const handleMessageCreate = async (message) => {
        if (message.author.bot) return;
        botService.logSimulated(`Message in #${message.channel?.name || 'unknown'} by @${message.author.username}: "${message.content}"`);

        const config = await db.getConfig();
        const winChannelId = config.publicWinLogChannelId;
        const informalChannelId = config.publicInformalLogChannelId;

        const chanName = cleanName(message.channel?.name || '');
        const isWinChannel = message.channel.id === winChannelId || chanName.includes('win-log') || chanName.includes('winlog');
        const isInformalChannel = message.channel.id === informalChannelId || chanName.includes('informal-log') || chanName.includes('informallog');
        const isBizwarChannel = chanName.includes('bizwar') && (chanName.includes('collect') || chanName.includes('log') || chanName.includes('profit'));
        const isRpChannel = chanName.includes('rp') && (chanName.includes('collect') || chanName.includes('log') || chanName.includes('ticket'));

        if (isBizwarChannel && message.attachments.size > 0) {
          try {
            const attachment = message.attachments.first();
            if (attachment && attachment.contentType && attachment.contentType.startsWith('image/')) {
              // Find last Bizwar log for this member created in the last 15 minutes
              const logs = await db.getBizWarLogs();
              const userLogs = logs.filter(l => l.memberId === message.author.id);
              if (userLogs.length > 0) {
                const lastLog = userLogs[0];
                const diffMs = Date.now() - new Date(lastLog.timeCollected).getTime();
                if (diffMs < 15 * 60 * 1000) { // 15 mins window
                  // Update log with proofUrl
                  await db.updateBizWarLog(lastLog.id, { proofUrl: attachment.url });
                  botService.logSimulated(`Linked pasted screenshot to Bizwar collection log ${lastLog.id} for @${message.author.username}`);
                  
                  // Sync the Discord embed message
                  await botService.syncBizwarCollectionMessage();
                  
                  // React to confirm
                  await message.react('✅');
                  
                  // Also notify the socket clients
                  botService.broadcastSocket('leaderboard_update', await db.getMembers());
                  botService.broadcastSocket('bizwar_update', await db.getBizWarLogs());
                }
              }
            }
          } catch (err) {
            console.error('Error handling bizwar screenshot upload:', err.message);
          }
          return;
        }

        if (isRpChannel && message.attachments.size > 0) {
          try {
            const attachment = message.attachments.first();
            if (attachment && attachment.contentType && attachment.contentType.startsWith('image/')) {
              // Find last RP ticket log for this member created in the last 15 minutes
              const logs = await db.getRpTicketLogs();
              const userLogs = logs.filter(l => l.memberId === message.author.id);
              if (userLogs.length > 0) {
                const lastLog = userLogs[0];
                const diffMs = Date.now() - new Date(lastLog.timeCollected || lastLog.createdAt).getTime();
                if (diffMs < 15 * 60 * 1000) { // 15 mins window
                  // Update log with proofUrl
                  await db.updateRpTicketLog(lastLog.id, { proofUrl: attachment.url });
                  
                  // Also update rpCollectionState if it is in the collectionsList
                  const state = await db.getRpCollectionState();
                  let stateUpdated = false;
                  if (state.collectionsList) {
                    const idx = state.collectionsList.findIndex(c => c.logId === lastLog.id);
                    if (idx !== -1) {
                      state.collectionsList[idx].proofUrl = attachment.url;
                      stateUpdated = true;
                    }
                  }
                  if (stateUpdated) {
                    await db.saveRpCollectionState(state);
                  }
                  
                  botService.logSimulated(`Linked pasted screenshot to RP ticket collection log ${lastLog.id} for @${message.author.username}`);
                  
                  // Sync the Discord embed message
                  await botService.syncRpCollectionMessage();
                  
                  // React to confirm
                  await message.react('✅');
                  
                  // Also notify the socket clients
                  botService.broadcastSocket('leaderboard_update', await db.getMembers());
                  botService.broadcastSocket('rp_update', await db.getRpTicketLogs());
                }
              }
            }
          } catch (err) {
            console.error('Error handling RP ticket screenshot upload:', err.message);
          }
          return;
        }

        if (isWinChannel || isInformalChannel) {
          try {
            const mediaUrl = message.attachments.first()?.url || 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500';
            const type = isWinChannel ? 'public-winlog' : 'public-informallog';

            const lines = message.content.split('\n').map(l => l.trim()).filter(Boolean);
            let eventName = isWinChannel ? 'Weapons Factory' : 'Informal';
            let baseAmount = isWinChannel ? 200000 : 70000;
            let dateTimeStr = new Date().toISOString().split('T')[0];
            let timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
            let participants = [];

            if (lines.length > 0 && lines[0].includes('|')) {
              const headerParts = lines[0].split('|').map(p => p.trim());
              if (headerParts[0]) eventName = headerParts[0];
              if (headerParts[1]) {
                const rawPrice = headerParts[1].replace(/[$/\s]|kill|k/gi, '').toLowerCase();
                let multiplier = 1;
                if (headerParts[1].toLowerCase().includes('k')) {
                  multiplier = 1000;
                }
                const parsedVal = parseFloat(rawPrice) * multiplier;
                if (!isNaN(parsedVal)) baseAmount = parsedVal;
              }
              if (headerParts[2]) {
                const dtPart = headerParts[2];
                if (dtPart.includes(' ')) {
                  const splitted = dtPart.split(/\s+/);
                  dateTimeStr = splitted[0];
                  timeStr = splitted[1];
                } else {
                  dateTimeStr = dtPart;
                }
              }
              if (headerParts[3]) {
                timeStr = headerParts[3];
              }
            }

            for (let i = 1; i < lines.length; i++) {
              const line = lines[i];
              if (line.toLowerCase().includes('kill list:')) continue;

              const killMatch = line.match(/(\d+)\s*k\s*$/i) || line.match(/(\d+)\s*k\s+/i) || line.match(/\s+(\d+)\s*$/);
              let kills = 1;
              let cleanLine = line;
              if (killMatch) {
                kills = parseInt(killMatch[1], 10);
                cleanLine = line.replace(killMatch[0], '').trim();
              }

              let username = cleanLine;
              if (username.startsWith('@')) {
                username = username.substring(1);
              }
              username = username.split('|')[0].trim();
              const idMatch = username.match(/\s+\d{4,9}$/);
              if (idMatch) {
                username = username.replace(idMatch[0], '').trim();
              }

              if (username) {
                participants.push(`${username}|${kills}`);
              }
            }

            if (participants.length === 0) {
              participants.push(`${message.author.username}|1`);
              message.mentions.users.forEach(u => {
                if (u.username !== message.author.username && !u.bot) {
                  participants.push(`${u.username}|1`);
                }
              });
            }

            const submission = await db.createWinSubmission({
              source: 'discord',
              discordMessageId: message.id,
              guildId: message.guild ? message.guild.id : null,
              channelId: message.channel ? message.channel.id : null,
              submitterId: message.author.id,
              submitterName: message.author.username,
              type,
              title: `${eventName} Win by ${message.author.username}`,
              participants,
              mediaUrl,
              baseAmount,
              eventName,
              dateTimeStr,
              timeStr,
              rawContent: message.content
            });

            botService.logSimulated(`Ingested win submission "${submission.title}" from Discord.`);
            
            try {
              // React with reviewing indicator
              await message.react('⏳');
            } catch {}

            // Send reminder template
            try {
              await message.channel.send({
                content: `ℹ️ **White Pigeons REG** APP\n**Please Follow New Format on Logs**\n\`\`\`\nEvent Name | Bonus Price | Date & Time\nKill List:\n@user 1k\n@user 5k\n\`\`\`\n*"You must send the photo in the same message of the kills"*\n\n**Note:**\n⏳ This means reviewing\n❌ It is rejected\n✅ It is approved\n⚠️ There is an error, send logs again`
              });
            } catch {}

            botService.broadcastSocket('win_submissions_update', await db.getWinSubmissions());
          } catch (err) {
            console.error('[Bot] Win log ingestion failed:', err.message);
          }
        }
      };

      client.on('messageCreate', handleMessageCreate);

      client.on('messageReactionAdd', async (reaction, user) => {
        if (reaction.partial) {
          try {
            await reaction.fetch();
          } catch (err) {
            console.error('[Bot] Failed to fetch partial reaction:', err.message);
            return;
          }
        }

        if (user.bot) return;
        if (reaction.emoji.name !== '✅') return;

        const { message } = reaction;
        if (!message.guild) return;

        const config = await db.getConfig();
        const winChannelId = config.publicWinLogChannelId;
        const informalChannelId = config.publicInformalLogChannelId;

        const chanName = cleanName(message.channel?.name || '');
        const isWinChannel = message.channel.id === winChannelId || chanName.includes('win-log') || chanName.includes('winlog');
        const isInformalChannel = message.channel.id === informalChannelId || chanName.includes('informal-log') || chanName.includes('informallog');

        if (!isWinChannel && !isInformalChannel) return;

        const member = await message.guild.members.fetch(user.id).catch(() => null);
        if (!isAuthorizedAdmin(member)) {
          try {
            await reaction.users.remove(user.id);
          } catch {}
          return;
        }

        const winSubmissions = await db.getWinSubmissions();
        const submission = winSubmissions.find(s => s.discordMessageId === message.id);
        if (!submission) {
          botService.logSimulated(`No win submission found in database for message ID ${message.id}`);
          return;
        }

        if (submission.status !== 'pending' && submission.status !== 'reviewing') {
          return;
        }

        const approvalChannel = message.guild.channels.cache.find(c => {
          const name = cleanName(c.name);
          return name.includes('bonus-approval') || name.includes('bonus-approve');
        });

        if (!approvalChannel) {
          botService.logSimulated('[Bot Error] Could not find #bonus-approval channel.');
          return;
        }

        await db.updateWinSubmission(submission.id, {
          status: 'reviewing',
          reviewedBy: user.username,
          reviewedAt: new Date().toISOString()
        });

        try {
          await botService.sendBonusApprovalInteractiveEmbed(approvalChannel, submission);
          
          try {
            const reviewingReact = message.reactions.cache.get('⏳');
            if (reviewingReact) await reviewingReact.users.remove(client.user.id);
            await message.react('✅');
          } catch {}
        } catch (err) {
          console.error('[Bot] Failed to send bonus approval details:', err.message);
        }
      });

      // Discord interaction listener for components and modals
      const handleInteraction = async (interaction) => {
        // Filter by environment using customId prefix if present
        if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
          let customId = interaction.customId;
          const isProd = process.env.NODE_ENV === 'production' || process.env.USE_FIRESTORE === 'true';
          const currentEnv = isProd ? 'prod' : 'dev';
          
          if (customId.startsWith('dev:') || customId.startsWith('prod:')) {
            if (customId.startsWith('dev:') && currentEnv !== 'dev') {
              return; // Ignore dev interaction on prod bot
            }
            if (customId.startsWith('prod:') && currentEnv !== 'prod') {
              return; // Ignore prod interaction on dev bot
            }
            // Strip the prefix for the rest of the code
            Object.defineProperty(interaction, 'customId', {
              value: customId.substring(customId.indexOf(':') + 1),
              writable: true,
              configurable: true
            });
          }
        }
        // 1. Button interactions
        if (interaction.isButton()) {
          const customId = interaction.customId;
          
          if (customId === 'trigger_role_request') {
            const modal = new ModalBuilder()
              .setCustomId(p('role_request_modal'))
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
          
          else if (customId === 'bizwar_collect_btn') {
            try {
              // Check cooldown
              const logs = await db.getBizWarLogs();
              const lastLog = logs[0];
              if (lastLog) {
                const lastTime = new Date(lastLog.timeCollected).getTime();
                const elapsed = Date.now() - lastTime;
                const cooldownPeriod = 24 * 60 * 60 * 1000;
                if (elapsed < cooldownPeriod) {
                  const remainingMs = cooldownPeriod - elapsed;
                  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
                  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
                  return interaction.reply({
                    content: `❌ **Bizwar profits collection is on cooldown.**\nAvailable in **${hours}h ${minutes}m**.`,
                    flags: [MessageFlags.Ephemeral]
                  });
                }
              }

              // Not on cooldown, show modal
              const modal = new ModalBuilder()
                .setCustomId(p('bizwar_collect_modal'))
                .setTitle('Bizwar Profit Collection');

              const amtInput = new TextInputBuilder()
                .setCustomId('bizwar_amount')
                .setLabel('Amount Collected ($)')
                .setPlaceholder('e.g. 450000')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

              const proofsInput = new TextInputBuilder()
                .setCustomId('bizwar_proofs')
                .setLabel('Proofs (screenshot link)')
                .setPlaceholder('Paste a Discord image link, Imgur link, etc.')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false);

              modal.addComponents(
                new ActionRowBuilder().addComponents(amtInput),
                new ActionRowBuilder().addComponents(proofsInput)
              );

              await interaction.showModal(modal);
            } catch (err) {
              console.error('Error in bizwar_collect_btn handler:', err.message);
              await interaction.reply({ content: '⚠️ Failed to open collection modal.', flags: [MessageFlags.Ephemeral] });
            }
          }

          else if (customId === 'rp_collect_btn') {
            try {
              const state = await db.getRpCollectionState();
              if (state.collectionsCount >= state.maxCollections) {
                return interaction.reply({
                  content: `❌ **RP Ticket Collection shifts are full (${state.collectionsCount}/${state.maxCollections}).**`,
                  flags: [MessageFlags.Ephemeral]
                });
              }

              // Create the log in DB
              const log = await db.createRpTicketLog({
                memberId: interaction.user.id,
                username: interaction.user.username,
                ticketsCollected: 5,
                timeCollected: new Date().toISOString()
              });

              // Add to state
              state.collectionsList.push({
                logId: log.id,
                discordId: interaction.user.id,
                username: interaction.user.username,
                ticketsCollected: 5,
                time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
              });
              state.collectionsCount = state.collectionsList.length;
              await db.saveRpCollectionState(state);

              // Update Discord message
              await botService.syncRpCollectionMessage();

              // Send webhook & Socket broadcast
              const stats = await db.getRpTicketStats();
              const embed = {
                title: '🎫 RP TICKET FACTORY COLLECTION',
                description: `RP Tickets successfully harvested.`,
                color: 0x00f0ff,
                fields: [
                  { name: 'Collector', value: `<@${interaction.user.id}>`, inline: true },
                  { name: 'Tickets Collected', value: `5 RP Tickets`, inline: true },
                  { name: 'Total Vault Stock', value: `${stats.totalCollected} RP Tickets`, inline: true }
                ]
              };
              await botService.sendWebhook('rp-collect', embed);
              botService.broadcastSocket('leaderboard_update', await db.getMembers());

              await interaction.reply({
                content: `✅ Successfully registered your shift collection of **5 RP tickets**.`,
                flags: [MessageFlags.Ephemeral]
              });
            } catch (err) {
              console.error('Error in rp_collect_btn handler:', err.message);
              await interaction.reply({
                content: `❌ Error registering collection: ${err.message}`,
                flags: [MessageFlags.Ephemeral]
              });
            }
          }

          else if (customId === 'rp_collect_by_id_btn') {
            try {
              const state = await db.getRpCollectionState();
              if (state.collectionsCount >= state.maxCollections) {
                return interaction.reply({
                  content: `❌ **RP Ticket Collection shifts are full (${state.collectionsCount}/${state.maxCollections}).**`,
                  flags: [MessageFlags.Ephemeral]
                });
              }

              const modal = new ModalBuilder()
                .setCustomId(p('rp_collect_by_id_modal'))
                .setTitle('Collect RP Ticket By User');

              const idInput = new TextInputBuilder()
                .setCustomId('rp_member_input')
                .setLabel('Discord ID, Username, or Nickname')
                .setPlaceholder('e.g. 3572 or VitoScaletta')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

              const countInput = new TextInputBuilder()
                .setCustomId('rp_count_input')
                .setLabel('Tickets Collected')
                .setValue('5')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

              modal.addComponents(
                new ActionRowBuilder().addComponents(idInput),
                new ActionRowBuilder().addComponents(countInput)
              );

              await interaction.showModal(modal);
            } catch (err) {
              console.error('Error in rp_collect_by_id_btn handler:', err.message);
              await interaction.reply({ content: '⚠️ Failed to open ID collection modal.', flags: [MessageFlags.Ephemeral] });
            }
          }

          else if (customId === 'rp_undo_btn') {
            try {
              const state = await db.getRpCollectionState();
              if (!state.collectionsList || state.collectionsList.length === 0) {
                return interaction.reply({
                  content: `❌ **No collections registered in this session to undo.**`,
                  flags: [MessageFlags.Ephemeral]
                });
              }

              const removed = state.collectionsList.pop();
              state.collectionsCount = state.collectionsList.length;
              await db.saveRpCollectionState(state);

              // Delete from DB
              if (removed && removed.logId) {
                await db.deleteRpTicketLog(removed.logId);
              }

              // Update Discord message
              await botService.syncRpCollectionMessage();

              // Send update to webhook or socket
              botService.broadcastSocket('leaderboard_update', await db.getMembers());

              await interaction.reply({
                content: `🔄 Undid last collection by <@${removed.discordId}>.`,
                flags: [MessageFlags.Ephemeral]
              });
            } catch (err) {
              console.error('Error in rp_undo_btn handler:', err.message);
              await interaction.reply({
                content: `❌ Error undoing last collection: ${err.message}`,
                flags: [MessageFlags.Ephemeral]
              });
            }
          }

          else if (customId === 'refresh_stats') {
            try {
              const stats = await db.getFamilyStats();
              const updatedEmbed = await botService.buildStatsEmbed(stats);
              
              const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(p('refresh_stats'))
                  .setLabel('🔄 Refresh Stats')
                  .setStyle(ButtonStyle.Secondary)
              );
              
              await interaction.update({ embeds: [updatedEmbed], components: [row] });
            } catch (err) {
              console.error('[Bot] Failed to refresh family stats in Discord:', err.message);
              await interaction.reply({ content: '⚠️ Failed to refresh stats. Please try again later.', flags: [MessageFlags.Ephemeral] });
            }
          }
          else if (customId === 'my_strikes') {
            try {
              const members = await db.getMembers();
              const member = members.find(m => m.discordId === interaction.user.id);
              
              if (!member || !member.strikes || member.strikes.length === 0) {
                return interaction.reply({ content: '✅ **You have 0 active strikes.** Keep up the good work!', flags: [MessageFlags.Ephemeral] });
              }
              
              const list = member.strikes.map((st, idx) => `${idx + 1}. **"${st.reason}"** (Issued by: @${st.issuedBy} on ${new Date(st.date).toLocaleDateString()})`).join('\n');
              await interaction.reply({
                content: `🚨 **Your Active Strikes (${member.strikes.length}/3)**:\n\n${list}\n\n*Accumulating 3 strikes will result in automatic blacklist / suspension.*`,
                flags: [MessageFlags.Ephemeral]
              });
            } catch (err) {
              console.error('[Bot] Failed to retrieve user strikes:', err.message);
              await interaction.reply({ content: '⚠️ Failed to check your strikes. Please try again later.', flags: [MessageFlags.Ephemeral] });
            }
          }
          else if (customId === 'priority_add_top5' || customId === 'priority_add_top10') {
            const type = customId.includes('top5') ? 'top5' : 'top10';
            const label = type === 'top5' ? 'Top 5' : 'Top 10';
            const modal = new ModalBuilder()
              .setCustomId(p(`priority_add_modal:${type}`))
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
              .setCustomId(p(`priority_remove_modal:${type}`))
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
              return interaction.reply({ content: '❌ Role request not found in database.', flags: [MessageFlags.Ephemeral] });
            }
            if (reqObj.status !== 'pending') {
              return interaction.reply({ content: `❌ This request has already been reviewed (${reqObj.status}).`, flags: [MessageFlags.Ephemeral] });
            }
            
            const selected = reqObj.selectedRoles || [];
            if (selected.length === 0) {
              return interaction.reply({ content: '⚠️ Please select at least one role from the dropdown first before approving.', flags: [MessageFlags.Ephemeral] });
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
            await interaction.reply({ content: '✅ Role request approved and roles assigned.', flags: [MessageFlags.Ephemeral] });

            botService.broadcastSocket('role_requests_update', await db.getRoleRequests());
          }
          
          else if (customId.startsWith('role_reject:')) {
            const requestId = customId.split(':')[1];
            const reqs = await db.getRoleRequests();
            const reqObj = reqs.find(r => r.id === requestId);
            if (!reqObj) {
              return interaction.reply({ content: '❌ Role request not found in database.', flags: [MessageFlags.Ephemeral] });
            }
            if (reqObj.status !== 'pending') {
              return interaction.reply({ content: `❌ This request has already been reviewed (${reqObj.status}).`, flags: [MessageFlags.Ephemeral] });
            }

            await db.updateRoleRequest(requestId, {
              status: 'rejected',
              reviewer: interaction.user.username
            });

            await botService.sendDirectMessage(reqObj.discordId, `⚠️ Your role request was declined. Reason: Disapproved by leadership.`);

            const rejectedEmbed = await botService.buildRoleReviewEmbed(requestId);
            await interaction.message.edit({ embeds: [rejectedEmbed], components: [] });
            await interaction.reply({ content: '❌ Role request rejected.', flags: [MessageFlags.Ephemeral] });

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
                await interaction.reply({ content: `✅ Spot confirmed! Status: Confirmed.`, flags: [MessageFlags.Ephemeral] });
              } else if (result.action === 'displaced') {
                await interaction.reply({ content: `🔥 Spot confirmed! As a Top 10 shooter, you displaced the latest non-Top 10 signup.`, flags: [MessageFlags.Ephemeral] });
                if (result.displaced) {
                  botService.sendDirectMessage(
                    result.displaced.memberId, 
                    `⚠️ You have been displaced from the **${eventId === 'rp-signup' ? 'RP Signup' : eventId === 'signup-event' ? 'Signup-Event Signup' : 'Informal Signup'}** queue by a Top 10 member. You are now in the reserve list.`
                  );
                }
              } else {
                await interaction.reply({ content: `⏳ Queue full. You are on the Reserve List.`, flags: [MessageFlags.Ephemeral] });
              }
            } else {
              await interaction.reply({ content: `❌ ${result.message}`, flags: [MessageFlags.Ephemeral] });
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

              await interaction.reply({ content: `👋 You have successfully left the signup queue.`, flags: [MessageFlags.Ephemeral] });
            } else {
              await interaction.reply({ content: `❌ ${result.message}`, flags: [MessageFlags.Ephemeral] });
            }
          }
          else if (customId.startsWith('admin_actions:')) {
            const eventId = customId.split(':')[1];
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            const isLead = member ? member.roles.cache.some(r => r.name.toLowerCase().includes('leadership') || r.name.toLowerCase().includes('admin')) : false;

            if (!isLead) {
              return interaction.reply({ content: '❌ You do not have permission to use admin actions.', flags: [MessageFlags.Ephemeral] });
            }

            const signups = await db.getSignups(eventId);
            if (signups.length === 0) {
              return interaction.reply({ content: '⚠️ The roster is currently empty.', flags: [MessageFlags.Ephemeral] });
            }

            const kickSelect = new StringSelectMenuBuilder()
              .setCustomId(p(`admin_kick_select:${eventId}`))
              .setPlaceholder('Select a member to KICK...')
              .addOptions(signups.map(s => ({
                label: `@${s.username} (${s.status.toUpperCase()})`,
                value: s.memberId
              })));

            const swapSelect = new StringSelectMenuBuilder()
              .setCustomId(p(`admin_swap_first_select:${eventId}`))
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
              flags: [MessageFlags.Ephemeral]
            });
          }
          else if (customId === 'trigger_bonus_ticket') {
            const modal = new ModalBuilder()
              .setCustomId(p('discord_ticket_bonus_modal'))
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
              .setCustomId(p('discord_ticket_support_modal'))
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
          else if (customId === 'trigger_activity_submit') {
            const modal = new ModalBuilder()
              .setCustomId(p('activity_submit_modal'))
              .setTitle('Submit Activity Log');

            const typeInput = new TextInputBuilder()
              .setCustomId('modal_activity_type')
              .setLabel('Activity Type')
              .setPlaceholder('E.g. Collect RP Ticket')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const descInput = new TextInputBuilder()
              .setCustomId('modal_activity_desc')
              .setLabel('Detail Description')
              .setPlaceholder('Enter any details about this activity submission')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false);

            const proofInput = new TextInputBuilder()
              .setCustomId('modal_activity_proof')
              .setLabel('Proof Link (screenshot/video)')
              .setPlaceholder('https://...')
              .setStyle(TextInputStyle.Short)
              .setRequired(false);

            modal.addComponents(
              new ActionRowBuilder().addComponents(typeInput),
              new ActionRowBuilder().addComponents(descInput),
              new ActionRowBuilder().addComponents(proofInput)
            );

            await interaction.showModal(modal);
          }
          else if (customId === 'trigger_my_points') {
            try {
              const member = await db.getMember(interaction.user.id);
              const points = member ? (member.points || 0) : 0;
              await interaction.reply({ content: `👤 **Points Balance for @${interaction.user.username}**:\nYou currently have **${points}** Activity/Event Points.`, flags: [MessageFlags.Ephemeral] });
            } catch (err) {
              console.error('[Bot] Failed to check points:', err.message);
              await interaction.reply({ content: '⚠️ Failed to retrieve points. Please try again.', flags: [MessageFlags.Ephemeral] });
            }
          }
          else if (customId === 'trigger_refresh_activity') {
            try {
              const embed = await botService.buildActivityPromptEmbed();
              const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(p('trigger_activity_submit'))
                  .setLabel('Submit Activity')
                  .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                  .setCustomId(p('trigger_my_points'))
                  .setLabel('My Points')
                  .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                  .setCustomId(p('trigger_refresh_activity'))
                  .setLabel('🔄 Refresh')
                  .setStyle(ButtonStyle.Secondary)
              );
              await interaction.update({ embeds: [embed], components: [row] });
            } catch (err) {
              await interaction.reply({ content: '⚠️ Failed to refresh panel.', flags: [MessageFlags.Ephemeral] });
            }
          }
          else if (customId.startsWith('activity_approve:') || customId.startsWith('activity_reject:')) {
            const isApprove = customId.startsWith('activity_approve:');
            const activityId = customId.split(':')[1];

            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!isAuthorizedAdmin(member)) {
              return interaction.reply({ content: '❌ You do not have permission to review activities.', flags: [MessageFlags.Ephemeral] });
            }

            const act = await db.getActivity(activityId);
            if (!act) {
              return interaction.reply({ content: '❌ Activity submission not found in database.', flags: [MessageFlags.Ephemeral] });
            }
            if (act.status !== 'pending') {
              return interaction.reply({ content: `❌ This activity has already been processed (Status: ${act.status}).`, flags: [MessageFlags.Ephemeral] });
            }

            const points = act.pointsRequested || 0;
            const reviewerName = member.nickname || interaction.user.username;

            if (isApprove) {
              await db.updateActivity(activityId, {
                status: 'approved',
                pointsAwarded: points,
                reviewedBy: reviewerName,
                reviewedAt: new Date().toISOString()
              });

              const targetMember = await db.getMember(act.memberId);
              if (targetMember) {
                await db.updateMember(act.memberId, {
                  points: (targetMember.points || 0) + points,
                  activityScore: Math.min(100, (targetMember.activityScore || 0) + 5)
                });
              }

              const reviewEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor(0x23a55a)
                .setFooter({ text: `✅ Approved by ${reviewerName} • Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` });

              await interaction.update({
                content: `✅ Approved by <@${interaction.user.id}>`,
                embeds: [reviewEmbed],
                components: []
              });

              await botService.sendActivityResult(act, 'approved', points, reviewerName);

              await botService.sendDirectMessage(
                act.memberId,
                `💯 Your activity submission [${act.id}] was **APPROVED**.\nPoints granted: +${points}.\nReviewer: ${reviewerName}`
              );

              await botService.syncActivityPointsLeaderboardMessage();
              botService.logSimulated(`Activity submission ${activityId} approved by @${interaction.user.username}`);
            } else {
              await db.updateActivity(activityId, {
                status: 'rejected',
                pointsAwarded: 0,
                reviewedBy: reviewerName,
                reviewedAt: new Date().toISOString()
              });

              const reviewEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor(0xf23f43)
                .setFooter({ text: `❌ Rejected by ${reviewerName} • Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` });

              await interaction.update({
                content: `❌ Rejected by <@${interaction.user.id}>`,
                embeds: [reviewEmbed],
                components: []
              });

              await botService.sendActivityResult(act, 'rejected', 0, reviewerName);

              await botService.sendDirectMessage(
                act.memberId,
                `❌ Your activity submission [${act.id}] was **REJECTED**.\nReviewer: ${reviewerName}`
              );

              botService.logSimulated(`Activity submission ${activityId} rejected by @${interaction.user.username}`);
            }

            botService.broadcastSocket('activity_logged', { ...act, status: isApprove ? 'approved' : 'rejected' });
          }
          else if (customId.startsWith('bonus_confirm:')) {
            const submissionId = customId.split(':')[1];
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!isAuthorizedAdmin(member)) {
              return interaction.reply({ content: '❌ You do not have permission to disburse bonuses.', flags: [MessageFlags.Ephemeral] });
            }

            const winSubmissions = await db.getWinSubmissions();
            const submission = winSubmissions.find(s => s.id === submissionId);
            if (!submission) {
              return interaction.reply({ content: '❌ Win submission not found in database.', flags: [MessageFlags.Ephemeral] });
            }
            if (submission.status !== 'pending' && submission.status !== 'reviewing') {
              return interaction.reply({ content: `❌ This bonus request has already been processed (Status: ${submission.status}).`, flags: [MessageFlags.Ephemeral] });
            }

            const baseAmount = submission.baseAmount || 200000;
            const finalParticipants = submission.participants || [];
            const details = [];

            for (const pIdentifier of finalParticipants) {
              const members = await db.getMembers();
              let username = pIdentifier;
              let kills = 1;
              if (pIdentifier.includes('|')) {
                const parts = pIdentifier.split('|');
                username = parts[0].trim();
                kills = parseInt(parts[1], 10) || 1;
              }

              let mem = members.find(m => 
                m.username.toLowerCase() === username.toLowerCase() || 
                m.nickname.toLowerCase().includes(username.toLowerCase())
              );

              if (mem) {
                const strikesCount = mem.strikes ? mem.strikes.length : 0;
                let cutPercent = 0;
                if (strikesCount === 1) cutPercent = 25;
                else if (strikesCount === 2) cutPercent = 50;
                else if (strikesCount >= 3) cutPercent = 100;

                const rawBonus = kills * baseAmount;
                const cutAmount = (rawBonus * cutPercent) / 100;
                const netAmount = rawBonus - cutAmount;

                const currentBonus = mem.weeklyBonus || 0;
                await db.updateMember(mem.discordId, {
                  weeklyBonus: currentBonus + netAmount
                });

                details.push({
                  discordId: mem.discordId,
                  username: mem.username,
                  strikes: strikesCount,
                  cutPercent,
                  cutAmount,
                  netAmount
                });
              } else {
                details.push({
                  username,
                  strikes: 'N/A',
                  cutPercent: 0,
                  cutAmount: 0,
                  netAmount: kills * baseAmount,
                  warning: 'Not in database'
                });
              }
            }

            const updatedSub = await db.updateWinSubmission(submission.id, {
              status: 'approved',
              approvedBy: interaction.user.username,
              approvedAt: new Date().toISOString()
            });

            // Log in bonus-admin-panel
            const participantsListStr = details.map(d => {
              const mention = d.discordId ? `<@${d.discordId}>` : d.username;
              const warnSuffix = d.warning ? ` ⚠️ (${d.warning})` : '';
              return `${mention}: **$${d.netAmount.toLocaleString()}** (Strikes: ${d.strikes}, Cut: ${d.cutPercent}%)${warnSuffix}`;
            }).join('\n');

            const disbursedEmbed = new EmbedBuilder()
              .setTitle('🏆 EVENT WIN BONUS DISBURSED')
              .setDescription(`**Event:** ${updatedSub.eventName || updatedSub.title}\n**Base Amount:** $${baseAmount.toLocaleString()}\n**Approved By Admin:** ${interaction.user.username}\n\n**Weekly Payout Breakdown:**\n${participantsListStr}`)
              .setColor(0x34d399)
              .setTimestamp()
              .setFooter({ text: 'White Pigeon Bonus System' });

            if (updatedSub.mediaUrl) {
              disbursedEmbed.setImage(updatedSub.mediaUrl);
            }

            await botService.sendWebhook('bonus-admin-panel', disbursedEmbed);
            await botService.syncBonusAdminPanelMessage();

            const approvedEmbed = await botService.buildBonusApprovalEmbed(updatedSub);
            approvedEmbed.setColor(0x23a55a);
            approvedEmbed.setTitle('✅ Bonus Request Approved & Disbursed');

            await interaction.update({ embeds: [approvedEmbed], components: [] });
            
            // Broadcast socket update
            botService.broadcastSocket('win_submissions_update', await db.getWinSubmissions());
            botService.broadcastSocket('leaderboard_update', await db.getMembers());
          }
          else if (customId.startsWith('bonus_cancel:')) {
            const submissionId = customId.split(':')[1];
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!isAuthorizedAdmin(member)) {
              return interaction.reply({ content: '❌ You do not have permission to discard bonus requests.', flags: [MessageFlags.Ephemeral] });
            }

            const winSubmissions = await db.getWinSubmissions();
            const submission = winSubmissions.find(s => s.id === submissionId);
            if (!submission) {
              return interaction.reply({ content: '❌ Win submission not found.', flags: [MessageFlags.Ephemeral] });
            }

            await db.updateWinSubmission(submission.id, {
              status: 'rejected',
              reviewedBy: interaction.user.username,
              reviewedAt: new Date().toISOString()
            });

            await interaction.update({ content: '❌ Bonus request cancelled/discarded.', embeds: [], components: [] });
            
            // Broadcast socket update
            botService.broadcastSocket('win_submissions_update', await db.getWinSubmissions());
          }
          else if (customId === 'refresh_bonus_admin') {
            await interaction.deferUpdate();
            await botService.syncBonusAdminPanelMessage();
          }
          else if (customId === 'export_bonus_admin') {
            const members = await db.getMembers();
            const activeMembers = [...members]
              .filter(m => (m.weeklyBonus || 0) > 0)
              .sort((a, b) => b.weeklyBonus - a.weeklyBonus);

            if (activeMembers.length === 0) {
              return interaction.reply({ content: '❌ No active bonuses to export.', flags: [MessageFlags.Ephemeral] });
            }

            const csvContent = 'Discord ID,Username,Character ID,Weekly Bonus\n' + 
              activeMembers.map(m => `${m.discordId},"${m.username}",${m.characterId || 'N/A'},${m.weeklyBonus}`).join('\n');

            const buffer = Buffer.from(csvContent, 'utf-8');
            const { AttachmentBuilder } = require('discord.js');
            const attachment = new AttachmentBuilder(buffer, { name: 'weekly-bonuses-export.csv' });

            await interaction.reply({ 
              content: `📊 **Weekly Bonus Export**\nTotal Members: **${activeMembers.length}**\nTotal Disbursed: **$${activeMembers.reduce((a, b) => a + b.weeklyBonus, 0).toLocaleString()}**`,
              files: [attachment],
              flags: [MessageFlags.Ephemeral]
            });
          }
        }

        // 2. Modal submissions
        else if (interaction.isModalSubmit()) {
          if (interaction.customId === 'bizwar_collect_modal') {
            try {
              const amountStr = interaction.fields.getTextInputValue('bizwar_amount');
              const proofsUrl = interaction.fields.getTextInputValue('bizwar_proofs') || '';
              const businessName = 'BizWar Collection';

              const numericAmount = parseFloat(amountStr);
              if (isNaN(numericAmount) || numericAmount <= 0) {
                return interaction.reply({ content: '❌ Amount must be a positive number.', flags: [MessageFlags.Ephemeral] });
              }

              // Save to database
              const log = await db.createBizWarLog({
                memberId: interaction.user.id,
                username: interaction.user.username,
                businessName,
                amount: numericAmount,
                proofUrl: proofsUrl,
                timeCollected: new Date().toISOString()
              });

              // Add to member balance
              const member = await db.getMember(interaction.user.id);
              const currentBalance = member ? member.balance : 0;
              await db.updateMember(interaction.user.id, { balance: currentBalance + numericAmount });

              // Sync Discord embed
              await botService.syncBizwarCollectionMessage();

              // Send webhook & Socket broadcast
              const embed = {
                title: '🕊️ WHITE PIGEONS ➔ BIZWAR REVENUE LOGGED',
                description: `Business profits successfully collected.`,
                color: 0x10b981,
                fields: [
                  { name: 'Collector', value: `<@${interaction.user.id}>`, inline: true },
                  { name: 'Collected Amount', value: `$${numericAmount.toLocaleString()}`, inline: true }
                ]
              };
              if (proofsUrl && proofsUrl.startsWith('http')) {
                embed.image = { url: proofsUrl };
              }
              await botService.sendWebhook('bizwar-collect', embed);
              botService.broadcastSocket('leaderboard_update', await db.getMembers());

              const replyText = proofsUrl 
                ? `✅ Successfully collected **$${numericAmount.toLocaleString()}** with proof screenshot!`
                : `✅ Successfully collected **$${numericAmount.toLocaleString()}**! Please paste/upload your proof screenshot in this channel now to automatically link it to your collection log.`;

              await interaction.reply({
                content: replyText,
                flags: [MessageFlags.Ephemeral]
              });
            } catch (err) {
              console.error('Error in bizwar_collect_modal handler:', err.message);
              await interaction.reply({
                content: `❌ Error submitting bizwar collect: ${err.message}`,
                flags: [MessageFlags.Ephemeral]
              });
            }
          }

          else if (interaction.customId === 'rp_collect_by_id_modal') {
            try {
              const state = await db.getRpCollectionState();
              if (state.collectionsCount >= state.maxCollections) {
                return interaction.reply({
                  content: `❌ **RP Ticket Collection shifts are full (${state.collectionsCount}/${state.maxCollections}).**`,
                  flags: [MessageFlags.Ephemeral]
                });
              }

              const value = interaction.fields.getTextInputValue('rp_member_input').trim();
              const countStr = interaction.fields.getTextInputValue('rp_count_input').trim();

              const numTickets = parseInt(countStr, 10);
              if (isNaN(numTickets) || numTickets <= 0) {
                return interaction.reply({ content: '❌ Tickets collected must be a positive integer.', flags: [MessageFlags.Ephemeral] });
              }

              const members = await db.getMembers();
              const found = members.find(m => 
                m.discordId === value || 
                m.username.toLowerCase() === value.toLowerCase() ||
                (m.nickname && m.nickname.toLowerCase().includes(value.toLowerCase()))
              );

              const memberId = found ? found.discordId : interaction.user.id;
              const username = found ? found.username : value;
              const displayLabel = found ? `<@${found.discordId}>` : `@${value}`;

              // Create the log in DB
              const log = await db.createRpTicketLog({
                memberId,
                username,
                ticketsCollected: numTickets,
                timeCollected: new Date().toISOString()
              });

              // Add to state
              state.collectionsList.push({
                logId: log.id,
                discordId: memberId,
                username,
                ticketsCollected: numTickets,
                time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
              });
              state.collectionsCount = state.collectionsList.length;
              await db.saveRpCollectionState(state);

              // Update Discord message
              await botService.syncRpCollectionMessage();

              // Send webhook & Socket broadcast
              const stats = await db.getRpTicketStats();
              const embed = {
                title: '🎫 RP TICKET FACTORY COLLECTION',
                description: `RP Tickets successfully harvested.`,
                color: 0x00f0ff,
                fields: [
                  { name: 'Collector', value: displayLabel, inline: true },
                  { name: 'Tickets Collected', value: `${numTickets} RP Tickets`, inline: true },
                  { name: 'Total Vault Stock', value: `${stats.totalCollected} RP Tickets`, inline: true }
                ]
              };
              await botService.sendWebhook('rp-collect', embed);
              botService.broadcastSocket('leaderboard_update', await db.getMembers());

              await interaction.reply({
                content: `✅ Successfully registered collection of **${numTickets} RP tickets** for ${displayLabel}.`,
                flags: [MessageFlags.Ephemeral]
              });
            } catch (err) {
              console.error('Error in rp_collect_by_id_modal handler:', err.message);
              await interaction.reply({
                content: `❌ Error submitting modal: ${err.message}`,
                flags: [MessageFlags.Ephemeral]
              });
            }
          }

          else if (interaction.customId === 'activity_submit_modal') {
            const activityType = interaction.fields.getTextInputValue('modal_activity_type');
            const description = interaction.fields.getTextInputValue('modal_activity_desc') || '';
            const mediaUrl = interaction.fields.getTextInputValue('modal_activity_proof') || '';

            if (!activityType.trim()) {
              return interaction.reply({ content: '❌ Activity type is required.', flags: [MessageFlags.Ephemeral] });
            }

            if (mediaUrl && !mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://')) {
              return interaction.reply({ content: '❌ Proof must be a valid http:// or https:// URL.', flags: [MessageFlags.Ephemeral] });
            }

            let pointsRequested = 0;
            const dbTypes = await db.getActivityTypes();
            const match = dbTypes.find(t => 
              t.key === activityType || 
              t.name.toLowerCase().includes(activityType.toLowerCase()) ||
              activityType.toLowerCase().includes(t.name.toLowerCase())
            );
            if (match) {
              pointsRequested = parseInt(match.value || match.points || '0', 10);
            }

            const act = await db.createActivity({
              memberId: interaction.user.id,
              username: interaction.user.username,
              activityType: match ? match.key : activityType,
              pointsRequested,
              description,
              mediaUrl
            });

            const fields = [
              { name: 'Activity ID', value: act.id, inline: true },
              { name: 'Activity Type', value: match ? match.key : activityType, inline: false },
              { name: 'Points Requested', value: `${pointsRequested} FP`, inline: true },
              { name: 'Detail Description', value: description || 'N/A' }
            ];

            const embed = {
              title: '💯 NEW ACTIVITY SUBMITTED',
              description: `Activity logged by **${interaction.user.username}** for review.`,
              color: 0xffaa00,
              fields
            };

            if (mediaUrl) {
              embed.image = mediaUrl;
            }

            await botService.sendWebhook('activity-review', embed);
            await botService.sendActivityReviewNotification(act);
            botService.logSimulated(`New activity ${act.id} submitted for review by @${interaction.user.username}.`);

            botService.broadcastSocket('activity_logged', act);
            if (ioInstance) {
              ioInstance.emit('system_notification', {
                title: 'Activity Submitted',
                message: `@${interaction.user.username} logged activity: ${activityType}`,
                type: 'info'
              });
            }

            return interaction.reply({ content: '✅ **Your activity has been submitted successfully for review!**', flags: [MessageFlags.Ephemeral] });
          }
          else if (interaction.customId === 'role_request_modal') {
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
            await interaction.reply({ content: '✅ Your role request form was submitted successfully and is under review.', flags: [MessageFlags.Ephemeral] });

            botService.broadcastSocket('role_requests_update', await db.getRoleRequests());
          }
          else if (interaction.customId.startsWith('bonus_edit_kills_modal:')) {
            const submissionId = interaction.customId.split(':')[1];
            const username = interaction.customId.split(':')[2];
            const newKills = parseInt(interaction.fields.getTextInputValue('kills_input'), 10);

            if (isNaN(newKills) || newKills < 0) {
              return interaction.reply({ content: '❌ Invalid kills number. Please enter a positive integer.', flags: [MessageFlags.Ephemeral] });
            }

            const winSubmissions = await db.getWinSubmissions();
            const submission = winSubmissions.find(s => s.id === submissionId);
            if (submission) {
              const updatedParticipants = submission.participants.map(p => {
                let pName = p;
                if (p.includes('|')) {
                  pName = p.split('|')[0].trim();
                }
                if (pName.toLowerCase() === username.toLowerCase()) {
                  return `${pName}|${newKills}`;
                }
                return p;
              });

              const updated = await db.updateWinSubmission(submissionId, { participants: updatedParticipants });
              const embed = await botService.buildBonusApprovalEmbed(updated);
              const components = await botService.buildBonusApprovalComponents(updated);
              await interaction.update({ embeds: [embed], components });
            } else {
              await interaction.reply({ content: '❌ Win submission not found.', flags: [MessageFlags.Ephemeral] });
            }
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

            await interaction.reply({ content: `✅ Your ticket **[${ticket.id}]** has been submitted and is under review.`, flags: [MessageFlags.Ephemeral] });
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
              return interaction.reply({ content: `❌ Member "${value}" not found in database.`, flags: [MessageFlags.Ephemeral] });
            }

            const list = await db.getPriorityList();
            if (type === 'top5') {
              if (!list.top5) list.top5 = [];
              if (list.top5.includes(found.discordId)) {
                return interaction.reply({ content: `⚠️ ${found.username} is already in the TOP 5 list.`, flags: [MessageFlags.Ephemeral] });
              }
              list.top5.push(found.discordId);
            } else {
              if (!list.top10) list.top10 = [];
              if (list.top10.includes(found.discordId)) {
                return interaction.reply({ content: `⚠️ ${found.username} is already in the TOP 10 list.`, flags: [MessageFlags.Ephemeral] });
              }
              list.top10.push(found.discordId);
            }

            await db.savePriorityList(list);
            await botService.syncPriorityListMessage();
            const resolved = await botService.getResolvedPriorityList();
            botService.broadcastSocket('priority_list_update', resolved);

            await interaction.reply({ content: `✅ Added **${found.username}** to Priority ${type === 'top5' ? 'TOP 5' : 'TOP 10'}!`, flags: [MessageFlags.Ephemeral] });
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
              return interaction.reply({ content: `❌ Member "${value}" not found in database.`, flags: [MessageFlags.Ephemeral] });
            }

            const list = await db.getPriorityList();
            if (type === 'top5') {
              if (!list.top5 || !list.top5.includes(found.discordId)) {
                return interaction.reply({ content: `⚠️ ${found.username} is not in the TOP 5 list.`, flags: [MessageFlags.Ephemeral] });
              }
              list.top5 = list.top5.filter(id => id !== found.discordId);
            } else {
              if (!list.top10 || !list.top10.includes(found.discordId)) {
                return interaction.reply({ content: `⚠️ ${found.username} is not in the TOP 10 list.`, flags: [MessageFlags.Ephemeral] });
              }
              list.top10 = list.top10.filter(id => id !== found.discordId);
            }

            await db.savePriorityList(list);
            await botService.syncPriorityListMessage();
            const resolved = await botService.getResolvedPriorityList();
            botService.broadcastSocket('priority_list_update', resolved);

            await interaction.reply({ content: `✅ Removed **${found.username}** from Priority ${type === 'top5' ? 'TOP 5' : 'TOP 10'}.`, flags: [MessageFlags.Ephemeral] });
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
          else if (interaction.customId.startsWith('bonus_select_event:')) {
            const submissionId = interaction.customId.split(':')[1];
            const eventName = interaction.values[0];
            
            let baseAmount = 200000;
            if (eventName === 'Informal') baseAmount = 70000;
            else if (eventName === 'Harbor') baseAmount = 50000;
            else if (eventName === 'Weapons') baseAmount = 40000;
            else if (eventName === 'Bizwar') baseAmount = 200000;
            else if (eventName === 'Foundry') baseAmount = 40000;

            const winSubmissions = await db.getWinSubmissions();
            const submission = winSubmissions.find(s => s.id === submissionId);
            if (submission) {
              const updated = await db.updateWinSubmission(submissionId, { eventName, baseAmount });
              const embed = await botService.buildBonusApprovalEmbed(updated);
              const components = await botService.buildBonusApprovalComponents(updated);
              await interaction.update({ embeds: [embed], components });
            } else {
              await interaction.reply({ content: '❌ Win submission not found.', flags: [MessageFlags.Ephemeral] });
            }
          }
          else if (interaction.customId.startsWith('bonus_select_date:')) {
            const submissionId = interaction.customId.split(':')[1];
            const relativeDate = interaction.values[0];

            let dateObj = new Date();
            if (relativeDate === 'Tomorrow') {
              dateObj.setDate(dateObj.getDate() + 1);
            } else if (relativeDate === 'Yesterday') {
              dateObj.setDate(dateObj.getDate() - 1);
            } else if (relativeDate === 'Before Yesterday') {
              dateObj.setDate(dateObj.getDate() - 2);
            }
            const dateTimeStr = dateObj.toISOString().split('T')[0];

            const winSubmissions = await db.getWinSubmissions();
            const submission = winSubmissions.find(s => s.id === submissionId);
            if (submission) {
              const updated = await db.updateWinSubmission(submissionId, { dateTimeStr });
              const embed = await botService.buildBonusApprovalEmbed(updated);
              const components = await botService.buildBonusApprovalComponents(updated);
              await interaction.update({ embeds: [embed], components });
            } else {
              await interaction.reply({ content: '❌ Win submission not found.', flags: [MessageFlags.Ephemeral] });
            }
          }
          else if (interaction.customId.startsWith('bonus_select_time:')) {
            const submissionId = interaction.customId.split(':')[1];
            const timeStr = interaction.values[0];

            const winSubmissions = await db.getWinSubmissions();
            const submission = winSubmissions.find(s => s.id === submissionId);
            if (submission) {
              const updated = await db.updateWinSubmission(submissionId, { timeStr });
              const embed = await botService.buildBonusApprovalEmbed(updated);
              const components = await botService.buildBonusApprovalComponents(updated);
              await interaction.update({ embeds: [embed], components });
            } else {
              await interaction.reply({ content: '❌ Win submission not found.', flags: [MessageFlags.Ephemeral] });
            }
          }
          else if (interaction.customId.startsWith('bonus_select_user:')) {
            const submissionId = interaction.customId.split(':')[1];
            const username = interaction.values[0];

            const winSubmissions = await db.getWinSubmissions();
            const submission = winSubmissions.find(s => s.id === submissionId);
            if (submission) {
              let currentKills = 1;
              const pItem = submission.participants.find(p => p.startsWith(username + '|') || p === username);
              if (pItem && pItem.includes('|')) {
                currentKills = parseInt(pItem.split('|')[1], 10) || 1;
              }

              const modal = new ModalBuilder()
                .setCustomId(p(`bonus_edit_kills_modal:${submissionId}:${username}`))
                .setTitle(`Edit Kills for ${username}`);

              const killsInput = new TextInputBuilder()
                .setCustomId('kills_input')
                .setLabel('Number of Kills')
                .setPlaceholder('Enter kills amount')
                .setValue(String(currentKills))
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

              modal.addComponents(new ActionRowBuilder().addComponents(killsInput));
              await interaction.showModal(modal);
            } else {
              await interaction.reply({ content: '❌ Win submission not found.', flags: [MessageFlags.Ephemeral] });
            }
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
              .setCustomId(p(`admin_swap_second_select:${eventId}:${memberId1}`))
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
      };

      client.on('interactionCreate', handleInteraction);

      // Now handle bizwarClient
      if (config.bizwarBotToken && config.bizwarBotToken !== config.botToken) {
        try {
          bizwarClient = new Client({
            intents: [
              GatewayIntentBits.Guilds,
              GatewayIntentBits.GuildMembers,
              GatewayIntentBits.GuildMessages,
              GatewayIntentBits.MessageContent
            ],
            partials: [Partials.Message, Partials.Channel]
          });
          bizwarClient.once('ready', () => {
            console.log(`[Bizwar Bot] Connected as ${bizwarClient.user.tag}`);
            botService.logSimulated(`Bizwar Bot Connected live as ${bizwarClient.user.tag}`);
          });
          bizwarClient.on('error', (err) => {
            console.error('[Bizwar Bot] Client Error:', err);
            botService.logSimulated(`Bizwar Bot Connection Error: ${err.message}`);
          });
          bizwarClient.on('interactionCreate', handleInteraction);
          bizwarClient.on('messageCreate', handleMessageCreate);
          await bizwarClient.login(config.bizwarBotToken);
        } catch (err) {
          console.error('[Bizwar Bot] Failed to login:', err.message);
          botService.logSimulated(`Failed to connect Bizwar Bot: ${err.message}. Falling back to main bot.`);
          bizwarClient = client;
        }
      } else {
        bizwarClient = client;
      }

      // Now handle rpClient
      if (config.rpBotToken && config.rpBotToken !== config.botToken) {
        try {
          rpClient = new Client({
            intents: [
              GatewayIntentBits.Guilds,
              GatewayIntentBits.GuildMembers,
              GatewayIntentBits.GuildMessages,
              GatewayIntentBits.MessageContent
            ],
            partials: [Partials.Message, Partials.Channel]
          });
          rpClient.once('ready', () => {
            console.log(`[RP Bot] Connected as ${rpClient.user.tag}`);
            botService.logSimulated(`RP Bot Connected live as ${rpClient.user.tag}`);
          });
          rpClient.on('error', (err) => {
            console.error('[RP Bot] Client Error:', err);
            botService.logSimulated(`RP Bot Connection Error: ${err.message}`);
          });
          rpClient.on('interactionCreate', handleInteraction);
          await rpClient.login(config.rpBotToken);
        } catch (err) {
          console.error('[RP Bot] Failed to login:', err.message);
          botService.logSimulated(`Failed to connect RP Bot: ${err.message}. Falling back to main bot.`);
          rpClient = client;
        }
      } else {
        rpClient = client;
      }

      client.on('voiceStateUpdate', async (oldState, newState) => {
        try {
          const config = await db.getConfig();
          const voiceChannelId = config.factoryVoiceChannelId || 'mock-voice-id';
          if (oldState.channelId === voiceChannelId || newState.channelId === voiceChannelId) {
            await botService.syncRpSignupEmbed('rp-signup');
            await botService.syncRpSignupEmbed('informal-signup');
            await botService.syncRpSignupEmbed('signup-event');
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
    if (!isDiscordWebhookUrl(webhookUrl)) {
      return { success: false, message: 'Invalid Webhook format.' };
    }
    try {
      await axios.post(webhookUrl, {
        embeds: [{
          title: 'White Pigeon Command Hub - Connection Test',
          description: `Successfully linked web tab with the **#${sanitizeString(channelName, 80)}** Discord channel!`,
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

    const data = (embedData && typeof embedData.toJSON === 'function') ? embedData.toJSON() : embedData;

    if (!webhookUrl) {
      botService.logSimulated(`[Webhook MOCK] Channel #${channelKey} (Webhook URL empty). Embed: "${data.title || ''} - ${data.description || ''}"`);
      return false;
    }
    if (!isDiscordWebhookUrl(webhookUrl)) {
      botService.logSimulated(`[Webhook Error] Channel #${channelKey}: invalid Discord webhook URL.`);
      return false;
    }

    try {
      const imgUrl = data.image ? (typeof data.image === 'string' ? data.image : data.image.url) : null;
      await axios.post(webhookUrl, {
        embeds: [{
          title: sanitizeString(data.title, 256),
          description: sanitizeString(data.description, 4000),
          color: data.color || 0xff007f,
          fields: data.fields || [],
          image: imgUrl ? { url: sanitizeString(imgUrl, 500) } : null,
          footer: data.footer ? { text: sanitizeString(data.footer.text, 2048) } : { text: 'White Pigeon Command Hub' },
          timestamp: data.timestamp || new Date().toISOString()
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
    if (eventId !== 'rp-signup' && eventId !== 'signup-event') return;
    
    let rosterType = 'Waitlist';
    if (action === 'confirmed' || action === 'displaced') {
      rosterType = 'Main Roster';
    }
    
    const eventName = eventId === 'rp-signup' ? 'RP Ticket' : 'Signup-Event';
    const text = `✅ You have joined the event: ${eventName} (${rosterType})`;
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
      const channel = await findSignupChannel(guild, eventId);
      if (channel) {
        const messages = await channel.messages.fetch({ limit: 15 });
        const signupMessage = messages.find(m => {
          return m.author.id === client.user.id && 
                 m.embeds.length > 0 && 
                 m.embeds[0].title && 
                 m.embeds[0].title.includes(eventId === 'rp-signup' ? 'RP Ticket' : eventId === 'signup-event' ? 'Signup-Event' : 'Informal Fight') &&
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

    const priorityList = await db.getPriorityList();
    const top5Ids = priorityList.top5 || [];
    const top10Ids = priorityList.top10 || [];

    const formatMemberLine = (s, idx) => {
      let badge = '⚔️';
      if (top5Ids.includes(s.memberId)) {
        badge = '👑';
      } else if (top10Ids.includes(s.memberId)) {
        badge = '🥇';
      }
      const voiceIcon = s.inVoice ? ' 🔊' : '';
      return `\`[#${(idx + 1).toString().padStart(2, '0')}]\` ${badge} <@${s.memberId}>${voiceIcon}`;
    };

    const mainRosterLines = confirmed.map((s, idx) => formatMemberLine(s, idx));
    const reserveLines = reserve.map((s, idx) => formatMemberLine(s, idx));

    const config = await db.getConfig();
    const pointsText = (eventId === 'rp-signup' || eventId === 'signup-event') ? '`2` Points' : '`1` Point';
    const statusLabel = isClosed ? '🔴 REGISTRATION CLOSED' : '🟢 REGISTRATIONS OPEN';
    const voiceChannelText = config.factoryVoiceChannelId 
      ? `<#${config.factoryVoiceChannelId}>`
      : '🔊 ⚔️ | Event VC';

    const directivesText = description ? `> ${description.split('\n').join('\n> ')}` : '> *No directives set for this event.*';

    const embedDescription = [
      `──────────────────────────────`,
      `📢 **Directives & Orders:**`,
      directivesText,
      `──────────────────────────────`,
      `📊 **Details:**`,
      `• **Status:** ${statusLabel}`,
      `• **Reward:** ${pointsText} ❤️`,
      `• **Voice Channel:** ${voiceChannelText}`,
      `──────────────────────────────`
    ].join('\n');

    const bannerImage = (config.banners && config.banners[eventId])
      ? config.banners[eventId]
      : (eventId === 'rp-signup'
        ? 'https://whitepigeonslive.web.app/rp_ticket_banner.webp'
        : eventId === 'signup-event'
        ? 'https://whitepigeonslive.web.app/signup_event_banner.webp'
        : 'https://whitepigeonslive.web.app/informal_fight_banner.webp');

    let displayTitle = '';
    if (eventId === 'rp-signup') {
      displayTitle = '🕊️ WHITE PIGEONS ➔ RP TICKET FACTORY';
    } else if (eventId === 'signup-event') {
      displayTitle = '🕊️ WHITE PIGEONS ➔ SIGNUP EVENT';
    } else {
      displayTitle = '🕊️ WHITE PIGEONS ➔ INFORMAL SIGNUP';
    }

    const embed = new EmbedBuilder()
      .setTitle(displayTitle)
      .setDescription(embedDescription)
      .setColor(isClosed ? 0xef4444 : 0x10b981)
      .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
      .setImage(bannerImage)
      .setTimestamp();

    const mainRosterValue = confirmed.length > 0 
      ? mainRosterLines.join('\n') 
      : '*Roster is vacant. Claim a slot below!*';

    embed.addFields(
      { name: `👤 Main Roster (${confirmed.length} / 25)`, value: mainRosterValue, inline: false }
    );

    const reserveValue = reserve.length > 0 
      ? reserveLines.join('\n') 
      : '*No substitutes on standby.*';

    embed.addFields(
      { name: `👥 Reserve List (${reserve.length} / 20)`, value: reserveValue, inline: false }
    );

    return embed;
  },

  // Close an active signup message in Discord by removing components and setting to CLOSED style
  closeSignupMessage: async (eventId) => {
    if (!client) return;
    try {
      const config = await db.getConfig();
      const guild = await client.guilds.fetch(config.guildId);
      const channel = await findSignupChannel(guild, eventId);
      if (channel) {
        // Fetch last 15 messages in the channel to locate the active roster embed
        const messages = await channel.messages.fetch({ limit: 15 });
        const signupMessage = messages.find(m => {
          return m.author.id === client.user.id && 
                 m.embeds.length > 0 && 
                 m.embeds[0].title && 
                 m.embeds[0].title.includes(eventId === 'rp-signup' ? 'RP Ticket' : eventId === 'signup-event' ? 'Signup-Event' : 'Informal Fight') &&
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
    const channelKey = eventId === 'rp-signup' ? 'rp-signup' : eventId === 'signup-event' ? 'signup-event' : 'informal-signup';
    const config = await db.getConfig();

    const fallbackEmbed = {
      title: `🚀 ${eventId === 'rp-signup' ? 'RP Ticket' : eventId === 'signup-event' ? 'Signup-Event' : 'Informal Fight'} - OPEN ⚔️`,
      description: `**Event Directives:**\n${description}\n\n🟢 **Registration is active for ${durationMinutes} minutes!**\n\nHave fun! 🎉`,
      color: 0x00f0ff,
      timestamp: new Date().toISOString()
    };

    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        const channel = await findSignupChannel(guild, eventId);
        if (channel) {
          const embedBuilder = await botService.buildSignupEmbed(eventId, title, description, false);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p(`signup:${eventId}`))
              .setLabel('✅ Join')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(p(`leave:${eventId}`))
              .setLabel('❌ Leave')
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

  closeEvent: async (eventId) => {
    try {
      const config = await db.getConfig();
      // 1. Set state to closed in DB
      await db.setEventState(eventId, 'closed');

      // 2. Fetch all signups and sort them
      const signups = await db.getSignups(eventId);
      const confirmedQueue = signups.filter(s => s.status === 'confirmed');
      const reserveQueue = signups.filter(s => s.status === 'reserve' || s.status === 'displaced');

      const priorityList = await db.getPriorityList();
      const top5Ids = priorityList.top5 || [];
      const top10Ids = priorityList.top10 || [];

      // 3. Compile lines for embed formatting
      const mainRosterLines = confirmedQueue.map((s, idx) => {
        let badge = '⚔️';
        if (top5Ids.includes(s.memberId)) badge = '👑';
        else if (top10Ids.includes(s.memberId)) badge = '🥇';
        return `\`[#${(idx + 1).toString().padStart(2, '0')}]\` ${badge} <@${s.memberId}> ✅`;
      });

      const subsListLines = reserveQueue.map((s, idx) => {
        let badge = '⚔️';
        if (top5Ids.includes(s.memberId)) badge = '👑';
        else if (top10Ids.includes(s.memberId)) badge = '🥇';
        return `\`[#${(idx + 1).toString().padStart(2, '0')}]\` ${badge} <@${s.memberId}>`;
      });

      const bannerImage = (config.banners && config.banners[eventId])
        ? config.banners[eventId]
        : (eventId === 'rp-signup'
          ? 'https://whitepigeonslive.web.app/rp_ticket_banner.webp'
          : eventId === 'signup-event'
          ? 'https://whitepigeonslive.web.app/signup_event_banner.webp'
          : 'https://whitepigeonslive.web.app/informal_fight_banner.webp');

      const embedDescription = [
        `──────────────────────────────`,
        `🔴 **REGISTRATION ARCHIVED & CLOSED**`,
        `The event registration period has ended. The final deployment roster has been locked.`,
        `──────────────────────────────`,
        `👤 **Main Roster (${confirmedQueue.length} / 25):**`,
        mainRosterLines.length > 0 ? mainRosterLines.join('\n') : '*No confirmed players.*',
        `──────────────────────────────`,
        `👥 **Reserve Standby List (${reserveQueue.length} / 20):**`,
        subsListLines.length > 0 ? subsListLines.join('\n') : '*No standby players.*',
        `──────────────────────────────`
      ].join('\n');

      let displayTitle = '';
      if (eventId === 'rp-signup') {
        displayTitle = '🕊️ WHITE PIGEONS ➔ RP TICKET FACTORY [CLOSED]';
      } else if (eventId === 'signup-event') {
        displayTitle = '🕊️ WHITE PIGEONS ➔ SIGNUP EVENT [CLOSED]';
      } else {
        displayTitle = '🕊️ WHITE PIGEONS ➔ INFORMAL SIGNUP [CLOSED]';
      }

      const embed = {
        title: displayTitle,
        description: embedDescription,
        color: 0xef4444,
        image: bannerImage
      };

      const channelKey = eventId === 'rp-signup' ? 'rp-signup' : eventId === 'signup-event' ? 'signup-event' : 'informal-signup';
      await botService.closeSignupMessage(eventId);
      await botService.sendWebhook(channelKey, embed);

      // 4. Emit live status change to connected browser clients via WebSocket
      botService.broadcastSocket('event_state_change', { eventId, state: 'closed' });
      botService.broadcastSocket('system_notification', {
        title: 'Registration Closed',
        message: `${eventId === 'rp-signup' ? 'RP' : eventId === 'signup-event' ? 'Signup-Event' : 'Informal'} Registration is now CLOSED. Final roster has been posted to Discord.`,
        type: 'warning'
      });

      botService.logSimulated(`Closed registration for ${eventId}. Posted final roster to Discord.`);
      return { 
        success: true,
        stats: {
          totalSignedUp: signups.length,
          topPriorityConfirmed: confirmedQueue.filter(s => s.isTop10).length,
          normalConfirmed: confirmedQueue.filter(s => !s.isTop10).length,
          substitutesCount: reserveQueue.length
        }
      };
    } catch (err) {
      console.error(`[Bot] Failed to close event ${eventId}:`, err.message);
      return { success: false, error: err.message };
    }
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
      ? 0x10b981
      : req.status === 'rejected'
        ? 0xef4444
        : 0x3b82f6;

    const embed = new EmbedBuilder()
      .setTitle(`🕊️ WHITE PIGEONS ➔ ROLE REQUEST`)
      .setDescription(req.status === 'pending' 
        ? 'A new member registration request is awaiting review.' 
        : `Status: **${req.status.toUpperCase()}**\nReviewed by: **@${req.reviewer || 'Admin'}**`)
      .setColor(embedColor)
      .addFields(
        { name: '👤 Applicant', value: `<@${req.discordId}>`, inline: true },
        { name: '🏷️ Username', value: `\`${req.username}\``, inline: true },
        { name: '✍️ Character Name', value: `\`${req.inGameName}\``, inline: true },
        { name: '🆔 Character ID', value: `\`${req.characterId}\``, inline: true },
        { name: '📊 Level in City', value: `\`Level ${req.level}\``, inline: true },
        { name: '🎖️ Family Rank', value: `\`Rank ${req.rank}\``, inline: true },
        { name: '🔗 Forum Account', value: req.forumLink && req.forumLink !== 'N/A' ? `[View Account](${req.forumLink})` : '*Not provided*', inline: false },
        { name: '✅ Roles to Grant', value: formattedRoles, inline: false }
      )
      .setFooter({ text: `Request ID: ${req.id} • White Pigeons Security Node` })
      .setTimestamp(new Date(req.requestedAt));

    return embed;
  },

  // Post interactive role review embed to reviewer Discord channel
  sendRoleReviewNotification: async (req) => {
    const config = await db.getConfig();
    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = guild.channels.cache.find(c => {
          const name = cleanName(c.name);
          return name.includes('rolereq-review') || name.includes('role-request-review') || name.includes('role-review');
        });
        if (!channel) {
          channel = guild.channels.cache.find(c => {
            const name = cleanName(c.name);
            return name.includes('rolereq') || name.includes('role-request');
          });
        }
        if (!channel) {
          channel = guild.channels.cache.find(c => {
            const name = cleanName(c.name);
            return name.includes('review') && !name.includes('activity');
          });
        }
        if (!channel) {
          channel = guild.channels.cache.find(c => cleanName(c.name).includes('review'));
        }
        if (channel) {
          const embed = await botService.buildRoleReviewEmbed(req.id);
          
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(p(`role_select:${req.id}`))
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
            .setCustomId(p(`role_approve:${req.id}`))
            .setLabel('Approve & Give Roles')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');

          const rejectBtn = new ButtonBuilder()
            .setCustomId(p(`role_reject:${req.id}`))
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
  closeRoleReviewMessage: async (requestId) => {
    if (!client) return;
    try {
      const config = await db.getConfig();
      const guild = await client.guilds.fetch(config.guildId);
      let channel = guild.channels.cache.find(c => {
        const name = cleanName(c.name);
        return name.includes('rolereq-review') || name.includes('role-request-review') || name.includes('role-review');
      });
      if (!channel) {
        channel = guild.channels.cache.find(c => {
          const name = cleanName(c.name);
          return name.includes('rolereq') || name.includes('role-request');
        });
      }
      if (!channel) {
        channel = guild.channels.cache.find(c => {
          const name = cleanName(c.name);
          return name.includes('review') && !name.includes('activity');
        });
      }
      if (!channel) {
        channel = guild.channels.cache.find(c => cleanName(c.name).includes('review'));
      }
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

  sendActivityReviewNotification: async (act) => {
    const config = await db.getConfig();
    if (client && config.guildId) {
      try {
        const guild = await botService.getGuild(config.guildId);
        if (!guild) throw new Error('No guild found for the bot client.');

        let channel = await findChannel(guild, c => {
          const name = cleanName(c.name);
          return name.includes('activity-review') || name.includes('review-activity') || name.includes('review');
        });
        if (!channel) {
          channel = await findChannel(guild, c => {
            const name = cleanName(c.name);
            return name.includes('activity') && name.includes('review');
          });
        }
        if (channel) {
          const rolePing = guild.roles.cache.find(r => r.name.includes('Activity Manager')) || '@Activity Manager';
          
          const embed = new EmbedBuilder()
            .setTitle('🕊️ WHITE PIGEONS ➔ ACTIVITY SUBMISSION')
            .setDescription(`A new activity log has been logged by **${act.username}** and is pending review.`)
            .addFields([
              { name: '👤 Submitter', value: `<@${act.memberId}>`, inline: true },
              { name: '📂 Category', value: `\`${act.activityType}\``, inline: true },
              { name: '📝 Details', value: act.description ? `> ${act.description}` : '*No comments provided*', inline: false }
            ])
            .setColor(0x3b82f6)
            .setFooter({ text: `Activity ID: ${act.id} • Roster Ledger` })
            .setTimestamp();

          if (act.mediaUrl) {
            embed.setImage(act.mediaUrl);
            embed.addFields([{ name: '🖼️ Proof Attachment', value: `[View Raw Media](${act.mediaUrl})`, inline: false }]);
          }

          const approveBtn = new ButtonBuilder()
            .setCustomId(p(`activity_approve:${act.id}`))
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');

          const rejectBtn = new ButtonBuilder()
            .setCustomId(p(`activity_reject:${act.id}`))
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌');

          const btnRow = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

          const message = await channel.send({ 
            content: `@${rolePing}`, 
            embeds: [embed], 
            components: [btnRow] 
          });

          await db.updateActivity(act.id, {
            reviewChannelId: channel.id,
            reviewMessageId: message.id
          });

          botService.logSimulated(`Fired interactive activity review embed for @${act.username} to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to send interactive activity review:', err.message);
      }
    }

    botService.logSimulated(`[Mock Review Notification] Fired activity review embed to #activity-review for ${act.username}.`);
    return false;
  },

  sendActivityResult: async (act, status, points, reviewerName) => {
    const isApproved = status === 'approved';
    const embedColor = isApproved ? 0x10b981 : 0xef4444;

    // A. Webhook result embed
    const resultEmbed = {
      title: isApproved ? '🕊️ WHITE PIGEONS ➔ ACTIVITY APPROVED' : '🕊️ WHITE PIGEONS ➔ ACTIVITY REJECTED',
      description: `Activity log has been reviewed by **${reviewerName}**.`,
      color: embedColor,
      fields: [
        { name: 'Activity ID', value: `\`${act.id}\``, inline: true },
        { name: 'Submitter', value: `<@${act.memberId}>`, inline: true },
        { name: 'Awarded Points', value: `\`+${points} Points\` ❤️`, inline: true },
        { name: 'Review Notes', value: isApproved ? '> The submitted activity has been verified and points have been credited.' : '> The submission did not meet the validation requirements.' }
      ]
    };

    // B. Send webhooks
    await botService.sendWebhook('activity-results', resultEmbed);
    await botService.sendWebhook('activity-review', resultEmbed);

    // C. If approved, send to leaderboard webhook
    if (isApproved && points > 0) {
      const currentPoints = (await db.getMember(act.memberId))?.points || 0;
      const leaderEmbed = {
        title: '🕊️ WHITE PIGEONS ➔ LEDGER UPDATE',
        description: `Points successfully credited to roster ledger!`,
        color: 0x10b981,
        fields: [
          { name: 'Player', value: `<@${act.memberId}>`, inline: true },
          { name: 'Earned Points', value: `\`+${points} Points\` ❤️`, inline: true },
          { name: 'New Total', value: `\`${currentPoints} Points\` 🏆`, inline: true }
        ]
      };
      await botService.sendWebhook('activity-points-leaderboard', leaderEmbed);
    }

    // D. Post directly to Discord channel via Bot (direct bot integration)
    if (client) {
      try {
        const config = await db.getConfig();
        if (config.guildId) {
          const guild = await botService.getGuild(config.guildId);
          if (guild) {
            let resultChannel = await findChannel(guild, c => {
              const name = cleanName(c.name);
              return name.includes('activity-result') || name.includes('activity-results');
            });
            if (!resultChannel) {
              resultChannel = await findChannel(guild, c => cleanName(c.name).includes('result'));
            }
            if (resultChannel) {
              const discordEmbed = new EmbedBuilder()
                .setTitle(isApproved ? '🕊️ WHITE PIGEONS ➔ ACTIVITY APPROVED' : '🕊️ WHITE PIGEONS ➔ ACTIVITY REJECTED')
                .setDescription(`The activity submitted by <@${act.memberId}> has been processed by **${reviewerName}**.`)
                .setColor(embedColor)
                .addFields(
                  { name: 'Submitter', value: `<@${act.memberId}>`, inline: true },
                  { name: 'Activity Type', value: `\`${act.activityType}\``, inline: true },
                  { name: 'Point Delta', value: isApproved ? `\`+${points} Points\` ❤️` : '`0`', inline: true }
                )
                .setFooter({ text: `Activity ID: ${act.id}` })
                .setTimestamp();
              await resultChannel.send({ embeds: [discordEmbed] });
            }
          }
        }
      } catch (err) {
        console.error('[Bot] Failed to send activity result message to Discord channel:', err.message);
      }
    }
  },

  closeActiveActivityReview: async (activityId, status, reviewerName) => {
    try {
      const act = await db.getActivity(activityId);
      if (!act || !act.reviewChannelId || !act.reviewMessageId || !client) return;

      const channel = await client.channels.fetch(act.reviewChannelId);
      if (channel) {
        const message = await channel.messages.fetch(act.reviewMessageId);
        if (message) {
          const isApproved = status === 'approved';
          const embedColor = isApproved ? 0x23a55a : 0xf23f43;
          const footerText = isApproved 
            ? `✅ Approved by ${reviewerName} • Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
            : `❌ Rejected by ${reviewerName} • Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

          const reviewEmbed = EmbedBuilder.from(message.embeds[0])
            .setColor(embedColor)
            .setFooter({ text: footerText });

          await message.edit({
            content: isApproved ? `✅ Approved by @${reviewerName}` : `❌ Rejected by @${reviewerName}`,
            embeds: [reviewEmbed],
            components: []
          });
          botService.logSimulated(`Closed active activity review message for ID ${activityId} in Discord via Web UI.`);
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to close active activity review message:', err.message);
    }
  },

  buildBizwarCollectionEmbed: async () => {
    const logs = await db.getBizWarLogs();
    const lastLog = logs[0];
    let statusText = '🟢 Active (Available)';
    let lastCollectorText = '*None*';
    let lastAmountText = '*$0*';
    let lastTimeText = '*N/A*';

    if (lastLog) {
      const lastTime = new Date(lastLog.timeCollected).getTime();
      const elapsed = Date.now() - lastTime;
      const cooldownPeriod = 24 * 60 * 60 * 1000;
      if (elapsed < cooldownPeriod) {
        const remainingMs = cooldownPeriod - elapsed;
        const hours = Math.floor(remainingMs / (60 * 60 * 1000));
        const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
        statusText = `🔴 Cooldown (Available in ${hours}h ${minutes}m)`;
      }
      lastCollectorText = `<@${lastLog.memberId}>`;
      lastAmountText = `\`$${parseFloat(lastLog.amount).toLocaleString()}\``;
      lastTimeText = `\`${new Date(lastLog.timeCollected).toLocaleString()}\``;
    }

    const propertyGrid = [
      `\`🏢 01. Hotel Factory   \` | \`🏢 06. Ammo Factory   \``,
      `\`🏢 02. Oil Well 12     \` | \`🏢 07. Weed Farm 2     \``,
      `\`🏢 03. Gun Shop 4      \` | \`🏢 08. Meth Lab 5      \``,
      `\`🏢 04. Docks Warehouse \` | \`🏢 09. Cocaine Depot   \``,
      `\`🏢 05. Cash Factory 3  \` | \`🏢 10. Scrap Yard      \``,
      `\`🏢 11. Nightclub       \` | \`🏢 16. Printing Press  \``,
      `\`🏢 12. Strip Club      \` | \`🏢 17. Chemical Plant  \``,
      `\`🏢 13. Car Dealership  \` | \`🏢 18. Refinery        \``,
      `\`🏢 14. Cargo Port      \` | \`🏢 19. Gold Mine       \``,
      `\`🏢 15. Bank Vault      \` | \`🏢 20. Steel Mill      \``
    ].join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🕊️ WHITE PIGEONS ➔ BIZWAR REVENUE')
      .setDescription(
        `Collect the daily business profits from our occupied family sites.\n\n` +
        `**🏢 Active Family Properties:**\n${propertyGrid}`
      )
      .addFields(
        { name: 'Collection Status', value: `\`${statusText}\``, inline: false },
        { name: 'Last Collector', value: lastCollectorText, inline: true },
        { name: 'Amount Secured', value: lastAmountText, inline: true },
        { name: 'Collected At', value: lastTimeText, inline: true }
      )
      .setColor(0x8a2be2)
      .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
      .setTimestamp();

    if (lastLog && lastLog.proofUrl && lastLog.proofUrl.startsWith('http')) {
      embed.setImage(lastLog.proofUrl);
    }

    return embed;
  },

  deployBizwarPrompt: async () => {
    botService.logSimulated('Attempting to deploy Bizwar Collection prompt to Discord channel...');
    const config = await db.getConfig();
    const activeClient = bizwarClient || client;

    if (activeClient && config.guildId) {
      try {
        const guild = await activeClient.guilds.fetch(config.guildId);
        let channel = await findChannel(guild, c => {
          const name = cleanName(c.name);
          return name.includes('bizwar') && (name.includes('collect') || name.includes('log') || name.includes('profit'));
        });
        if (!channel) {
          channel = await findChannel(guild, c => {
            const name = cleanName(c.name);
            return name.includes('bizwar') || name.includes('collect');
          });
        }

        if (channel) {
          const embed = await botService.buildBizwarCollectionEmbed();
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p('bizwar_collect_btn'))
              .setLabel('💵 COLLECT PROFIT')
              .setStyle(ButtonStyle.Success)
          );

          const message = await channel.send({ embeds: [embed], components: [row] });

          const currentWebhooks = config.webhooks || {};
          currentWebhooks.bizwarMessageId = message.id;
          currentWebhooks.bizwarChannelId = channel.id;
          await db.saveConfig({ ...config, webhooks: currentWebhooks });

          botService.logSimulated(`Successfully deployed Bizwar Collection panel to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy Bizwar Collection prompt:', err.message);
      }
    }

    botService.logSimulated('[Mock Panel] Deployed Bizwar Collection panel.');
    return true;
  },

  syncBizwarCollectionMessage: async () => {
    const config = await db.getConfig();
    const webhooks = config.webhooks || {};
    const messageId = webhooks.bizwarMessageId;
    const channelId = webhooks.bizwarChannelId;

    const activeClient = bizwarClient || client;
    if (!messageId || !channelId || !activeClient) return;

    try {
      const channel = await activeClient.channels.fetch(channelId);
      if (channel) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          const embed = await botService.buildBizwarCollectionEmbed();
          await message.edit({ embeds: [embed] });
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to sync Bizwar Collection message:', err.message);
    }
  },

  buildRpCollectionEmbed: async () => {
    const state = await db.getRpCollectionState();
    const count = state.collectionsCount || 0;
    const max = state.maxCollections || 6;
    
    // Status text
    let statusText = `🟢 Active (${count}/${max})`;
    if (count >= max) {
      statusText = `🔴 Completed (${count}/${max})`;
    }

    // Collection list formatting
    let collectionListText = '*No active collections registered for this shift.*';
    if (state.collectionsList && state.collectionsList.length > 0) {
      collectionListText = state.collectionsList.map((c, idx) => {
        const timeFormatted = c.time || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
        const charIdText = c.characterId ? ` \`(ID: ${c.characterId})\`` : '';
        const numText = `[ ${(idx + 1).toString().padStart(2, '0')} ]`;
        const proofText = c.proofUrl ? ` ➔ 🖼️ [View Proof](${c.proofUrl})` : '';
        return `\`${numText}\` 🎫 **x${c.ticketsCollected || 5}** tickets by <@${c.discordId}>${charIdText} at \`${timeFormatted}\`${proofText}`;
      }).join('\n');
    }

    const embed = new EmbedBuilder()
      .setTitle('🕊️ WHITE PIGEONS ➔ RP TICKET ROTATION')
      .setDescription(
        `Track and log RP Ticket factory collection status.\n\n` +
        `**📋 Current Shift Log:**\n${collectionListText}`
      )
      .addFields(
        { name: 'Collection Status', value: `\`${statusText}\``, inline: true },
        { name: 'Total Tickets Logged', value: `\`${count * 5} Tickets\` 💎`, inline: true }
      )
      .setColor(0x00f0ff)
      .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
      .setTimestamp();

    const latestProof = state.collectionsList && state.collectionsList.slice().reverse().find(c => c.proofUrl && c.proofUrl.startsWith('http'));
    if (latestProof) {
      embed.setImage(latestProof.proofUrl);
    }

    return embed;
  },

  deployRpCollectionPrompt: async () => {
    botService.logSimulated('Attempting to deploy RP Ticket Collection prompt to Discord channel...');
    const config = await db.getConfig();
    const activeClient = rpClient || client;

    if (activeClient && config.guildId) {
      try {
        const guild = await activeClient.guilds.fetch(config.guildId);
        let channel = await findChannel(guild, c => {
          const name = cleanName(c.name);
          return name.includes('rp') && (name.includes('collect') || name.includes('log') || name.includes('ticket'));
        });
        if (!channel) {
          channel = await findChannel(guild, c => {
            const name = cleanName(c.name);
            return name.includes('rp') || name.includes('collect');
          });
        }

        if (channel) {
          // Reset the RP Collection state for a new session
          const state = {
            collectionTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }),
            maxCollections: 6,
            collectionsCount: 0,
            collectionsList: []
          };
          await db.saveRpCollectionState(state);

          const embed = await botService.buildRpCollectionEmbed();
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(p('rp_collect_btn')).setLabel('Collect RP Ticket').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(p('rp_collect_by_id_btn')).setLabel('Collect By ID').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(p('rp_undo_btn')).setLabel('Undo Last').setStyle(ButtonStyle.Danger)
          );

          const message = await channel.send({ embeds: [embed], components: [row] });

          const currentWebhooks = config.webhooks || {};
          currentWebhooks.rpMessageId = message.id;
          currentWebhooks.rpChannelId = channel.id;
          await db.saveConfig({ ...config, webhooks: currentWebhooks });

          botService.logSimulated(`Successfully deployed RP Ticket Collection panel to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy RP Ticket Collection prompt:', err.message);
      }
    }

    // Fallback/Simulated
    const state = {
      collectionTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }),
      maxCollections: 6,
      collectionsCount: 0,
      collectionsList: []
    };
    await db.saveRpCollectionState(state);
    botService.logSimulated('[Mock Panel] Deployed RP Ticket Collection panel.');
    return true;
  },

  syncRpCollectionMessage: async () => {
    const config = await db.getConfig();
    const webhooks = config.webhooks || {};
    const messageId = webhooks.rpMessageId;
    const channelId = webhooks.rpChannelId;

    const activeClient = rpClient || client;
    if (!messageId || !channelId || !activeClient) return;

    try {
      const channel = await activeClient.channels.fetch(channelId);
      if (channel) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          const embed = await botService.buildRpCollectionEmbed();
          await message.edit({ embeds: [embed] });
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to sync RP Ticket Collection message:', err.message);
    }
  },

  // Deploy the "Submit Role Request" button prompt in the #role-request channel
  deployRoleRequestPrompt: async () => {
    botService.logSimulated('Attempting to deploy Role Request prompt to Discord channel...');
    const config = await db.getConfig();
    
    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = guild.channels.cache.find(c => {
          const name = cleanName(c.name);
          return (name.includes('role-request') || name.includes('rolereq')) && !name.includes('review') && !name.includes('signup');
        });
        if (!channel) {
          channel = guild.channels.cache.find(c => {
            const name = cleanName(c.name);
            return name.includes('role') && !name.includes('review') && !name.includes('signup') && !name.includes('collect');
          });
        }
        
        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('👑 Role Request Panel')
            .setDescription('Fill your data for the database and request active roles inside the White Pigeon family.\n\nClick the button below to open the role request submission form.')
            .setColor(0x00f0ff)
            .setFooter({ text: 'White Pigeon Roster Verification' });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p('trigger_role_request'))
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
      .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
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
              .setCustomId(p('refresh_stats'))
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

  deployAboutUsPrompt: async () => {
    botService.logSimulated('Attempting to deploy About Us / Family Stats panel to Discord channel...');
    const config = await db.getConfig();
    
    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = await findChannel(guild, c => cleanName(c.name).includes('about') || cleanName(c.name).includes('announcement') || cleanName(c.name).includes('general'));
        if (channel) {
          const stats = await db.getFamilyStats();
          const embed = await botService.buildStatsEmbed(stats);
          
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p('refresh_stats'))
              .setLabel('🔄 Refresh Stats')
              .setStyle(ButtonStyle.Secondary)
          );
          
          const message = await channel.send({ embeds: [embed], components: [row] });
          
          const currentWebhooks = config.webhooks || {};
          currentWebhooks.aboutUsMessageId = message.id;
          currentWebhooks.aboutUsChannelId = channel.id;
          await db.saveConfig({ ...config, webhooks: currentWebhooks });
          
          botService.logSimulated(`Successfully deployed Family Stats / About Us panel to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy Family Stats / About Us panel:', err.message);
      }
    }
    
    botService.logSimulated('[Mock Panel] Deployed Family Stats / About Us panel in #announcements channel.');
    return true;
  },

  syncFamilyStatsMessage: async () => {
    const config = await db.getConfig();
    const webhooks = config.webhooks || {};
    const messageId = webhooks.aboutUsMessageId;
    const channelId = webhooks.aboutUsChannelId;

    if (!messageId || !channelId || !client) return;

    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          const stats = await db.getFamilyStats();
          const embed = await botService.buildStatsEmbed(stats);
          
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p('refresh_stats'))
              .setLabel('🔄 Refresh Stats')
              .setStyle(ButtonStyle.Secondary)
          );
          
          await message.edit({ embeds: [embed], components: [row] });
          botService.logSimulated('Successfully updated active Discord Family Stats / About Us message.');
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to sync Family Stats / About Us message:', err.message);
    }
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
            .setImage((config.banners && config.banners['strike-system']) ? config.banners['strike-system'] : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800') // purple-red warning vibe neon
            .setColor(0xff0000)
            .setFooter({ text: `Strike System • 3 strikes max • Updated • Today at ${updatedTime}` });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p('my_strikes'))
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
            .setImage((config.banners && config.banners['strike-system']) ? config.banners['strike-system'] : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800')
            .setColor(0xff0000)
            .setFooter({ text: `Strike System • 3 strikes max • Updated • Today at ${updatedTime}` });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p('my_strikes'))
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
              .setCustomId(p('trigger_bonus_ticket'))
              .setLabel('💰 Bonus Problem')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(p('trigger_support_ticket'))
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
            .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p('check_my_balance'))
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
        let channel = await findChannel(guild, c => {
          const name = cleanName(c.name);
          return name.includes('activity-leaderboard') || name.includes('event-leaderboard') || name.includes('leaderboard');
        });
        if (!channel) {
          channel = await findChannel(guild, c => {
            const name = cleanName(c.name);
            return name.includes('weekly') && !name.includes('kill') && !name.includes('strike') && !name.includes('signup');
          });
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
            .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
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
      const channel = await activeClient.channels.fetch(channelId);
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
            .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
            .setTimestamp();

          await message.edit({ embeds: [embed] });
          botService.logSimulated('Successfully updated active Discord Weekly Event Leaderboard message.');
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to sync Weekly Event Leaderboard:', err.message);
    }
  },

  deployActivityPointsLeaderboardPrompt: async () => {
    botService.logSimulated('Attempting to deploy Activity Points Leaderboard panel to Discord...');
    const config = await db.getConfig();
    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = guild.channels.cache.find(c => {
          const name = cleanName(c.name);
          return name.includes('activity-points') || name.includes('points-leaderboard') || name.includes('leaderboard');
        });
        if (channel) {
          const members = await db.getMembers();
          const leaderboardList = [...members]
            .sort((a, b) => (b.points || 0) - (a.points || 0))
            .slice(0, 30);

          const entries = leaderboardList.map((m, idx) => {
            let rankIcon = `**${idx + 1}.**`;
            if (idx === 0) rankIcon = '🥇';
            else if (idx === 1) rankIcon = '🥈';
            else if (idx === 2) rankIcon = '🥉';
            return `${rankIcon} <@${m.discordId}> — \`${m.points || 0} pts\``;
          }).join('\n');

          const embed = new EmbedBuilder()
            .setTitle('White Pigeons #TOP1 Activity Points Leaderboard')
            .setDescription(entries || 'No points logs recorded yet.')
            .setColor(0xffbf5c)
            .setTimestamp();

          const myPointsBtn = new ButtonBuilder()
            .setCustomId(p('trigger_my_points'))
            .setLabel('My Points')
            .setStyle(ButtonStyle.Primary);

          const row = new ActionRowBuilder().addComponents(myPointsBtn);

          const message = await channel.send({ embeds: [embed], components: [row] });

          const currentWebhooks = config.webhooks || {};
          currentWebhooks.activityPointsMessageId = message.id;
          currentWebhooks.activityPointsChannelId = channel.id;
          await db.saveConfig({ ...config, webhooks: currentWebhooks });

          botService.logSimulated(`Successfully deployed Activity Points Leaderboard to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy Activity Points Leaderboard:', err.message);
      }
    }

    botService.logSimulated('[Mock Leaderboard] Deployed Activity Points Leaderboard panel in #activity-points.');
    return true;
  },

  syncActivityPointsLeaderboardMessage: async () => {
    const config = await db.getConfig();
    const webhooks = config.webhooks || {};
    const messageId = webhooks.activityPointsMessageId;
    const channelId = webhooks.activityPointsChannelId;

    if (!messageId || !channelId || !client) return;

    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          const members = await db.getMembers();
          const leaderboardList = [...members]
            .sort((a, b) => (b.points || 0) - (a.points || 0))
            .slice(0, 30);

          const entries = leaderboardList.map((m, idx) => {
            let rankIcon = `**${idx + 1}.**`;
            if (idx === 0) rankIcon = '🥇';
            else if (idx === 1) rankIcon = '🥈';
            else if (idx === 2) rankIcon = '🥉';
            return `${rankIcon} <@${m.discordId}> — \`${m.points || 0} pts\``;
          }).join('\n');

          const embed = new EmbedBuilder()
            .setTitle('White Pigeons #TOP1 Activity Points Leaderboard')
            .setDescription(entries || 'No points logs recorded yet.')
            .setColor(0xffbf5c)
            .setTimestamp();

          const myPointsBtn = new ButtonBuilder()
            .setCustomId(p('trigger_my_points'))
            .setLabel('My Points')
            .setStyle(ButtonStyle.Primary);

          const row = new ActionRowBuilder().addComponents(myPointsBtn);

          await message.edit({ embeds: [embed], components: [row] });
          botService.logSimulated('Successfully synced Activity Points Leaderboard message.');
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to sync Activity Points Leaderboard message:', err.message);
    }
  },

  deployAllTimeKillsPrompt: async () => {
    botService.logSimulated('Attempting to deploy All Time Kills Leaderboard prompt to Discord channel...');
    const config = await db.getConfig();

    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = await findChannel(guild, c => {
          const name = cleanName(c.name);
          return name.includes('long-time-kill') || name.includes('all-time-kill') || name.includes('long-term-kill') || name.includes('long-time') || name.includes('all-time');
        });
        if (!channel) {
          channel = await findChannel(guild, c => {
            const name = cleanName(c.name);
            return name.includes('kill-list') && !name.includes('weekly');
          });
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
            .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
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
            .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
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
        let channel = await findChannel(guild, c => {
          const name = cleanName(c.name);
          return (name.includes('weekly-kill') || name.includes('weekly')) && !name.includes('long-time') && !name.includes('all-time');
        });
        if (!channel) {
          channel = await findChannel(guild, c => {
            const name = cleanName(c.name);
            return name.includes('kill-list') && !name.includes('long-time') && !name.includes('all-time');
          });
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
            .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
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
            .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
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
            .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
            .setFooter({ text: 'White Pigeons #TOP1 • Priority List' });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p('priority_add_top5'))
              .setLabel('+ Add Top 5 Member')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(p('priority_add_top10'))
              .setLabel('+ Add Top 10 Member')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(p('priority_remove_top5'))
              .setLabel('X Remove Top 5 Member')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(p('priority_remove_top10'))
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
            .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
            .setFooter({ text: 'White Pigeons #TOP1 • Priority List' });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p('priority_add_top5'))
              .setLabel('+ Add Top 5 Member')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(p('priority_add_top10'))
              .setLabel('+ Add Top 10 Member')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(p('priority_remove_top5'))
              .setLabel('X Remove Top 5 Member')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(p('priority_remove_top10'))
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
  },

  buildActivityPromptEmbed: async () => {
    const dbTypes = await db.getActivityTypes();
    const entries = dbTypes.map(t => `${t.emoji || '📝'} ${t.name} **(${t.points || (t.value + ' points')})**`).join('\n');
    
    return new EmbedBuilder()
      .setTitle('White Pigeons #TOP1 Activity Point System')
      .setDescription(`You can submit the log without a screenshot...\n\n${entries}`)
      .setColor(0x23a55a)
      .setThumbnail('https://whitepigeonslive.web.app/logo.webp')
      .setTimestamp();
  },

  deployActivityPrompt: async () => {
    botService.logSimulated('Attempting to deploy Activity Point System panel to Discord channel...');
    const config = await db.getConfig();
    
    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = await findChannel(guild, c => {
          const name = cleanName(c.name);
          return name.includes('submit-activity') || (name.includes('activity') && !name.includes('review') && !name.includes('results') && !name.includes('leaderboard'));
        });
        
        if (channel) {
          const embed = await botService.buildActivityPromptEmbed();
          
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p('trigger_activity_submit'))
              .setLabel('Submit Activity')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(p('trigger_my_points'))
              .setLabel('My Points')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(p('trigger_refresh_activity'))
              .setLabel('🔄 Refresh')
              .setStyle(ButtonStyle.Secondary)
          );
          
          const message = await channel.send({ embeds: [embed], components: [row] });
          
          const currentWebhooks = config.webhooks || {};
          currentWebhooks.activityPromptMessageId = message.id;
          currentWebhooks.activityPromptChannelId = channel.id;
          await db.saveConfig({ ...config, webhooks: currentWebhooks });
          
          botService.logSimulated(`Successfully deployed Activity Point System panel to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy Activity Point System panel:', err.message);
      }
    }
    
    botService.logSimulated('[Mock Panel] Deployed Activity Point System panel in #submit-activity channel.');
    return true;
  },

  syncActivityPromptMessage: async () => {
    const config = await db.getConfig();
    const webhooks = config.webhooks || {};
    const messageId = webhooks.activityPromptMessageId;
    const channelId = webhooks.activityPromptChannelId;

    if (!messageId || !channelId || !client) return;

    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          const embed = await botService.buildActivityPromptEmbed();
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p('trigger_activity_submit'))
              .setLabel('Submit Activity')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(p('trigger_my_points'))
              .setLabel('My Points')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(p('trigger_refresh_activity'))
              .setLabel('🔄 Refresh')
              .setStyle(ButtonStyle.Secondary)
          );
          await message.edit({ embeds: [embed], components: [row] });
          botService.logSimulated('Successfully updated active Discord Activity Point System prompt.');
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to sync Activity Point System prompt:', err.message);
    }
  },

  buildBonusApprovalEmbed: async (submission) => {
    const baseAmount = submission.baseAmount || 200000;
    const participants = submission.participants || [];
    const members = await db.getMembers();

    let totalKills = 0;
    const details = [];

    for (const p of participants) {
      let username = p;
      let kills = 1;
      if (p.includes('|')) {
        const parts = p.split('|');
        username = parts[0].trim();
        kills = parseInt(parts[1], 10) || 1;
      }
      totalKills += kills;

      const member = members.find(m => 
        m.username.toLowerCase() === username.toLowerCase() || 
        (m.nickname && m.nickname.toLowerCase().includes(username.toLowerCase()))
      );

      const netAmount = kills * baseAmount;
      const mention = member ? `<@${member.discordId}>` : `*Not in DB*`;
      details.push(`• **${username}** ➔ ${mention} | 💀 \`${kills} Kills\` | 💰 \`$${netAmount.toLocaleString()}\``);
    }

    const totalBonus = totalKills * baseAmount;

    const embed = new EmbedBuilder()
      .setTitle('🕊️ WHITE PIGEONS ➔ PAYOUT AUTHORIZATION')
      .setDescription('Verify the event details below and authorize the bonus payout.')
      .addFields(
        { name: '🎯 Event Type', value: `\`${submission.eventName || 'Bizwar'}\``, inline: true },
        { name: '💰 Rate Per Kill', value: `\`$${baseAmount.toLocaleString()}\``, inline: true },
        { name: '📊 Total Kills', value: `\`${totalKills} Kills\``, inline: true },
        { name: '💵 Combined Payroll', value: `\`$${totalBonus.toLocaleString()}\``, inline: true },
        { name: '📅 Date Scheduled', value: `\`${submission.dateTimeStr || 'N/A'}\``, inline: true },
        { name: '⏰ Time Slot', value: `\`${submission.timeStr || 'N/A'}\``, inline: true },
        { name: '👥 Claimant Breakdown', value: details.length > 0 ? details.join('\n') : '*No participants logged*', inline: false }
      )
      .setColor(0xffaa00)
      .setTimestamp(new Date(submission.createdAt));

    if (submission.guildId && submission.channelId && submission.discordMessageId) {
      embed.addFields({ name: '🔗 Roster Thread Source', value: `[Jump to Original Post](https://discord.com/channels/${submission.guildId}/${submission.channelId}/${submission.discordMessageId})`, inline: false });
    }

    if (submission.mediaUrl) {
      embed.setImage(submission.mediaUrl);
    }

    return embed;
  },

  buildBonusApprovalComponents: async (submission) => {
    const eventSelect = new StringSelectMenuBuilder()
      .setCustomId(p(`bonus_select_event:${submission.id}`))
      .setPlaceholder('🎯 Select Event / Bonus Type')
      .addOptions([
        { label: 'Informal - $70,000/kill', value: 'Informal' },
        { label: 'Harbor - $50,000/kill', value: 'Harbor' },
        { label: 'Weapons - $40,000/kill', value: 'Weapons' },
        { label: 'Bizwar - $200,000/kill', value: 'Bizwar' },
        { label: 'Foundry - $40,000/kill', value: 'Foundry' }
      ]);

    const currentEvent = submission.eventName || 'Bizwar';
    const matchedOpt = eventSelect.options.find(o => o.data.value.toLowerCase() === currentEvent.toLowerCase());
    if (matchedOpt) {
      matchedOpt.setDefault(true);
    }

    const dateSelect = new StringSelectMenuBuilder()
      .setCustomId(p(`bonus_select_date:${submission.id}`))
      .setPlaceholder('📅 Select Date')
      .addOptions([
        { label: 'Today', value: 'Today' },
        { label: 'Tomorrow', value: 'Tomorrow' },
        { label: 'Yesterday', value: 'Yesterday' },
        { label: 'Before Yesterday', value: 'Before Yesterday' }
      ]);

    const timeSelect = new StringSelectMenuBuilder()
      .setCustomId(p(`bonus_select_time:${submission.id}`))
      .setPlaceholder('⏰ Select Time')
      .addOptions([
        { label: '15:00', value: '15:00' },
        { label: '16:00', value: '16:00' },
        { label: '17:00', value: '17:00' },
        { label: '18:00', value: '18:00' },
        { label: '19:00', value: '19:00' },
        { label: '19:05', value: '19:05' },
        { label: '20:00', value: '20:00' },
        { label: '21:00', value: '21:00' },
        { label: '22:00', value: '22:00' },
        { label: '23:00', value: '23:00' }
      ]);

    const currentTime = submission.timeStr || '19:05';
    const matchedTime = timeSelect.options.find(o => o.data.value === currentTime);
    if (matchedTime) {
      matchedTime.setDefault(true);
    }

    const userSelect = new StringSelectMenuBuilder()
      .setCustomId(p(`bonus_select_user:${submission.id}`))
      .setPlaceholder('👥 Select participant to edit kills')
      .addOptions(
        submission.participants.map(p => {
          let username = p;
          let kills = 1;
          if (p.includes('|')) {
            const parts = p.split('|');
            username = parts[0].trim();
            kills = parseInt(parts[1], 10) || 1;
          }
          return {
            label: `${username} (Kills: ${kills})`,
            value: username
          };
        }).slice(0, 25)
      );

    const row1 = new ActionRowBuilder().addComponents(eventSelect);
    const row2 = new ActionRowBuilder().addComponents(dateSelect);
    const row3 = new ActionRowBuilder().addComponents(timeSelect);
    const row4 = new ActionRowBuilder().addComponents(userSelect);

    const cancelBtn = new ButtonBuilder()
      .setCustomId(p(`bonus_cancel:${submission.id}`))
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔙');

    const confirmBtn = new ButtonBuilder()
      .setCustomId(p(`bonus_confirm:${submission.id}`))
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅');

    const row5 = new ActionRowBuilder().addComponents(cancelBtn, confirmBtn);

    return [row1, row2, row3, row4, row5];
  },

  sendBonusApprovalInteractiveEmbed: async (channel, submission) => {
    const embed = await botService.buildBonusApprovalEmbed(submission);
    const components = await botService.buildBonusApprovalComponents(submission);
    await channel.send({ embeds: [embed], components });
  },

  deployBonusAdminPanelPrompt: async () => {
    botService.logSimulated('Attempting to deploy Bonus System Admin Panel to Discord channel...');
    const config = await db.getConfig();

    if (client && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        let channel = guild.channels.cache.find(c => {
          const name = cleanName(c.name);
          return name.includes('bonus-admin-panel') || name.includes('bonus-admin');
        });
        if (!channel) {
          channel = guild.channels.cache.find(c => cleanName(c.name).includes('general') || cleanName(c.name).includes('announcement'));
        }

        if (channel) {
          const embed = await botService.buildBonusAdminPanelEmbed();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p('refresh_bonus_admin'))
              .setLabel('Refresh')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🔄'),
            new ButtonBuilder()
              .setCustomId(p('export_bonus_admin'))
              .setLabel('Export')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('📂')
          );

          const message = await channel.send({ embeds: [embed], components: [row] });

          const currentWebhooks = config.webhooks || {};
          currentWebhooks.bonusAdminMessageId = message.id;
          currentWebhooks.bonusAdminChannelId = channel.id;
          await db.saveConfig({ ...config, webhooks: currentWebhooks });

          botService.logSimulated(`Successfully deployed Bonus System Admin Panel to channel #${channel.name}`);
          return true;
        }
      } catch (err) {
        console.error('[Bot] Failed to deploy Bonus System Admin Panel:', err.message);
      }
    }
    return false;
  },

  syncBonusAdminPanelMessage: async () => {
    const config = await db.getConfig();
    const webhooks = config.webhooks || {};
    const messageId = webhooks.bonusAdminMessageId;
    const channelId = webhooks.bonusAdminChannelId;

    if (!messageId || !channelId || !client) return;

    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          const embed = await botService.buildBonusAdminPanelEmbed();
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(p('refresh_bonus_admin'))
              .setLabel('Refresh')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🔄'),
            new ButtonBuilder()
              .setCustomId(p('export_bonus_admin'))
              .setLabel('Export')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('📂')
          );
          await message.edit({ embeds: [embed], components: [row] });
          botService.logSimulated('Successfully updated active Discord Bonus System Admin Panel message.');
        }
      }
    } catch (err) {
      console.error('[Bot] Failed to sync Bonus System Admin Panel:', err.message);
    }
  },

  buildBonusAdminPanelEmbed: async () => {
    const config = await db.getConfig();
    const members = await db.getMembers();
    const activeMembers = [...members]
      .filter(m => (m.weeklyBonus || 0) > 0)
      .sort((a, b) => b.weeklyBonus - a.weeklyBonus);

    const totalBonus = activeMembers.reduce((acc, curr) => acc + (curr.weeklyBonus || 0), 0);
    const totalMembers = activeMembers.length;

    const top50 = activeMembers.slice(0, 50);
    const entries = top50.map((m, idx) => {
      const idxStr = `[ ${(idx + 1).toString().padStart(2, '0')} ]`;
      return `\`${idxStr}\` <@${m.discordId}> | ID: \`${m.characterId || 'N/A'}\` ➔ **$${m.weeklyBonus.toLocaleString()}**`;
    });

    let desc = entries.join('\n');
    if (activeMembers.length > 50) {
      desc += `\n\n... and ${activeMembers.length - 50} more`;
    }
    if (!desc) {
      desc = '*No active weekly payouts accumulated yet.*';
    }

    const embed = new EmbedBuilder()
      .setTitle('🕊️ WHITE PIGEONS ➔ WEEKLY PAYOUT LEDGER')
      .setDescription(desc)
      .addFields(
        { name: '💰 Total Payroll', value: `\`$${totalBonus.toLocaleString()}\``, inline: true },
        { name: '👥 Active Claimants', value: `\`${totalMembers} Members\``, inline: true }
      )
      .setColor(0x10b981)
      .setTimestamp();

    if (config.banners && config.banners['bonus-admin-panel']) {
      embed.setImage(config.banners['bonus-admin-panel']);
    } else {
      embed.setImage('https://images.unsplash.com/photo-1554672408-730436b60dde?w=500');
    }

    return embed;
  }
};

module.exports = botService;
