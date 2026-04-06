import { relations } from 'drizzle-orm'
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { categories } from './categories.js'
import { guilds } from './guilds.js'

export const panels = pgTable('panels', {
	id: serial('id').primaryKey(),
	guildId: integer('guild_id')
		.notNull()
		.references(() => guilds.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	channelId: text('channel_id'),
	messageId: text('message_id'),
	embedTitle: text('embed_title'),
	embedDescription: text('embed_description'),
	embedColor: integer('embed_color'),
	embedThumbnailUrl: text('embed_thumbnail_url'),
	embedFooterText: text('embed_footer_text'),
	isPublished: boolean('is_published').default(false).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const panelButtons = pgTable('panel_buttons', {
	id: serial('id').primaryKey(),
	panelId: integer('panel_id')
		.notNull()
		.references(() => panels.id, { onDelete: 'cascade' }),
	categoryId: integer('category_id')
		.notNull()
		.references(() => categories.id, { onDelete: 'cascade' }),
	label: text('label').notNull(),
	emoji: text('emoji'),
	style: text('style').default('primary').notNull(),
	position: integer('position').default(0).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const forms = pgTable('forms', {
	id: serial('id').primaryKey(),
	categoryId: integer('category_id')
		.notNull()
		.unique()
		.references(() => categories.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const formFields = pgTable('form_fields', {
	id: serial('id').primaryKey(),
	formId: integer('form_id')
		.notNull()
		.references(() => forms.id, { onDelete: 'cascade' }),
	label: text('label').notNull(),
	fieldType: text('field_type').notNull(),
	placeholder: text('placeholder'),
	isRequired: boolean('is_required').default(false).notNull(),
	minLength: integer('min_length'),
	maxLength: integer('max_length'),
	position: integer('position').default(0).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const formFieldOptions = pgTable('form_field_options', {
	id: serial('id').primaryKey(),
	fieldId: integer('field_id')
		.notNull()
		.references(() => formFields.id, { onDelete: 'cascade' }),
	label: text('label').notNull(),
	value: text('value').notNull(),
	position: integer('position').default(0).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const panelsRelations = relations(panels, ({ one, many }) => ({
	guild: one(guilds, { fields: [panels.guildId], references: [guilds.id] }),
	buttons: many(panelButtons),
}))

export const panelButtonsRelations = relations(panelButtons, ({ one }) => ({
	panel: one(panels, { fields: [panelButtons.panelId], references: [panels.id] }),
	category: one(categories, { fields: [panelButtons.categoryId], references: [categories.id] }),
}))

export const formsRelations = relations(forms, ({ one, many }) => ({
	category: one(categories, { fields: [forms.categoryId], references: [categories.id] }),
	fields: many(formFields),
}))

export const formFieldsRelations = relations(formFields, ({ one, many }) => ({
	form: one(forms, { fields: [formFields.formId], references: [forms.id] }),
	options: many(formFieldOptions),
}))

export const formFieldOptionsRelations = relations(formFieldOptions, ({ one }) => ({
	field: one(formFields, { fields: [formFieldOptions.fieldId], references: [formFields.id] }),
}))

export type Panel = typeof panels.$inferSelect
export type NewPanel = typeof panels.$inferInsert
export type PanelButton = typeof panelButtons.$inferSelect
export type NewPanelButton = typeof panelButtons.$inferInsert
export type Form = typeof forms.$inferSelect
export type NewForm = typeof forms.$inferInsert
export type FormField = typeof formFields.$inferSelect
export type NewFormField = typeof formFields.$inferInsert
