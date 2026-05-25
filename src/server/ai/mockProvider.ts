import path from 'node:path';
import type { AiProvider, ImageAnalysisResult, TranscriptResult } from './provider';

export function createMockAiProvider(): AiProvider {
  return {
    async analyzeImage({ imagePath }) {
      return analyzeMockImage(imagePath);
    },
    async transcribeAudio({ audioPath }) {
      return transcribeMockAudio(audioPath);
    }
  };
}

function analyzeMockImage(imagePath: string): ImageAnalysisResult {
  const fileName = path.basename(imagePath).toLowerCase();

  if (fileName.includes('cutting') || fileName.includes('cut')) {
    return {
      tags: [
        { displayName: '裁剪布料', confidence: 0.88 },
        { displayName: '牛仔布', confidence: 0.82 }
      ]
    };
  }

  if (fileName.includes('sewing')) {
    return {
      tags: [
        { displayName: '缝纫机', confidence: 0.87 },
        { displayName: '人物', confidence: 0.76 }
      ]
    };
  }

  return {
    tags: [{ displayName: '素材', confidence: 0.5 }]
  };
}

function transcribeMockAudio(audioPath: string): TranscriptResult {
  const fileName = path.basename(audioPath).toLowerCase();

  if (fileName.includes('ru')) {
    return {
      segments: [
        {
          startSeconds: 0,
          endSeconds: 4,
          language: 'ru',
          text: 'Пример разговора о ткани',
          translation: '关于面料的示例谈话'
        }
      ]
    };
  }

  return {
    segments: [
      {
        startSeconds: 0,
        endSeconds: 3,
        language: 'zh',
        text: '这是一段关于面料的示例谈话',
        translation: null
      }
    ]
  };
}
