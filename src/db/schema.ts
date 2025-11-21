import { pgTable, uuid, text, timestamp, boolean, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  
  id: uuid('id').primaryKey().defaultRandom(),
  
  
  username: text('username').notNull().unique(), 
  
  
  email: text('email').notNull().unique(), 
  
  
  display_name: text('display_name'), 
  
  
  bio: text('bio'), 
  
  
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  setting_key: text('setting_key').notNull().unique(), 
  
  default_value: text('default_value').notNull(), 
  
  description: text('description'),
});