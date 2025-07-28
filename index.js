import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const API_BASE = 'https://helldiverstrainingmanual.com/api/v1';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- Keep-alive server for UptimeRobot ---
const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(process.env.PORT || 3000, () => {
  console.log('Keep-alive server running.');
});

// --- Helper to fetch API JSON ---
async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${url}`);
    return await res.json();
  } catch (err) {
    console.error('API fetch error:', err);
    return null;
  }
}

// --- Terminid loadouts array for /bug-loadout ---
const terminidLoadouts = [
  {
    armour: "TR-40 Golden Eagle",
    primary: "SG-225IE Breaker Incendiary",
    secondary: "P-4 Senator",
    grenades: "G-6 Frag",
    stratagems: [
      "Eagle 500kg Bomb",
      "Orbital Laser",
      "Orbital Napalm Barrage",
      "GR-8 Recoilless Rifle"
    ]
  },
  {
    armour: "I-09 Heatseeker",
    primary: "SG-451 Cookout",
    secondary: "GP-31 Grenade Pistol",
    grenades: "G-10 Incendiary",
    stratagems: [
      "Eagle 500kg Bomb",
      "Orbital Laser",
      "FLAM-40 Flamethrower",
      'AX/LAS-5 "Guard Dog" Rover'
    ]
  },
  {
    armour: "DP-40 Hero of the Federation",
    primary: "AR-23P Liberator Penetrator",
    secondary: "P-19 Redeemer",
    grenades: "G-123 Thermite",
    stratagems: [
      "Eagle Napalm Airstrike",
      "Gatling Sentry",
      "M-105 Stalwart",
      "B-1 Supply Pack"
    ]
  }
];

// --- Slash Commands ---
const commands = [
  new SlashCommandBuilder().setName('war').setDescription('Show current galactic war status'),
  new SlashCommandBuilder().setName('orders').setDescription('Show current major orders'),
  new SlashCommandBuilder().setName('dispatch').setDescription('Show latest dispatch message'),
  new SlashCommandBuilder().setName('campaigns').setDescription('Show active campaigns'),
  new SlashCommandBuilder().setName('bug-loadout').setDescription('Get a random Terminid loadout'),
].map(command => command.toJSON());

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Slash commands registered.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// --- Command Handling ---
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'war') {
    const campaigns = await fetchJSON(`${API_BASE}/war/campaign`);
    if (!campaigns || campaigns.length === 0) {
      return interaction.reply('No active campaigns available to show war status.');
    }

    const data = await fetchJSON(`${API_BASE}/war/status`);
    if (!data || !data.planetStatus) {
      return interaction.reply('No war status data available.');
    }

    const ownersMap = {
      1: 'Helldivers',
      2: 'Illuminate',
      3: 'Bugs',
      4: 'Automaton',
    };

    const campaignPlanets = campaigns.slice(0, 10);
    const campaignPlanetsLower = campaignPlanets.map(p => (p.name || p).toLowerCase().trim());

    const filteredPlanets = data.planetStatus.filter(p =>
      campaignPlanetsLower.includes(p.planet.toLowerCase().trim())
    );

    if (filteredPlanets.length === 0) {
      return interaction.reply('No war status available for active campaign planets.');
    }

    const planetsInfo = filteredPlanets
      .map(p => `Planet ${p.planet} | Owner ${ownersMap[p.owner] || p.owner} | Health ${p.health.toLocaleString()} | Players ${p.players}`)
      .join('\n');

    return interaction.reply(`🌌 Galactic War Status for Active Campaign Planets:\n${planetsInfo}`);
  }

  if (commandName === 'orders') {
    const data = await fetchJSON(`${API_BASE}/war/major-orders`);
    if (!data || data.length === 0) {
      return interaction.reply('No major orders available.');
    }

    const order = data[0];
    const title = order.setting.overrideTitle || 'Major Order';
    const brief = order.setting.overrideBrief || 'No brief available.';
    const progress = order.progress || [];
    const tasks = order.setting.tasks || [];

    let progressLines = '';
    for (let i = 0; i < tasks.length; i++) {
      const target = tasks[i].values[2] || 0;
      const current = progress[i] || 0;
      progressLines += `• Task ${i + 1}: ${current.toLocaleString()} / ${target.toLocaleString()}\n`;
    }

    const rewards = order.setting.reward ? `Rewards: Warbond Medals: ${order.setting.reward.amount}` : '';

    return interaction.reply(`📜 ${title}:\n${brief}\n\nProgress:\n${progressLines}${rewards ? `\n\n${rewards}` : ''}`);
  }

  if (commandName === 'dispatch') {
    const data = await fetchJSON(`${API_BASE}/war/news`);
    if (!data || data.length === 0) {
      return interaction.reply('No dispatch messages available.');
    }

    const latest = data[data.length - 1];
    const message = latest.message || 'No message available.';
    return interaction.reply(`📢 Latest Dispatch:\n${message}`);
  }

  if (commandName === 'campaigns') {
    const data = await fetchJSON(`${API_BASE}/war/campaign`);
    if (!data || data.length === 0) {
      return interaction.reply('No active campaigns available.');
    }

    const campaignsList = data.map(c => `• ${c.name || c}`).join('\n');

    return interaction.reply(`🎖️ Active Campaigns:\n${campaignsList}`);
  }

  if (commandName === 'bug-loadout') {
    const randomNum = Math.floor(Math.random() * terminidLoadouts.length);
    const loadout = terminidLoadouts[randomNum];

    const embed = new EmbedBuilder()
      .setTitle(`Here is a loadout perfect for destroying Terminids:`)
      .setColor('#3cb371') // Medium Sea Green for Terminids
      .addFields(
        { name: 'Armour', value: loadout.armour, inline: true },
        { name: 'Primary', value: loadout.primary, inline: true },
        { name: 'Secondary', value: loadout.secondary, inline: true },
        { name: 'Grenades', value: loadout.grenades, inline: true },
        { name: 'Stratagems', value: loadout.stratagems.join(', '), inline: false }
      );

    await interaction.reply({ embeds: [embed] });
  }
});

// --- Start Bot ---
(async () => {
  await registerCommands();
  await client.login(TOKEN);
  console.log('Bot is starting...');
})();

  await registerCommands();
  await client.login(TOKEN);
  console.log(`Logged in as ${client.user.tag}!`);
})();
