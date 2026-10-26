import type { Project } from './core/model';
export interface DesktopAPI {
  list(): Promise<Project[]>;
  importScore(instrument?: string): Promise<Project | null>;
  exercise(instrument?: string): Promise<Project>;
  save(project: Project): Promise<Project>;
  recognize(id: string): Promise<Project>;
  microphone(armed: boolean): Promise<void>;
  onAudioInterrupted(callback: () => void): () => void;
}
declare global {
  interface Window {
    desktop: DesktopAPI;
  }
}
