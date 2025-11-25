
import * as dotenv from 'dotenv'; 
import { defineConfig } from 'drizzle-kit';

dotenv.config({ path: './frontend/.env.local' }); 

export default defineConfig({
  
  schema: './src/db/schema.ts', 

  out: './drizzle',             
  
  dialect: 'postgresql',
  dbCredentials: {
    
    url: process.env.DATABASE_URL!
  },
  verbose: true,
  strict: true,
});