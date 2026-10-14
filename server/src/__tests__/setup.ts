import { config } from 'dotenv';
import { resolve } from 'node:path';

// Carrega .env.test antes dos módulos do servidor serem importados
config({ path: resolve(__dirname, '../.env.test') });
