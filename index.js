import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
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

// --- Slash Commands ---
const commands = [
  new SlashCommandBuilder().setName('war').setDescription('Show current galactic war status'),
  new SlashCommandBuilder().setName('orders').setDescription('Show current major orders'),
  new SlashCommandBuilder().setName('dispatch').setDescription('Show latest dispatch message'),
  new SlashCommandBuilder().setName('campaigns').setDescription('Show active campaigns'),
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
    const data = await fetchJSON(`${API_BASE}/war/status`);
    if (!data || !data.planetStatus) {
      await interaction.reply('No war status data available.');
      return;
    }

    const ownersMap = {
      1: 'Helldivers',
      2: 'Illuminate',
      3: 'Bugs',
      4: 'Automaton',
    };

    const planetsInfo = data.planetStatus
      .slice(0, 10)
      .map(p => `Index ${p.index} | Owner ${ownersMap[p.owner] || p.owner} | Health ${p.health.toLocaleString()} | Players ${p.players}`)
      .join('\n');

    await interaction.reply(`🌌 Galactic War Status (up to 10 planets):\n${planetsInfo}`);

  } else if (commandName === 'orders') {
    const data = await fetchJSON(`${API_BASE}/war/major-orders`);
    if (!data || data.length === 0) {
      await interaction.reply('No major orders available.');
      return;
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

    let rewards = '';
    if (order.setting.reward) {
      const amount = order.setting.reward.amount;
      rewards = `Rewards: Warbond Medals: ${amount}`;
    }

    await interaction.reply(`📜 ${title}:\n${brief}\n\nProgress:\n${progressLines}${rewards ? `\n\n${rewards}` : ''}`);

  } else if (commandName === 'dispatch') {
    const data = await fetchJSON(`${API_BASE}/war/news`);
    if (!data || data.length === 0) {
      await interaction.reply('No dispatch messages available.');
      return;
    }
    const latest = data[data.length - 1];
    const message = latest.message || 'No message available.';
    await interaction.reply(`📢 Latest Dispatch:\n${message}`);

  } else if (commandName === 'campaigns') {
    const data = await fetchJSON(`${API_BASE}/war/campaign`);
    if (!data || data.length === 0) {
      await interaction.reply('No active campaigns available.');
      return;
    }
    const campaignsList = data.map(c => `• ${c.name || c}`).join('\n');
    await interaction.reply(`🎖️ Active Campaigns:\n${campaignsList}`);
  }
});

// --- Start Bot ---
(async () => {
  await registerCommands();
  await client.login(TOKEN);
  console.log(`Logged in as ${client.user.tag}!`);
})();
