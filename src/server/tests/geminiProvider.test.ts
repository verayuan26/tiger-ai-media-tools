import { writeFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  createGeminiProvider,
  normalizeGeminiBaseUrl,
  pingGeminiProvider,
  transcribeAudioWithGemini
} from '../ai/geminiProvider';

const config = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  apiKey: 'test-key',
  visionModel: 'gemini-2.0-flash',
  transcribeModel: 'gemini-2.0-flash'
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeGeminiBaseUrl', () => {
  it('appends /v1beta when missing', () => {
    expect(normalizeGeminiBaseUrl('https://generativelanguage.googleapis.com')).toBe(
      'https://generativelanguage.googleapis.com/v1beta'
    );
  });

  it('keeps existing /v1beta suffix', () => {
    expect(normalizeGeminiBaseUrl('https://proxy.example.com/v1beta')).toBe(
      'https://proxy.example.com/v1beta'
    );
  });
});

describe('pingGeminiProvider', () => {
  it('calls Gemini models list with API key header', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await pingGeminiProvider(config);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'x-goog-api-key': 'test-key' })
      })
    );
  });
});

describe('createGeminiProvider', () => {
  it('parses vision tags from generateContent JSON', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'gemini-vision-'));
    const imagePath = path.join(tempDir, 'frame.jpg');
    writeFileSync(imagePath, 'fake-image');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      tags: [{ displayName: '工厂', confidence: 0.9 }]
                    })
                  }
                ]
              }
            }
          ]
        })
      )
    );

    try {
      const provider = createGeminiProvider(config);
      const result = await provider.analyzeImage({ imagePath });

      expect(result.tags).toEqual([{ displayName: '工厂', confidence: 0.9 }]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('transcribeAudioWithGemini', () => {
  it('parses transcript JSON from generateContent', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'gemini-audio-'));
    const audioPath = path.join(tempDir, 'audio.wav');
    writeFileSync(audioPath, 'fake-audio');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({ text: '你好世界', language: 'zh' })
                  }
                ]
              }
            }
          ]
        })
      )
    );

    try {
      const result = await transcribeAudioWithGemini(config, { audioPath });

      expect(result.segments[0]).toMatchObject({
        text: '你好世界',
        language: 'zh'
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
