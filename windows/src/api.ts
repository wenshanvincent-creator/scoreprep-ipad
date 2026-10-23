import type { Project } from './core/model';
export interface WorkerSettings {
  url: string;
  hasToken: boolean;
}
export interface DesktopAPI {
  list(): Promise<Project[]>;
  importScore(): Promise<Project | null>;
  exercise(): Promise<Project>;
  save(project: Project): Promise<Project>;
  settings(): Promise<WorkerSettings>;
  saveSettings(url: string, token: string): Promise<WorkerSettings>;
  recognize(id: string, submit: boolean): Promise<Project>;
  review(id: string, accept: boolean): Promise<Project>;
  microphone(armed: boolean): Promise<void>;
  onAudioInterrupted(callback: () => void): () => void;
}
declare global {
  interface Window {
    desktop: DesktopAPI;
  }
}
