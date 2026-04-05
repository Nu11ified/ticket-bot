import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const guilds = pgTable('guilds', {
  id: serial('id').primaryKey(),
  discordId: text('discord_id').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Guild = typeof guilds.$inferSelect
export type NewGuild = typeof guilds.$inferInsert
