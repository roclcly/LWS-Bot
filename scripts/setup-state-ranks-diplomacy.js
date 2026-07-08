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

const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';
const isApply = mode === 'apply';
const targetArg = process.argv.find((arg) => arg.startsWith('--guild-id='));
const TARGET_GUILD_ID = targetArg?.split('=')[1] || process.env.TARGET_GUILD_ID || process.env.SECOND_GUILD_ID;
const DATA_DIR = path.join(__dirname, '..', 'data');
const VERIFY_MULTI_PATH = path.join(DATA_DIR, 'verification-guilds.json');

const COLORS = {
  gold: 0xf5c542,
  crimson: 0xb82f3a,
  violet: 0x8e7cff,
  ice: 0x9bd7ff,
  frost: 0xd7f3ff,
};

const RANK_ROLES = [
  { name: 'R5', color: COLORS.gold, hoist: true },
  { name: 'R4', color: COLORS.crimson, hoist: true },
  { name: 'R3', color: COLORS.violet, hoist: true },
  { name: 'R2', color: COLORS.ice },
  { name: 'R1', color: COLORS.frost },
];

const STAFF_ROLE_NAMES = [
  'Moderator',
  'Governor / President',
  'State Council',
  'State Moderator',
  'Diplomat',
  'Alliance Representative',
  'War Council',
];

const DIPLOMACY_CATEGORY = '🤝・wos-diplomacy';
const DIPLOMACY_CATEGORY_ALIASES = [DIPLOMACY_CATEGORY, '🤝・diplomacy', 'Diplomacy', 'WOS Diplomacy'];
const DIPLOMACY_CHANNELS = [
  { name: '🤝・diplomacy', aliases: ['diplomacy', '🌐・diplomacy'] },
  { name: '🪪・alliance-reps', aliases: ['alliance-reps', '🤝・alliance-reps'] },
  { name: '🛡️・nap-rules', aliases: ['nap-rules', '🛡️・nap-rules'] },
  { name: '📦・transfer-requests', aliases: ['transfer-requests', '📦・transfer-requests'] },
  { name: '⚠️・conflict-reports', aliases: ['conflict-reports', '⚠️・conflict-reports'] },
];

const CHANNEL_RENAMES = new Map([
  ['Text Channels', '💬・text-channels'],
  ['Voice Channels', '🔊・voice-channels'],
  ['general', '💬・general'],
  ['General', '🔊・general'],
  ['📒rules', '📜・rules'],
  ['moderator-only', '🛠️・moderator-only'],
  ['📢announcements', '📣・announcements'],
  ['💥start-here', '💥・start-here'],
  ['💪State Coordination', '💪・state-coordination'],
  ['⚔️ Battle Room', '⚔️・battle-room'],
  ['Irrelevant Entertainment', '🎮・entertainment'],
  ['🎁gift-codes', '🎁・gift-codes'],
  ['🍇-foodz-🍔🌭🌮🌯🥙🥗', '🍇・foodz'],
  ['💬 Community', '💬・community'],
  ['📌important-links', '📌・important-links'],
  ['📚Guides', '📚・guides'],
  ['❓faq-questions-and-answers', '❓・faq'],
  ['🪎Alliance Information', '🪎・alliance-information'],
  ['🗺️state-map', '🗺️・state-map'],
  ['📆-event-calendar', '📆・event-calendar'],
  ['⚔️-svs-planning', '⚔️・svs-planning'],
  ['😂memes-🐸', '😂・memes'],
  ['🍇grapes-only', '🍇・grapes-only'],
  ['🔥elmo-burn-book-📕', '🔥・elmo-burn-book'],
  ['📕beginners-guide', '📕・beginners-guide'],
  ['🍇reb-graperebellion', '🍇・reb-graperebellion'],
  ['🆓free-to-play-guides', '🆓・free-to-play-guides'],
  ['🦸hero-information', '🦸・hero-information'],
  ['🏆-achievements', '🏆・achievements'],
  ['🐶-pets', '🐶・pets'],
  ['🌎world-chat-quotes', '🌎・world-chat-quotes'],
]);

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function roleByName(guild, name) {
  return guild.roles.cache.find((role) => role.name === name);
}

function ids(guild, names) {
  return names.map((name) => roleByName(guild, name)?.id).filter(Boolean);
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

function basePerms(guild, kind) {
  const everyone = guild.roles.everyone.id;
  const bot = guild.members.me.roles.highest.id;
  const verified = roleByName(guild, 'Verified State Member')?.id;
  const ranks = ids(guild, ['R1', 'R2', 'R3', 'R4', 'R5']);
  const diplomacy = ids(guild, ['R4', 'R5']);
  const staff = ids(guild, STAFF_ROLE_NAMES);
  const view = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
  const text = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.CreatePublicThreads,
    PermissionFlagsBits.SendMessagesInThreads,
  ];
  const voice = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
  ];
  const botAccess = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
  ];

  if (kind === 'verify') {
    return mergeOverwrites([
      { id: everyone, allow: text },
      { id: bot, allow: botAccess },
    ]);
  }

  if (kind === 'diplomacy') {
    return mergeOverwrites([
      { id: everyone, deny: [PermissionFlagsBits.ViewChannel] },
      ...(verified ? [{ id: verified, deny: [PermissionFlagsBits.ViewChannel] }] : []),
      ...ids(guild, ['R1', 'R2', 'R3']).map((id) => ({ id, deny: [PermissionFlagsBits.ViewChannel] })),
      ...diplomacy.map((id) => ({ id, allow: text })),
      ...staff.map((id) => ({ id, allow: text })),
      { id: bot, allow: botAccess },
    ]);
  }

  return mergeOverwrites([
    { id: everyone, deny: [PermissionFlagsBits.ViewChannel] },
    ...(verified ? [{ id: verified, allow: text }] : []),
    ...ranks.map((id) => ({ id, allow: text })),
    ...staff.map((id) => ({ id, allow: text })),
    { id: bot, allow: botAccess },
  ]);
}

function channelPerms(guild, channel, kind) {
  const overwrites = basePerms(guild, kind);
  if (channel?.type === ChannelType.GuildVoice) {
    const bot = guild.members.me.roles.highest.id;
    const everyone = guild.roles.everyone.id;
    const verified = roleByName(guild, 'Verified State Member')?.id;
    const allowedVoiceIds = kind === 'diplomacy'
      ? [...ids(guild, ['R4', 'R5']), ...ids(guild, STAFF_ROLE_NAMES), bot]
      : [...ids(guild, ['R1', 'R2', 'R3', 'R4', 'R5']), ...ids(guild, STAFF_ROLE_NAMES), bot, ...(verified ? [verified] : [])];
    return mergeOverwrites([
      { id: everyone, deny: [PermissionFlagsBits.ViewChannel] },
      ...allowedVoiceIds.map((id) => ({
        id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      })),
    ]);
  }
  return overwrites;
}

async function ensureRole(guild, spec) {
  const existing = roleByName(guild, spec.name);
  const data = {
    name: spec.name,
    color: spec.color,
    hoist: Boolean(spec.hoist),
    mentionable: false,
    reason: 'State rank setup',
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

function findChannelByNames(guild, names, type) {
  const wanted = new Set(names);
  return guild.channels.cache.find((channel) => (
    (type === undefined || channel.type === type) &&
    wanted.has(channel.name)
  ));
}

async function ensureDiplomacy(guild) {
  let category = findChannelByNames(guild, DIPLOMACY_CATEGORY_ALIASES, ChannelType.GuildCategory);
  const permissionOverwrites = basePerms(guild, 'diplomacy');
  if (category) {
    console.log(`category exists: ${category.name} -> ${DIPLOMACY_CATEGORY}`);
    if (isApply) await category.edit({ name: DIPLOMACY_CATEGORY, permissionOverwrites, reason: 'Refresh diplomacy category' });
  } else {
    console.log(`category create: ${DIPLOMACY_CATEGORY}`);
    if (isApply) {
      category = await guild.channels.create({
        name: DIPLOMACY_CATEGORY,
        type: ChannelType.GuildCategory,
        permissionOverwrites,
        reason: 'Create WOS diplomacy category',
      });
    }
  }

  for (const spec of DIPLOMACY_CHANNELS) {
    let channel = findChannelByNames(guild, [spec.name, ...spec.aliases], ChannelType.GuildText);
    const overwrites = basePerms(guild, 'diplomacy');
    if (channel) {
      console.log(`diplomacy channel exists: ${channel.name} -> ${spec.name}`);
      if (isApply) {
        await channel.edit({
          name: spec.name,
          parent: category?.id,
          permissionOverwrites: overwrites,
          reason: 'Refresh WOS diplomacy channel',
        });
      }
    } else {
      console.log(`diplomacy channel create: ${spec.name}`);
      if (isApply) {
        channel = await guild.channels.create({
          name: spec.name,
          type: ChannelType.GuildText,
          parent: category?.id,
          permissionOverwrites: overwrites,
          reason: 'Create WOS diplomacy channel',
        });
      }
    }
  }
}

async function renameChannels(guild) {
  for (const [from, to] of CHANNEL_RENAMES.entries()) {
    const channel = guild.channels.cache.find((candidate) => candidate.name === from);
    if (!channel) continue;
    console.log(`rename: ${from} -> ${to}`);
    if (isApply) {
      await channel.edit({ name: to, reason: 'Normalize State #4500 channel naming' }).catch((error) => {
        console.warn(`rename skipped ${from}: ${error.message}`);
      });
    }
  }
}

async function applyPermissions(guild, verifyChannelId) {
  const diplomacyNames = new Set([DIPLOMACY_CATEGORY, ...DIPLOMACY_CHANNELS.map((channel) => channel.name)]);
  const editableTypes = new Set([
    ChannelType.GuildCategory,
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildForum,
    ChannelType.GuildAnnouncement,
  ]);
  let touched = 0;
  let skipped = 0;
  for (const channel of guild.channels.cache.values()) {
    if (!editableTypes.has(channel.type)) continue;
    const kind = channel.id === verifyChannelId
      ? 'verify'
      : diplomacyNames.has(channel.name) || diplomacyNames.has(channel.parent?.name)
        ? 'diplomacy'
        : 'normal';
    const permissionOverwrites = channelPerms(guild, channel, kind);
    console.log(`permissions ${kind}: ${channel.name}`);
    if (!isApply) continue;
    try {
      await channel.permissionOverwrites.set(permissionOverwrites, 'Apply State #4500 rank visibility');
      touched++;
    } catch (error) {
      skipped++;
      console.warn(`permission skipped ${channel.name}: ${error.message}`);
    }
  }
  if (isApply) console.log(`permissions applied=${touched} skipped=${skipped}`);
}

async function verifyMatrix(guild, verifyChannelId) {
  const roles = ['Verified State Member', 'R1', 'R2', 'R3', 'R4', 'R5'];
  const diplomacyNames = new Set([DIPLOMACY_CATEGORY, ...DIPLOMACY_CHANNELS.map((channel) => channel.name)]);
  const unverifiedVisible = [];
  const verifiedHiddenNormal = [];
  const lowerDiplomacyVisible = [];
  const upperDiplomacyHidden = [];

  for (const channel of guild.channels.cache.values()) {
    if (![ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildForum, ChannelType.GuildAnnouncement].includes(channel.type)) continue;
    const isVerify = channel.id === verifyChannelId;
    const isDiplomacy = diplomacyNames.has(channel.name) || diplomacyNames.has(channel.parent?.name);
    if (channel.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel) && !isVerify) {
      unverifiedVisible.push(channel.name);
    }
    const verified = roleByName(guild, 'Verified State Member');
    if (verified && !isDiplomacy && !isVerify && !channel.permissionsFor(verified)?.has(PermissionFlagsBits.ViewChannel)) {
      verifiedHiddenNormal.push(channel.name);
    }
    for (const roleName of ['R1', 'R2', 'R3']) {
      const role = roleByName(guild, roleName);
      if (role && isDiplomacy && channel.permissionsFor(role)?.has(PermissionFlagsBits.ViewChannel)) {
        lowerDiplomacyVisible.push(`${roleName}:${channel.name}`);
      }
    }
    for (const roleName of ['R4', 'R5']) {
      const role = roleByName(guild, roleName);
      if (role && isDiplomacy && !channel.permissionsFor(role)?.has(PermissionFlagsBits.ViewChannel)) {
        upperDiplomacyHidden.push(`${roleName}:${channel.name}`);
      }
    }
  }

  console.log(`verify-matrix roles=${roles.join(', ')}`);
  console.log(`unverifiedVisible=${unverifiedVisible.join(', ') || 'none'}`);
  console.log(`verifiedHiddenNormal=${verifiedHiddenNormal.join(', ') || 'none'}`);
  console.log(`lowerDiplomacyVisible=${lowerDiplomacyVisible.join(', ') || 'none'}`);
  console.log(`upperDiplomacyHidden=${upperDiplomacyHidden.join(', ') || 'none'}`);
}

async function main() {
  if (!process.env.DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN');
  if (!TARGET_GUILD_ID) throw new Error('Missing --guild-id=SERVER_ID');
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  try {
    const guild = await client.guilds.fetch(TARGET_GUILD_ID);
    await guild.roles.fetch();
    await guild.channels.fetch();
    await guild.members.fetchMe();
    const verification = readJson(VERIFY_MULTI_PATH, { guilds: {} }).guilds?.[guild.id] || {};
    const verifyChannelId = verification.channelId;
    if (!verifyChannelId) throw new Error(`No verification channel configured for ${guild.id}`);

    console.log(`[rank-diplomacy] Connected as ${client.user.tag}`);
    console.log(`[rank-diplomacy] Target guild: ${guild.name} (${guild.id})`);
    console.log(`[rank-diplomacy] Mode: ${mode}`);

    for (const spec of [...RANK_ROLES].reverse()) await ensureRole(guild, spec);
    if (isApply) await guild.roles.fetch();
    await ensureDiplomacy(guild);
    if (isApply) await guild.channels.fetch();
    await renameChannels(guild);
    if (isApply) await guild.channels.fetch();
    await applyPermissions(guild, verifyChannelId);
    if (isApply) {
      await guild.channels.fetch();
      await verifyMatrix(guild, verifyChannelId);
    }
    console.log(`[rank-diplomacy] ${isApply ? 'Apply complete' : 'Dry-run complete'}.`);
  } finally {
    client.destroy();
  }
}

main().catch((error) => {
  console.error('[rank-diplomacy] failed:', error);
  process.exit(1);
});
