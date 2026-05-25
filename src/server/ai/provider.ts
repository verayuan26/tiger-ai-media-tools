export interface VisualTagResult {
  displayName: string;
  confidence: number;
}

export interface ImageAnalysisResult {
  tags: VisualTagResult[];
}

export interface TranscriptResult {
  segments: Array<{
    startSeconds: number;
    endSeconds: number;
    language: string;
    text: string;
    translation: string | null;
  }>;
}

export interface AiProvider {
  analyzeImage(input: { imagePath: string }): Promise<ImageAnalysisResult>;
  transcribeAudio(input: { audioPath: string }): Promise<TranscriptResult>;
}
