import dotenv from 'dotenv';
import { ConfigurationError } from '../core/errors.js';

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

export type EnvMode = 'development' | 'test' | 'production';

export interface Environment {
  PORT: number;
  NODE_ENV: EnvMode;
  LLM_API_KEY: string | undefined;
  LLM_API_URL: string | undefined;
}

export function validateEnvironment(): Environment {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const NODE_ENV = (process.env.NODE_ENV || 'development') as EnvMode;

  if (isNaN(PORT)) {
    throw new ConfigurationError("PORT must be a valid number");
  }

  const LLM_API_KEY = process.env.LLM_API_KEY;
  const LLM_API_URL = process.env.LLM_API_URL;

  if (NODE_ENV === 'production') {
    if (!LLM_API_KEY) {
      throw new ConfigurationError("LLM_API_KEY is required in production");
    }
  }

  return { PORT, NODE_ENV, LLM_API_KEY, LLM_API_URL };
}

// Typed configuration access
export const env = validateEnvironment();
