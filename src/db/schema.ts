import { pgTable, uuid, text, timestamp, boolean, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  
  id: uuid('id').primaryKey().defaultRandom(),
  
  
  username: text('username').notNull().unique(), 
  
  
  email: text('email').notNull().unique(), 
  
  
  display_name: text('display_name'), 
  
  
  bio: text('bio'), 
  
  
  created_at: timestamp('created_at').defaultNow().notNull(),
});