import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const menus = sqliteTable('menus', {
  saturday: text('saturday').primaryKey(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull().default(''),
});
export const excludedDishes = sqliteTable('excluded_dishes', { name: text('name').primaryKey() });

export const catalog = sqliteTable('catalog', {name:text('name').primaryKey(), category:text('category').notNull(), diet:text('diet').notNull(), updatedBy:text('updated_by').notNull().default(''), updatedAt:text('updated_at').notNull().default('')});
export const foodCategories = sqliteTable('food_categories', {id:text('id').primaryKey(), label:text('label').notNull()});
export const familyStatus = sqliteTable('family_status', {name:text('name').primaryKey(), saturday:text('saturday').notNull(), seenRevision:integer('seen_revision').notNull().default(-1), seenAt:text('seen_at').notNull().default(''), approvedRevision:integer('approved_revision').notNull().default(-1), approvedAt:text('approved_at').notNull().default('')});
export const activity = sqliteTable('activity', {id:text('id').primaryKey(), saturday:text('saturday').notNull(), actor:text('actor').notNull(), description:text('description').notNull(), createdAt:text('created_at').notNull()});
