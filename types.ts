export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  TRANSITION = 'TRANSITION', // The 10s wait screen
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export interface NodeItem {
  id: string;
  icon: string; // FontAwesome class
  label: string; // For ARIA and logic
  pairId: string; // The ID of the node it connects to
  side: 'left' | 'right';
}

export interface LevelConfig {
  id: number;
  name: string;
  difficulty: 'TUTORIAL' | 'EASY' | 'MEDIUM' | 'HARD';
  lives: number; // -1 for infinite
  pairs: Array<{ left: string; leftIcon: string; right: string; rightIcon: string }>;
  clue: string;
  timeLimit?: number; // In seconds, optional
}

export interface Connection {
  from: string; // Node ID
  to: string; // Node ID
  color: string;
}

export interface SavedData {
  currentLevel: number;
  unlockedClues: string[];
}