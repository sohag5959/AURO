export interface TabItem {
  id: string;
  url: string;
  title: string;
  subject: string;
  isActive: boolean;
}

export interface Note {
  id: string;
  content: string;
  timestamp: number;
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export interface VocabularyWord {
  id: string;
  word: string;
  meaning: string;
  example?: string;
}

export type ViewMode = 'dashboard' | 'browser' | 'settings';
export type SidebarTool = 'notes' | 'todo' | 'ai' | 'calculator' | 'vocab' | 'citations' | 'tasks' | 'toolkit';

export type SettingsCategory = 
  | 'you' 
  | 'autofill' 
  | 'privacy' 
  | 'appearance' 
  | 'search' 
  | 'startup' 
  | 'languages' 
  | 'downloads' 
  | 'accessibility' 
  | 'system' 
  | 'reset' 
  | 'about';
