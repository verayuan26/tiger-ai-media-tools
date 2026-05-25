import path from 'node:path';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { createMockAiProvider } from './ai/mockProvider';
import { createOpenAiCompatibleProvider } from './ai/openAiCompatibleProvider';
import { createApiRouter, HttpError } from './api/routes';
import { loadConfig, type ConfigOverrides } from './config';
import { openDatabase } from './db/connection';
import { createRepositories } from './db/repositories';

export function createApp(overrides: ConfigOverrides = {}) {
  const config = loadConfig(overrides);
  const db = openDatabase(path.join(config.dataDir, 'library.sqlite'));
  const repos = createRepositories(db);
  const aiProvider =
    config.aiProviderName === 'openai-compatible'
      ? createOpenAiCompatibleProvider({
          baseUrl: config.openAiBaseUrl,
          apiKey: config.openAiApiKey,
          visionModel: config.openAiVisionModel,
          transcribeModel: config.openAiTranscribeModel
        })
      : createMockAiProvider();

  const app = express();
  app.locals.config = config;
  app.locals.db = db;
  app.locals.repos = repos;

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', createApiRouter({ repos, aiProvider, dataDir: config.dataDir }));
  app.use('/media', express.static(config.dataDir));
  app.use(express.static(path.resolve('dist/client')));
  app.use(jsonErrorHandler);

  return app;
}

const jsonErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        message: 'Invalid request',
        issues: error.issues
      }
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: { message: error.message } });
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  res.status(500).json({ error: { message } });
};
