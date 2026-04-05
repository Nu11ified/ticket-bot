import { Client, GatewayIntentBits } from 'discord.js'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

client.once('ready', (c) => {
  console.log(`Bot ready as ${c.user.tag} — serving ${c.guilds.cache.size} guilds`)
})

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error('Failed to login:', err)
  process.exit(1)
})
