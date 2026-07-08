require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const {
  ChannelType,
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  PermissionsBitField,
} = require('discord.js');

const mode = process.argv.includes('--apply')
  ? 'apply'
  : process.argv.includes('--live-dry-run')
    ? 'live-dry-run'
    : 'dry-run';

const isApply = mode === 'apply';
const isLive = mode === 'apply' || mode === 'live-dry-run';
const STATE_NAME = process.env.STATE_NAME || 'State 4500';
const DATA_DIR = path.join(__dirname, '..', 'data');
const SEED_PATH = path.join(DATA_DIR, 'seed-messages.json');
const REACTION_PATH = path.join(DATA_DIR, 'reaction-roles.json');
const VERIFY_PATH = path.join(DATA_DIR, 'verification.json');

const COLORS = {
  gold: 0xf5c542,
  crimson: 0xb82f3a,
  steel: 0x7289a6,
  ice: 0x9bd7ff,
  green: 0x46b37b,
  violet: 0x8e7cff,
  orange: 0xf28c38,
  white: 0xd7f3ff,
};

const ROLE_SPECS = [
  { name: 'Governor / President', color: COLORS.gold, hoist: true },
  { name: 'State Council', color: COLORS.crimson, hoist: true },
  { name: 'State Moderator', color: COLORS.orange, hoist: true },
  { name: 'Diplomat', color: COLORS.violet, hoist: true },
  { name: 'Alliance Representative', color: COLORS.ice, hoist: true },
  { name: 'War Council', color: COLORS.steel, hoist: true },
  { name: 'Rally Lead', color: COLORS.gold },
  { name: 'Scout', color: COLORS.green },
  { name: 'Verified State Member', color: COLORS.white },
  { name: 'Guest / Visitor', color: COLORS.steel },
  { name: 'State Bot', color: COLORS.green },
  { name: 'SVS Ping', color: COLORS.gold, mentionable: true },
  { name: 'Fortress Ping', color: COLORS.violet, mentionable: true },
  { name: 'Foundry Ping', color: COLORS.steel, mentionable: true },
  { name: 'Canyon Ping', color: COLORS.ice, mentionable: true },
  { name: 'Bear Trap Ping', color: COLORS.orange, mentionable: true },
  { name: 'Crazy Joe Ping', color: COLORS.crimson, mentionable: true },
  { name: 'State Meeting Ping', color: COLORS.green, mentionable: true },
  { name: 'Transfer Ping', color: COLORS.orange, mentionable: true },
];

const VERIFIED_ROLES = [
  'Governor / President',
  'State Council',
  'State Moderator',
  'Diplomat',
  'Alliance Representative',
  'War Council',
  'Rally Lead',
  'Scout',
  'Verified State Member',
];
const STAFF_ROLES = ['Governor / President', 'State Council', 'State Moderator'];
const OFFICIAL_ROLES = ['Governor / President', 'State Council', 'State Moderator', 'Diplomat', 'Alliance Representative', 'War Council'];
const OPS_WRITERS = ['Governor / President', 'State Council', 'State Moderator', 'War Council', 'Rally Lead', 'Scout'];
const ALLIANCE_WRITERS = ['Governor / President', 'State Council', 'State Moderator', 'Diplomat', 'Alliance Representative'];

const CATEGORIES = [
  {
    name: 'START HERE',
    profile: 'verified',
    channels: [
      { key: 'verify', name: 'verify-state', displayName: '🐺・verify-state', type: ChannelType.GuildText, seed: 'verify', publicEntry: true },
      { key: 'state-rules', name: 'state-rules', displayName: '📜・state-rules', type: ChannelType.GuildText, seed: 'state-rules', readOnly: true, writers: OFFICIAL_ROLES },
      { key: 'nap-rules', name: 'nap-rules', displayName: '🛡️・nap-rules', type: ChannelType.GuildText, seed: 'nap-rules', readOnly: true, writers: OFFICIAL_ROLES },
      { key: 'server-map', name: 'server-map', displayName: '🧭・server-map', type: ChannelType.GuildText, seed: 'server-map', readOnly: true, writers: OFFICIAL_ROLES },
      { key: 'choose-roles', name: 'choose-roles', displayName: '🎭・choose-roles', type: ChannelType.GuildText, seed: 'choose-roles', readOnly: true, writers: OFFICIAL_ROLES },
      { key: 'announcements', name: 'state-announcements', displayName: '📣・state-announcements', type: ChannelType.GuildText, seed: 'announcements', readOnly: true, writers: OFFICIAL_ROLES },
    ],
  },
  {
    name: 'STATE COMMONS',
    profile: 'verified',
    channels: [
      { key: 'state-chat', name: 'state-chat', displayName: '💬・state-chat', type: ChannelType.GuildText, seed: 'state-chat' },
      { key: 'questions-help', name: 'questions-help', displayName: '❓・questions-help', type: ChannelType.GuildText, seed: 'questions-help' },
      { key: 'gift-codes', name: 'gift-codes', displayName: '🎁・gift-codes', type: ChannelType.GuildText, seed: 'gift-codes' },
      { key: 'screenshots', name: 'screenshots', displayName: '📸・screenshots', type: ChannelType.GuildText, seed: 'screenshots' },
      { key: 'campfire', name: 'campfire', displayName: '☕・campfire', type: ChannelType.GuildText, seed: 'campfire' },
    ],
  },
  {
    name: 'STATE OPS',
    profile: 'verified',
    channels: [
      { key: 'state-calendar', name: 'state-calendar', displayName: '🗓️・state-calendar', type: ChannelType.GuildText, seed: 'state-calendar', readOnly: true, writers: OFFICIAL_ROLES },
      { key: 'svs-planning', name: 'svs-planning', displayName: '🛡️・svs-planning', type: ChannelType.GuildText, seed: 'svs-planning', readOnly: true, writers: OPS_WRITERS },
      { key: 'fortress-planning', name: 'fortress-planning', displayName: '🏰・fortress-planning', type: ChannelType.GuildText, seed: 'fortress-planning', readOnly: true, writers: OPS_WRITERS },
      { key: 'targets-scouts', name: 'targets-and-scouts', displayName: '🎯・targets-and-scouts', type: ChannelType.GuildText, seed: 'targets-scouts', readOnly: true, writers: OPS_WRITERS },
      { key: 'shield-alerts', name: 'shield-alerts', displayName: '🚨・shield-alerts', type: ChannelType.GuildText, seed: 'shield-alerts', readOnly: true, writers: OPS_WRITERS },
      { key: 'battle-reports', name: 'battle-reports', displayName: '📋・battle-reports', type: ChannelType.GuildText, seed: 'battle-reports', readOnly: true, writers: OPS_WRITERS },
    ],
  },
  {
    name: 'ALLIANCE HALL',
    profile: 'verified',
    channels: [
      { key: 'alliance-reps', name: 'alliance-reps', displayName: '🤝・alliance-reps', type: ChannelType.GuildText, seed: 'alliance-reps', readOnly: true, writers: ALLIANCE_WRITERS },
      { key: 'diplomacy', name: 'diplomacy', displayName: '🌐・diplomacy', type: ChannelType.GuildText, seed: 'diplomacy', readOnly: true, writers: ALLIANCE_WRITERS },
      { key: 'transfer-requests', name: 'transfer-requests', displayName: '📦・transfer-requests', type: ChannelType.GuildText, seed: 'transfer-requests' },
      { key: 'recruitment-board', name: 'recruitment-board', displayName: '📢・recruitment-board', type: ChannelType.GuildText, seed: 'recruitment-board' },
    ],
  },
  {
    name: 'GUIDES',
    profile: 'verified',
    channels: [
      { key: 'guide-index', name: 'guide-index', displayName: '📚・guide-index', type: ChannelType.GuildText, seed: 'guide-index', readOnly: true, writers: OFFICIAL_ROLES },
      { key: 'svs-guide', name: 'svs-guide', displayName: '🛡️・svs-guide', type: ChannelType.GuildText, seed: 'svs-guide', readOnly: true, writers: OFFICIAL_ROLES },
      { key: 'fortress-guide', name: 'fortress-guide', displayName: '🏰・fortress-guide', type: ChannelType.GuildText, seed: 'fortress-guide', readOnly: true, writers: OFFICIAL_ROLES },
      { key: 'nap-guide', name: 'nap-guide', displayName: '🤝・nap-guide', type: ChannelType.GuildText, seed: 'nap-guide', readOnly: true, writers: OFFICIAL_ROLES },
      { key: 'transfer-guide', name: 'transfer-guide', displayName: '🚚・transfer-guide', type: ChannelType.GuildText, seed: 'transfer-guide', readOnly: true, writers: OFFICIAL_ROLES },
      { key: 'growth-guide', name: 'growth-guide', displayName: '💪・growth-guide', type: ChannelType.GuildText, seed: 'growth-guide', readOnly: true, writers: OFFICIAL_ROLES },
    ],
  },
  {
    name: 'STAFF',
    profile: 'staff',
    channels: [
      { key: 'governor-council', name: 'governor-council', displayName: '👑・governor-council', type: ChannelType.GuildText, seed: 'governor-council' },
      { key: 'mod-log', name: 'mod-log', displayName: '🛠️・mod-log', type: ChannelType.GuildText, seed: 'mod-log' },
      { key: 'reports', name: 'reports', displayName: '⚠️・reports', type: ChannelType.GuildText, seed: 'reports' },
      { key: 'rule-enforcement', name: 'rule-enforcement', displayName: '🧾・rule-enforcement', type: ChannelType.GuildText, seed: 'rule-enforcement' },
      { key: 'bot-admin', name: 'bot-admin', displayName: '🔐・bot-admin', type: ChannelType.GuildText, seed: 'bot-admin' },
    ],
  },
  {
    name: 'VOICE',
    profile: 'verified',
    channels: [
      { key: 'voice-state-meeting', name: 'State Meeting', displayName: '🎙️ State Meeting', type: ChannelType.GuildVoice },
      { key: 'voice-svs-command', name: 'SVS Command', displayName: '🛡️ SVS Command', type: ChannelType.GuildVoice, writers: OPS_WRITERS },
      { key: 'voice-fortress-command', name: 'Fortress Command', displayName: '🏰 Fortress Command', type: ChannelType.GuildVoice, writers: OPS_WRITERS },
      { key: 'voice-alliance-reps', name: 'Alliance Reps', displayName: '🤝 Alliance Reps', type: ChannelType.GuildVoice, writers: ALLIANCE_WRITERS },
      { key: 'voice-public', name: 'Public Voice', displayName: '💬 Public Voice', type: ChannelType.GuildVoice },
      { key: 'voice-quiet-grind', name: 'Quiet Grind', displayName: '🏭 Quiet Grind', type: ChannelType.GuildVoice },
    ],
  },
];

const TOPICS = {
  verify: 'New members verify WOS name and alliance tag here.',
  'state-rules': 'State-wide rules and conduct expectations.',
  'nap-rules': 'NAP rules, protected alliances, and no-hit guidance.',
  'server-map': 'Quick map for the state Discord.',
  'choose-roles': 'Pick event pings and state notification roles.',
  announcements: 'Official state-wide announcements.',
  'state-chat': 'General state chat for verified players.',
  'questions-help': 'Ask WOS and state Discord questions.',
  'gift-codes': 'Share working Whiteout Survival gift codes.',
  screenshots: 'Share battle reports, event results, and screenshots.',
  campfire: 'Casual state chat.',
  'state-calendar': 'Confirmed state event times and meetings.',
  'svs-planning': 'SVS plans, prep reminders, and battle coordination.',
  'fortress-planning': 'Fortress and stronghold planning.',
  'targets-scouts': 'Targets, scouts, and battle intel.',
  'shield-alerts': 'Shield reminders and urgent alerts.',
  'battle-reports': 'After-action reports and lessons learned.',
  'alliance-reps': 'Alliance representative coordination.',
  diplomacy: 'Inter-alliance diplomacy and state agreements.',
  'transfer-requests': 'Transfer requests and state entry coordination.',
  'recruitment-board': 'Alliance recruitment posts.',
  'guide-index': 'Table of contents for guide channels.',
  'svs-guide': 'SVS guide and state battle basics.',
  'fortress-guide': 'Fortress guide and rally basics.',
  'nap-guide': 'NAP rules and diplomacy guide.',
  'transfer-guide': 'Transfer guide and expectations.',
  'growth-guide': 'Growth, heroes, gear, and account advice.',
  'governor-council': 'Private governor and state council coordination.',
  'mod-log': 'Private moderation log.',
  reports: 'Private reports and moderation review.',
  'rule-enforcement': 'Private rule enforcement tracking.',
  'bot-admin': 'Private bot and automation control.',
};

const SEEDS = {
  verify: `# Verify for ${STATE_NAME}
Use this channel to unlock the state server.

Run:
\`/verify username: YourWOSName alliance: TAG\`

Example:
\`/verify username: WolfKing4500 alliance: LWS\`

The bot will set your nickname to \`[TAG] YourWOSName\`, grant Verified State Member, and assign your alliance tag role.`,
  'state-rules': `# ${STATE_NAME} Rules
1. Respect state-wide calls, NAP rules, and protected alliance agreements.
2. Keep state chat civil. No harassment, hate speech, or leaking private plans.
3. Follow SVS, Fortress, and shield instructions from state leadership.
4. Use the right channel so important calls stay readable.
5. Alliance representatives should speak for their alliance clearly and responsibly.`,
  'nap-rules': `# NAP Rules
Post the current NAP list, protected alliances, purge windows, tile rules, fortress rules, and state no-hit agreements here.`,
  'server-map': `# Server Map
Use this map once channels are created:
- Verify in the state verification channel.
- Read state rules and NAP rules first.
- Use commons for normal chat and help.
- Use state ops for official planning and alerts.
- Use alliance hall for diplomacy, recruitment, and transfers.
- Use guides for permanent state information.`,
  'choose-roles': `# Choose Roles
React to the panels below for event pings and state notifications.

Alliance roles are assigned during verification with your alliance tag.`,
  announcements: `# State Announcements
Official state-wide notices, meeting calls, SVS alerts, NAP updates, and important reminders go here.`,
  'state-chat': `Main chat for verified state members.`,
  'questions-help': `Ask WOS, server, event, transfer, and state coordination questions here.`,
  'gift-codes': `Share working Whiteout Survival gift codes here. Include the date tested if possible.`,
  screenshots: `Share battle reports, scoreboards, event results, and useful screenshots.`,
  campfire: `Casual state conversation.`,
  'state-calendar': `Post confirmed state meetings, SVS windows, fortress times, and cross-alliance events here.`,
  'svs-planning': `Official SVS prep, shield windows, phase reminders, target rules, and battle calls.`,
  'fortress-planning': `Fortress/stronghold planning, rally windows, garrison assignments, and scout summaries.`,
  'targets-scouts': `Post approved targets, scouts, timers, and enemy movement notes here.`,
  'shield-alerts': `Urgent shield reminders and state safety alerts.`,
  'battle-reports': `Post after-action reports, scoreboards, and lessons learned.`,
  'alliance-reps': `Alliance representatives coordinate state topics here.`,
  diplomacy: `Diplomacy, NAP discussions, disputes, and inter-alliance agreements.`,
  'transfer-requests': `Players asking to enter the state can post current state, power, furnace, and alliance preference here.`,
  'recruitment-board': `Alliance recruitment posts and contact info.`,
  'guide-index': `# Guide Index
Links will be refreshed after setup.`,
  'svs-guide': `# SVS Guide
Paste the state SVS guide here.`,
  'fortress-guide': `# Fortress Guide
Paste the fortress/stronghold guide here.`,
  'nap-guide': `# NAP Guide
Paste the NAP and diplomacy guide here.`,
  'transfer-guide': `# Transfer Guide
Paste transfer requirements and state entry expectations here.`,
  'growth-guide': `# Growth Guide
Paste growth, heroes, gear, and account advice here.`,
  'governor-council': `Private state leadership coordination.`,
  'mod-log': `Private moderation log.`,
  reports: `Private player reports and review notes.`,
  'rule-enforcement': `Private rule enforcement tracking.`,
  'bot-admin': `Private bot setup, tokens, commands, and automation notes.`,
};

const REACTION_ROLE_PANELS = [
  {
    key: 'event-pings',
    title: 'State Event Pings',
    description: 'React to toggle event reminders.',
    roles: [
      ['🛡️', 'SVS Ping'],
      ['🏰', 'Fortress Ping'],
      ['⚒️', 'Foundry Ping'],
      ['🏔️', 'Canyon Ping'],
      ['🐻', 'Bear Trap Ping'],
      ['🧟', 'Crazy Joe Ping'],
      ['🎙️', 'State Meeting Ping'],
      ['📦', 'Transfer Ping'],
    ],
  },
];

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJson(filePath, data) {
  ensureDir();
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
function roleByName(guild, name) {
  return guild.roles.cache.find((role) => role.name === name);
}
function ids(guild, names) {
  return names.map((name) => roleByName(guild, name)?.id).filter(Boolean);
}
function allow(id, permissions) {
  return { id, allow: permissions };
}
function deny(id, permissions) {
  return { id, deny: permissions };
}
function mergeOverwrites(overwrites) {
  const byId = new Map();
  for (const overwrite of overwrites) {
    const current = byId.get(overwrite.id) || { id: overwrite.id };
    if (overwrite.allow) current.allow = new PermissionsBitField(current.allow || 0n).add(overwrite.allow);
    if (overwrite.deny) current.deny = new PermissionsBitField(current.deny || 0n).add(overwrite.deny);
    if (current.allow && current.deny) current.allow.remove(current.deny);
    byId.set(overwrite.id, current);
  }
  return [...byId.values()];
}
function findChannel(guild, spec, type) {
  const names = [spec.displayName, spec.name].filter(Boolean);
  return guild.channels.cache.find((channel) => channel.type === type && names.includes(channel.name));
}
function baseOverwrites(guild, profile) {
  const everyone = guild.roles.everyone.id;
  const verified = ids(guild, VERIFIED_ROLES);
  const staff = ids(guild, STAFF_ROLES);
  const botRoles = ids(guild, ['State Bot']);
  const view = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
  const text = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.SendMessagesInThreads];
  const bot = [...text, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AddReactions];

  if (profile === 'staff') {
    return mergeOverwrites([deny(everyone, [PermissionFlagsBits.ViewChannel]), ...staff.map((id) => allow(id, text)), ...botRoles.map((id) => allow(id, bot))]);
  }
  return mergeOverwrites([deny(everyone, [PermissionFlagsBits.ViewChannel]), ...verified.map((id) => allow(id, text)), ...botRoles.map((id) => allow(id, bot))]);
}
function channelOverwrites(guild, categorySpec, channelSpec) {
  const everyone = guild.roles.everyone.id;
  const verified = ids(guild, VERIFIED_ROLES);
  const writers = ids(guild, channelSpec.writers || []);
  const botRoles = ids(guild, ['State Bot']);
  const view = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
  const text = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.SendMessagesInThreads];
  const noWrite = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads, PermissionFlagsBits.SendMessagesInThreads];
  const voice = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak];
  const bot = [...text, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AddReactions];
  const overwrites = baseOverwrites(guild, categorySpec.profile);

  if (channelSpec.publicEntry) {
    overwrites.push(allow(everyone, text));
  }
  if (channelSpec.readOnly && channelSpec.type === ChannelType.GuildText) {
    overwrites.push(deny(everyone, noWrite));
    for (const id of verified) overwrites.push(deny(id, noWrite));
    for (const id of writers) overwrites.push(allow(id, text));
  }
  if (channelSpec.type === ChannelType.GuildVoice && channelSpec.writers) {
    const staffVoice = ids(guild, channelSpec.writers);
    overwrites.push(deny(everyone, [PermissionFlagsBits.Connect]));
    for (const id of verified) overwrites.push(deny(id, [PermissionFlagsBits.Connect]));
    for (const id of staffVoice) overwrites.push(allow(id, voice));
  }
  for (const id of botRoles) overwrites.push(allow(id, bot));
  return mergeOverwrites(overwrites);
}
async function ensureRole(guild, spec) {
  const existing = roleByName(guild, spec.name);
  const data = {
    name: spec.name,
    color: spec.color,
    hoist: Boolean(spec.hoist),
    mentionable: Boolean(spec.mentionable),
    reason: 'State Discord setup',
  };
  if (existing) {
    console.log(`role exists: ${spec.name}`);
    if (isApply) await existing.edit(data);
    return existing;
  }
  console.log(`role create: ${spec.name}`);
  if (!isApply) return null;
  return guild.roles.create(data);
}
async function ensureCategory(guild, spec) {
  const existing = findChannel(guild, { name: spec.name, displayName: spec.name }, ChannelType.GuildCategory);
  const permissionOverwrites = baseOverwrites(guild, spec.profile);
  if (existing) {
    console.log(`category exists: ${spec.name}`);
    if (isApply) await existing.permissionOverwrites.set(permissionOverwrites, 'Refresh state category permissions');
    return existing;
  }
  console.log(`category create: ${spec.name}`);
  if (!isApply) return null;
  return guild.channels.create({ name: spec.name, type: ChannelType.GuildCategory, permissionOverwrites, reason: 'State Discord setup' });
}
async function ensureChannel(guild, category, categorySpec, spec) {
  const existing = findChannel(guild, spec, spec.type);
  const permissionOverwrites = channelOverwrites(guild, categorySpec, spec);
  const topic = spec.type === ChannelType.GuildText ? TOPICS[spec.seed || spec.key] || `${spec.displayName} for ${STATE_NAME}.` : undefined;
  if (existing) {
    console.log(`channel exists: ${existing.name} -> ${spec.displayName}`);
    if (isApply) await existing.edit({ name: spec.displayName, parent: category?.id, topic, permissionOverwrites, reason: 'Refresh state channel settings' });
    return existing;
  }
  console.log(`channel create: ${spec.displayName}`);
  if (!isApply) return null;
  return guild.channels.create({ name: spec.displayName, type: spec.type, parent: category?.id, topic, permissionOverwrites, reason: 'State Discord setup' });
}
async function upsertSeed(channel, key, content) {
  if (!channel || channel.type !== ChannelType.GuildText || !content) return null;
  const state = readJson(SEED_PATH, {});
  let message = state[key]?.messageId ? await channel.messages.fetch(state[key].messageId).catch(() => null) : null;
  if (!message) {
    const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    message = recent?.find((candidate) => candidate.author.id === channel.client.user.id && candidate.content.startsWith(content.split('\n')[0]));
  }
  console.log(`seed message: ${channel.name}`);
  if (!isApply) return null;
  if (message) await message.edit(content);
  else message = await channel.send({ content, allowedMentions: { parse: [] } });
  if (!message.pinned) await message.pin('Pin state starter message').catch(() => {});
  state[key] = { channelId: channel.id, messageId: message.id };
  writeJson(SEED_PATH, state);
  return message;
}
function reactionPanelContent(guild, panel) {
  return [
    `# ${panel.title}`,
    panel.description,
    '',
    ...panel.roles.map(([emoji, roleName]) => {
      const role = roleByName(guild, roleName);
      return `${emoji}  ${role ? `<@&${role.id}>` : roleName}`;
    }),
    '',
    'React to add the role. Remove your reaction to remove it.',
  ].join('\n');
}
async function ensureReactionPanels(guild) {
  const seed = readJson(SEED_PATH, {});
  const rolesChannel = seed['choose-roles']?.channelId ? await guild.channels.fetch(seed['choose-roles'].channelId).catch(() => null) : null;
  if (!rolesChannel) return;
  const state = readJson(REACTION_PATH, { panels: {}, mappings: {} });
  state.panels ||= {};
  state.mappings ||= {};
  for (const panel of REACTION_ROLE_PANELS) {
    console.log(`reaction panel: ${panel.title}`);
    if (!isApply) continue;
    const content = reactionPanelContent(guild, panel);
    let message = state.panels[panel.key]?.messageId ? await rolesChannel.messages.fetch(state.panels[panel.key].messageId).catch(() => null) : null;
    if (!message) message = await rolesChannel.send({ content, allowedMentions: { parse: [] } });
    else await message.edit({ content, allowedMentions: { parse: [] } });
    await message.reactions.removeAll().catch(() => {});
    for (const [emoji] of panel.roles) await message.react(emoji).catch((error) => console.warn(`reaction skipped ${emoji}: ${error.message}`));
    state.panels[panel.key] = { channelId: rolesChannel.id, messageId: message.id };
    state.mappings[message.id] = Object.fromEntries(panel.roles);
  }
  writeJson(REACTION_PATH, state);
}
function buildGuideIndex(seed) {
  return `# Guide Index
- SVS Guide: ${seed['svs-guide']?.channelId ? `<#${seed['svs-guide'].channelId}>` : '#svs-guide'}
- Fortress Guide: ${seed['fortress-guide']?.channelId ? `<#${seed['fortress-guide'].channelId}>` : '#fortress-guide'}
- NAP Guide: ${seed['nap-guide']?.channelId ? `<#${seed['nap-guide'].channelId}>` : '#nap-guide'}
- Transfer Guide: ${seed['transfer-guide']?.channelId ? `<#${seed['transfer-guide'].channelId}>` : '#transfer-guide'}
- Growth Guide: ${seed['growth-guide']?.channelId ? `<#${seed['growth-guide'].channelId}>` : '#growth-guide'}`;
}
async function refreshDynamicSeeds(guild) {
  if (!isApply) return;
  const seed = readJson(SEED_PATH, {});
  if (seed.verify?.channelId) writeJson(VERIFY_PATH, { channelId: seed.verify.channelId, grantRoleName: 'Verified State Member' });
  if (seed['guide-index']?.channelId) {
    const channel = await guild.channels.fetch(seed['guide-index'].channelId).catch(() => null);
    if (channel) await upsertSeed(channel, 'guide-index', buildGuideIndex(seed));
  }
}
function logPlan() {
  console.log(`[State] ${STATE_NAME} Discord builder dry run`);
  console.log(`Roles: ${ROLE_SPECS.length}`);
  for (const role of ROLE_SPECS) console.log(`  role: ${role.name}`);
  console.log(`Categories: ${CATEGORIES.length}`);
  for (const category of CATEGORIES) {
    console.log(`  category: ${category.name}`);
    for (const channel of category.channels) console.log(`    ${channel.type === ChannelType.GuildVoice ? 'voice' : 'text'}: ${channel.displayName}`);
  }
}
async function verifyBotCanRun(guild) {
  const needed = [
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.ViewChannel,
  ];
  const missing = new PermissionsBitField(needed).remove(guild.members.me.permissions);
  if (missing.bitfield !== 0n) throw new Error(`Bot is missing permissions: ${missing.toArray().join(', ')}`);
}
async function buildLive() {
  if (!process.env.DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN');
  if (!process.env.GUILD_ID) throw new Error('Missing GUILD_ID');
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  await client.login(process.env.DISCORD_TOKEN);
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.roles.fetch();
    await guild.channels.fetch();
    await guild.members.fetchMe();
    console.log(`[State] Connected as ${client.user.tag}`);
    console.log(`[State] Target guild: ${guild.name} (${guild.id})`);
    console.log(`[State] Mode: ${mode}`);
    await verifyBotCanRun(guild);

    for (const spec of [...ROLE_SPECS].reverse()) await ensureRole(guild, spec);
    await guild.roles.fetch();
    const stateBotRole = roleByName(guild, 'State Bot');
    if (isApply && stateBotRole && !guild.members.me.roles.cache.has(stateBotRole.id)) {
      await guild.members.me.roles.add(stateBotRole, 'Assign State Bot display role').catch((error) => console.warn(`bot role assign skipped: ${error.message}`));
    }

    for (const categorySpec of CATEGORIES) {
      const category = await ensureCategory(guild, categorySpec);
      await guild.channels.fetch();
      for (const channelSpec of categorySpec.channels) {
        const channel = await ensureChannel(guild, category, categorySpec, channelSpec);
        if (channelSpec.seed) await upsertSeed(channel, channelSpec.key, SEEDS[channelSpec.seed]);
      }
    }
    await refreshDynamicSeeds(guild);
    await ensureReactionPanels(guild);
    console.log(`[State] ${isApply ? 'Apply complete' : 'Live dry-run complete'}.`);
  } finally {
    client.destroy();
  }
}
async function main() {
  if (!isLive) {
    logPlan();
    return;
  }
  await buildLive();
}
main().catch((error) => {
  console.error(`[State] setup failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
