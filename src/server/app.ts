import path from 'node:path';
import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
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

  const allowedOrigins = createAllowedLocalOrigins(config.port);

  app.use(createLocalCorsMiddleware(allowedOrigins));
  app.use('/api', createApiMutationGuard(allowedOrigins));
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', createApiRouter({ repos, aiProvider, dataDir: config.dataDir, enableDevRoutes: config.enableDevRoutes }));
  app.use('/api', createApiNotFoundHandler());
  app.use('/media/frames', express.static(path.join(config.dataDir, 'frames')));
  app.use(express.static(path.resolve('dist/client')));
  app.use(jsonErrorHandler);

  return app;
}

function createAllowedLocalOrigins(port: number): Set<string> {
  return new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    'http://127.0.0.1:5173',
    'http://localhost:5173'
  ]);
}

function createLocalCorsMiddleware(allowedOrigins: Set<string>) {
  return cors({
    origin(origin, callback) {
      callback(null, !origin || isAllowedLocalOrigin(origin, allowedOrigins) ? origin : false);
    }
  });
}

function createApiMutationGuard(allowedOrigins: Set<string>): RequestHandler {
  return (req, res, next) => {
    if (!isMutatingMethod(req.method)) {
      next();
      return;
    }

    const origin = req.get('Origin');
    if (origin && !isAllowedLocalOrigin(origin, allowedOrigins)) {
      res.status(403).json({ error: { message: 'Forbidden origin' } });
      return;
    }

    if (requiresJsonContentType(req.method, req.get('Content-Type'), req.get('Content-Length'))) {
      res.status(415).json({ error: { message: 'JSON request body required' } });
      return;
    }

    next();
  };
}

function createApiNotFoundHandler(): RequestHandler {
  return (_req, _res, next) => {
    next(new HttpError(404, 'Not found'));
  };
}

function isAllowedLocalOrigin(origin: string, allowedOrigins: Set<string>): boolean {
  return allowedOrigins.has(origin);
}

function isMutatingMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function requiresJsonContentType(method: string, contentType: string | undefined, contentLength: string | undefined) {
  if (contentType && isJsonContentType(contentType)) return false;
  if (contentType) return true;

  if (method === 'POST') return Boolean(contentLength && contentLength !== '0');

  return Boolean(contentLength && contentLength !== '0');
}

function isJsonContentType(contentType: string): boolean {
  return /^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i.test(contentType);
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

  if (isStatusBearingParserError(error)) {
    const status = getClientErrorStatus(error);

    if (status === 400 && error.type === 'entity.parse.failed') {
      res.status(400).json({ error: { message: 'Invalid JSON body' } });
      return;
    }

    if (status === 413 && error.type === 'entity.too.large') {
      res.status(413).json({ error: { message: 'Request body too large' } });
      return;
    }

    res.status(status).json({ error: { message: 'Invalid request body' } });
    return;
  }

  console.error(error);
  res.status(500).json({ error: { message: 'Internal server error' } });
};

function isStatusBearingParserError(error: unknown): error is { status?: number; statusCode?: number; type?: string } {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as { status?: unknown; statusCode?: unknown; type?: unknown };
  const status = maybeError.status ?? maybeError.statusCode;

  return (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    (maybeError.type === undefined || typeof maybeError.type === 'string')
  );
}

function getClientErrorStatus(error: { status?: number; statusCode?: number }): number {
  return error.status ?? error.statusCode ?? 400;
}
