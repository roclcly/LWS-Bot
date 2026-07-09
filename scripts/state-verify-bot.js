require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  Partials,
  SlashCommandBuilder,
} = require('discord.js');

const STATE_NAME = process.env.STATE_NAME || 'State 4500';
const DATA_DIR = path.join(__dirname, '..', 'data');
const REACTION_PATH = path.join(DATA_DIR, 'reaction-roles.json');
const VERIFY_PATH = path.join(DATA_DIR, 'verification.json');
const VERIFY_MULTI_PATH = path.join(DATA_DIR, 'verification-guilds.json');
const DEFAULT_CLEANUP_EXEMPT_USERNAMES = ['roclcly'];

function envList(name) {
  return String(process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

const CLEANUP_EXEMPT_USER_IDS = new Set(envList('VERIFY_CLEANUP_EXEMPT_USER_IDS'));
const CLEANUP_EXEMPT_USERNAMES = new Set(
  [...DEFAULT_CLEANUP_EXEMPT_USERNAMES, ...envList('VERIFY_CLEANUP_EXEMPT_USERNAMES')]
    .map((value) => value.toLowerCase()),
);

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}
function verificationForGuild(guildId) {
  const multi = readJson(VERIFY_MULTI_PATH, { guilds: {} });
  if (multi.guilds?.[guildId]) return multi.guilds[guildId];
  const legacy = readJson(VERIFY_PATH, {});
  if (!process.env.GUILD_ID || guildId === process.env.GUILD_ID) return legacy;
  return {};
}
function deleteSoon(message, delayMs = 0) {
  setTimeout(() => {
    message.delete().catch(() => {});
  }, delayMs).unref?.();
}
function cleanName(value) {
  const name = String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/@everyone|@here/g, '').trim();
  if (name.length < 2 || name.length > 32) return null;
  if (/[<>#@]/.test(name) || /https?:\/\//i.test(name)) return null;
  return name;
}
function cleanAlliance(value) {
  const tag = String(value || '').trim().replace(/^\[|\]$/g, '').toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(tag)) return null;
  return tag;
}
async function roleByName(guild, name) {
  return guild.roles.cache.find((role) => role.name === name) || guild.roles.fetch().then((roles) => roles.find((role) => role.name === name));
}
async function ensureAllianceRole(guild, tag) {
  const existing = await roleByName(guild, tag);
  if (existing) return existing;
  await guild.members.fetchMe();
  const managedBotRole = guild.roles.cache.find((role) => role.managed && role.tags?.botId === guild.client.user.id)
    || guild.roles.cache.find((role) => role.managed && role.name === guild.members.me.displayName);
  const targetPosition = managedBotRole ? managedBotRole.position - 1 : guild.members.me.roles.highest.position - 1;
  return guild.roles.create({
    name: tag,
    color: 0x9bd7ff,
    mentionable: false,
    reason: `Create alliance role from ${STATE_NAME} verification`,
  }).then(async (role) => {
    await role.setPosition(Math.max(1, targetPosition)).catch(() => {});
    return role;
  });
}
function canAssignRole(guild, role) {
  const botHighest = guild.members.me?.roles.highest;
  return !!botHighest && botHighest.position > role.position;
}
async function finishInteraction(interaction, content) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(content).catch((error) => {
      console.error(`[verify] edit reply failed: ${error.stack || error.message}`);
    });
    return;
  }
  await interaction.reply({ content, ephemeral: true }).catch((error) => {
    console.error(`[verify] reply failed: ${error.stack || error.message}`);
  });
}
async function resolveReaction(reaction) {
  if (reaction.partial) return reaction.fetch();
  return reaction;
}
async function toggleReactionRole(reaction, user, action) {
  if (user.bot) return;
  const resolved = await resolveReaction(reaction);
  const state = readJson(REACTION_PATH, { mappings: {} });
  const roleName = state.mappings?.[resolved.message.id]?.[resolved.emoji.name];
  if (!roleName || !resolved.message.guild) return;

  const role = await roleByName(resolved.message.guild, roleName);
  if (!role) return;
  const member = await resolved.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  if (action === 'add') {
    if (!member.roles.cache.has(role.id)) await member.roles.add(role, `State reaction role ${resolved.emoji.name}`);
    console.log(`[reaction] added ${role.name} to ${user.tag}`);
  } else {
    if (member.roles.cache.has(role.id)) await member.roles.remove(role, `State reaction role ${resolved.emoji.name}`);
    console.log(`[reaction] removed ${role.name} from ${user.tag}`);
  }
}
async function verifyInteraction(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'verify') return;

  const verification = verificationForGuild(interaction.guildId);
  if (verification.channelId && interaction.channelId !== verification.channelId) {
    await finishInteraction(interaction, `Please verify in <#${verification.channelId}>.`);
    return;
  }

  const username = cleanName(interaction.options.getString('username', true));
  const alliance = cleanAlliance(interaction.options.getString('alliance', true));
  if (!username || !alliance) {
    await finishInteraction(interaction, 'Use a valid WOS username and an alliance tag of 2-8 letters/numbers.');
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const member = interaction.member;
  await guild.members.fetchMe();
  const verifiedRole = await roleByName(guild, verification.grantRoleName || 'Verified State Member');
  if (!verifiedRole) {
    await finishInteraction(interaction, 'Verified role is missing. Please contact state staff.');
    return;
  }
  const nickname = `[${alliance}] ${username}`;
  const warnings = [];

  const verifiedGranted = await member.roles.add(verifiedRole, `${STATE_NAME} verification`).then(() => true).catch((error) => {
    console.warn(`[verify] role grant failed for ${member.user.tag}: ${error.message}`);
    warnings.push(`I could not grant **${verifiedRole.name}**. Move my highest bot role (**${guild.members.me.roles.highest.name}**) above **${verifiedRole.name}** in Server Settings > Roles.`);
    return false;
  });

  const nicked = await member.setNickname(nickname, `${STATE_NAME} verification`).then(() => true).catch((error) => {
    console.warn(`[verify] nickname failed for ${member.user.tag}: ${error.message}`);
    warnings.push('I could not change your nickname. This usually means your role is above the bot.');
    return false;
  });

  let allianceRole = null;
  let allianceGranted = false;
  try {
    allianceRole = await ensureAllianceRole(guild, alliance);
    allianceGranted = await member.roles.add(allianceRole, `${STATE_NAME} verification`).then(() => true).catch((error) => {
      console.warn(`[verify] alliance role grant failed for ${member.user.tag}: ${error.message}`);
      warnings.push(`I could not grant **${allianceRole.name}**. Move **${allianceRole.name}** below my highest bot role (**${guild.members.me.roles.highest.name}**) if you want alliance tags assigned automatically.`);
      return false;
    });
  } catch (error) {
    console.warn(`[verify] alliance role create failed for ${member.user.tag}: ${error.message}`);
    warnings.push(`I could not create or find the **${alliance}** alliance role.`);
  }

  const granted = [
    verifiedGranted ? verifiedRole.name : null,
    allianceGranted && allianceRole ? allianceRole.name : null,
  ].filter(Boolean);
  const nameStatus = nicked ? `Verified as **${nickname}**.` : `Verification processed for **${username}**.`;
  const roleStatus = granted.length ? ` You now have ${granted.join(' and ')}.` : '';
  const warningStatus = warnings.length ? `\n\n${warnings.join('\n')}` : '';
  await finishInteraction(interaction, `${nameStatus}${roleStatus}${warningStatus}`);
  console.log(`[verify] ${member.user.tag} -> ${nickname}; verified=${verifiedGranted}; alliance=${allianceGranted}`);
}
async function cleanVerificationMessage(message) {
  if (!message.guild) return;
  const verification = verificationForGuild(message.guild.id);
  if (!verification.channelId || message.channel.id !== verification.channelId) return;
  if (message.id === verification.messageId) return;
  if (CLEANUP_EXEMPT_USER_IDS.has(message.author.id)) return;
  if (CLEANUP_EXEMPT_USERNAMES.has(message.author.username.toLowerCase())) return;
  deleteSoon(message);
}
async function registerCommands(client) {
  const multi = readJson(VERIFY_MULTI_PATH, { guilds: {} });
  const guildIds = new Set(Object.keys(multi.guilds || {}));
  if (process.env.GUILD_ID) guildIds.add(process.env.GUILD_ID);
  if (!guildIds.size) return;
  const command = new SlashCommandBuilder()
    .setName('verify')
    .setDescription(`Verify for ${STATE_NAME}.`)
    .addStringOption((option) => option.setName('username').setDescription('Your exact WOS username').setRequired(true))
    .addStringOption((option) => option.setName('alliance').setDescription('Your alliance tag, e.g. LWS').setRequired(true));
  for (const guildId of guildIds) {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) continue;
    await guild.commands.create(command);
    console.log(`[verify] /verify command registered in ${guild.name}`);
  }
}
async function tryGrantAdmin(client) {
  const multi = readJson(VERIFY_MULTI_PATH, { guilds: {} });
  const guildIds = new Set(Object.keys(multi.guilds || {}));
  if (process.env.GUILD_ID) guildIds.add(process.env.GUILD_ID);
  for (const guildId of guildIds) {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) continue;
    await guild.members.fetchMe();
    if (guild.members.me.permissions.has(PermissionFlagsBits.Administrator)) {
      console.log(`[admin] already administrator in ${guild.name}`);
      continue;
    }
    console.warn(`[admin] ${guild.name}: bot managed role is not editable by the bot. Re-authorize with Administrator: https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands&guild_id=${guild.id}`);
  }
}
async function main() {
  if (!process.env.DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN');
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });
  client.once('clientReady', () => {
    console.log(`[state-bot] online as ${client.user.tag}`);
    registerCommands(client).catch((error) => console.error(`[verify] command register failed: ${error.stack || error.message}`));
    tryGrantAdmin(client).catch((error) => console.error(`[admin] check failed: ${error.stack || error.message}`));
  });
  client.on('messageReactionAdd', (reaction, user) => {
    toggleReactionRole(reaction, user, 'add').catch((error) => console.error(`[reaction] add failed: ${error.stack || error.message}`));
  });
  client.on('messageReactionRemove', (reaction, user) => {
    toggleReactionRole(reaction, user, 'remove').catch((error) => console.error(`[reaction] remove failed: ${error.stack || error.message}`));
  });
  client.on('interactionCreate', (interaction) => {
    verifyInteraction(interaction).catch((error) => {
      console.error(`[verify] failed: ${error.stack || error.message}`);
      if (interaction.isRepliable?.()) {
        finishInteraction(interaction, `Verification failed: ${error.message}`).catch(() => {});
      }
    });
  });
  client.on('messageCreate', (message) => {
    cleanVerificationMessage(message).catch((error) => console.error(`[verify-cleanup] failed: ${error.stack || error.message}`));
  });
  await client.login(process.env.DISCORD_TOKEN);
}
main().catch((error) => {
  console.error(`[state-bot] failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
