export interface Project {
  id: string;
  title: string;
  sourceFilename: string;
  pageCount: number;
  mediaType: string;
  originalSHA256: string;
  systems: unknown[];
  sections: unknown[];
  readingOrder: unknown[];
  pendingRecognition?: unknown;
  recognizedEdition?: unknown;
  updatedAt: string;
  instrument?: string;
  localRecognition?: {
    state: 'queued' | 'running' | 'ready' | 'failed';
    phase: string;
    error?: string;
  };
  localEdition?: {
    musicXML: string;
    engine: string;
    engineVersion: string;
    originalSHA256: string;
    recognizedAt: string;
  };
}
export function validateProject(p: Project) {
  if (
    !p.id ||
    typeof p.title !== 'string' ||
    p.title.length > 500 ||
    !Number.isInteger(p.pageCount) ||
    p.pageCount < 1 ||
    p.pageCount > 20 ||
    !['application/pdf', 'image/png', 'image/jpeg'].includes(p.mediaType) ||
    !/^[a-f0-9]{64}$/.test(p.originalSHA256)
  )
    throw new Error('乐谱项目信息无效。');
}
