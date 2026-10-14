import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const env = {
  PORT: Number(required('PORT', '4000')),
  NODE_ENV: required('NODE_ENV', 'development'),
  DATABASE_PATH: required('DATABASE_PATH', './data/nexa.db'),
  JWT_SECRET: required('JWT_SECRET', 'dev-secret-nao-usar-em-producao'),
  JWT_EXPIRES_IN: required('JWT_EXPIRES_IN', '12h'),
  CORS_ORIGIN: required('CORS_ORIGIN', 'http://localhost:5173'),
  isProduction: () => env.NODE_ENV === 'production',
};
