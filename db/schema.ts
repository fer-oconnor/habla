import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const learners = sqliteTable('learners', {
  id: text('id').primaryKey(), state: text('state').notNull(),
  revision: integer('revision').notNull().default(0),
  writeToken: text('write_token').notNull().default(''), updatedAt: text('updated_at').notNull(),
});
export const attempts = sqliteTable('attempts', {
  id: integer('id').primaryKey(), userId: text('user_id').notNull().references(() => learners.id),
  lessonId: integer('lesson_id'), status: text('status').notNull(), data: text('data').notNull(), updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_attempts_user_status_lesson').on(table.userId, table.status, table.lessonId)]);
