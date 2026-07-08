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

const DATA_DIR = path.join(__dirname, '..', 'data');
const VERIFY_MULTI_PATH = path.join(DATA_DIR, 'verification-guilds.json');
const STATE_NAME = process.env.STATE_NAME || 'State 4500';

const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';
const isApply = mode === 'apply';
const targetArg = process.argv.find((arg) => arg.startsWith('--guild-id='));
const TARGET_GUILD_ID = targetArg?.split('=')[1] || process.env.TARGET_GUILD_ID || process.env.SECOND_GUILD_ID;

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

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function roleByName(guild, name) {
  return guild.roles.cache.find((role) => role.name === name);
}

async function ensureRole(guild, spec) {
  const existing = roleByName(guild, spec.name);
  const data = {
    name: spec.name,
    color: spec.color,
    hoist: Boolean(spec.hoist),
    mentionable: Boolean(spec.mentionable),
    reason: `${STATE_NAME} verification-only setup`,
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

async function ensureVerifyChannel(guild) {
  const existing = guild.channels.cache.find((channel) => (
    channel.type === ChannelType.GuildText &&
    ['🐺・verify-state', 'verify-state', 'verify'].includes(channel.name)
  ));
  const everyone = guild.roles.everyone;
  const botRole = guild.members.me.roles.highest;
  const overwrites = [
    {
      id: everyone.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.UseApplicationCommands,
      ],
    },
    {
      id: botRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];
  const topic = `Verify your WOS name and alliance tag for ${STATE_NAME}.`;
  if (existing) {
    console.log(`channel exists: ${existing.name}`);
    if (isApply) {
      await existing.edit({
        name: '🐺・verify-state',
        topic,
        permissionOverwrites: overwrites,
        reason: `${STATE_NAME} verification-only setup`,
      });
    }
    return existing;
  }
  console.log('channel create: 🐺・verify-state');
  if (!isApply) return null;
  return guild.channels.create({
    name: '🐺・verify-state',
    type: ChannelType.GuildText,
    topic,
    permissionOverwrites: overwrites,
    reason: `${STATE_NAME} verification-only setup`,
  });
}

async function upsertInstruction(channel, existingMessageId) {
  if (!channel) return null;
  const content = [
    `# Verify for ${STATE_NAME}`,
    'Use this channel to unlock state access.',
    '',
    'Run:',
    '`/verify username: YourWOSName alliance: TAG`',
    '',
    'Example:',
    '`/verify username: WolfKing4500 alliance: LWS`',
    '',
    'The bot will set your nickname to `[TAG] YourWOSName`, grant `Verified State Member`, and assign your alliance tag role.',
  ].join('\n');
  let message = existingMessageId ? await channel.messages.fetch(existingMessageId).catch(() => null) : null;
  if (!message) {
    const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    message = recent?.find((candidate) => candidate.author.id === channel.client.user.id && candidate.content.startsWith(`# Verify for ${STATE_NAME}`));
  }
  if (!isApply) {
    console.log('seed instruction message');
    return null;
  }
  if (message) await message.edit({ content, allowedMentions: { parse: [] } });
  else message = await channel.send({ content, allowedMentions: { parse: [] } });
  await message.pin('Pin verification instructions').catch(() => {});
  return message;
}

async function registerVerifyCommand(guild) {
  if (!isApply) {
    console.log('register /verify command');
    return;
  }
  await guild.commands.create({
    name: 'verify',
    description: `Verify for ${STATE_NAME}.`,
    options: [
      {
        type: 3,
        name: 'username',
        description: 'Your exact WOS username',
        required: true,
      },
      {
        type: 3,
        name: 'alliance',
        description: 'Your alliance tag, e.g. LWS',
        required: true,
      },
    ],
  });
  console.log('registered /verify command');
}

async function printInvite(client) {
  const perms = new PermissionsBitField([
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.UseApplicationCommands,
    PermissionFlagsBits.ManageNicknames,
  ]);
  console.log(`Invite URL: https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=${perms.bitfield.toString()}&scope=bot%20applications.commands`);
}

async function main() {
  if (!process.env.DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN');
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  await client.login(process.env.DISCORD_TOKEN);
  try {
    console.log(`[verification-only] Connected as ${client.user.tag}`);
    const visibleGuilds = await client.guilds.fetch();
    for (const [id, guild] of visibleGuilds) {
      console.log(`guild: ${guild.name} (${id})${id === TARGET_GUILD_ID ? ' <target>' : ''}`);
    }

    if (!TARGET_GUILD_ID) {
      console.log('No target guild set. Run with --guild-id=SERVER_ID after inviting the bot.');
      await printInvite(client);
      return;
    }

    const guild = await client.guilds.fetch(TARGET_GUILD_ID).catch(() => null);
    if (!guild) {
      console.log(`Target guild ${TARGET_GUILD_ID} is not visible to the bot yet.`);
      await printInvite(client);
      return;
    }
    await guild.roles.fetch();
    await guild.channels.fetch();
    await guild.members.fetchMe();

    console.log(`[verification-only] Target guild: ${guild.name} (${guild.id})`);
    console.log(`[verification-only] Mode: ${mode}`);

    for (const spec of [...ROLE_SPECS].reverse()) await ensureRole(guild, spec);
    await guild.roles.fetch();
    const channel = await ensureVerifyChannel(guild);
    const config = readJson(VERIFY_MULTI_PATH, { guilds: {} });
    config.guilds ||= {};
    const existing = config.guilds[guild.id] || {};
    const message = await upsertInstruction(channel, existing.messageId);
    if (isApply && channel) {
      config.guilds[guild.id] = {
        guildName: guild.name,
        channelId: channel.id,
        messageId: message?.id || existing.messageId || null,
        grantRoleName: 'Verified State Member',
      };
      writeJson(VERIFY_MULTI_PATH, config);
    }
    await registerVerifyCommand(guild);
    console.log(`[verification-only] ${isApply ? 'Apply complete' : 'Dry-run complete'}.`);
  } finally {
    client.destroy();
  }
}

main().catch((error) => {
  console.error('[verification-only] failed:', error);
  process.exit(1);
});
