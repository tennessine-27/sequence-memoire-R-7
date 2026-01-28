import { LevelConfig } from './types';

export const LEVELS: LevelConfig[] = [
  {
    id: 0,
    name: "TUTORIEL",
    difficulty: "TUTORIAL",
    lives: -1, // Infinite
    clue: "INITIALISATION DU NOYAU REUSSIE",
    pairs: [
      { left: "Astronaute", leftIcon: "fa-user-astronaut", right: "Fusée", rightIcon: "fa-rocket" },
      { left: "Réseau", leftIcon: "fa-network-wired", right: "Serveur", rightIcon: "fa-server" },
      { left: "Virus", leftIcon: "fa-virus", right: "Trojan", rightIcon: "fa-horse-head" },
      { left: "Lien", leftIcon: "fa-link", right: "Site", rightIcon: "fa-window-maximize" },
      { left: "Virtuel", leftIcon: "fa-vr-cardboard", right: "Réalité", rightIcon: "fa-glasses" },
      { left: "Pixel", leftIcon: "fa-border-all", right: "Image", rightIcon: "fa-image" },
      { left: "Galaxie", leftIcon: "fa-atom", right: "Étoile", rightIcon: "fa-star" }
    ]
  },
  {
    id: 1,
    name: "PARE-FEU PRIMAIRE",
    difficulty: "EASY",
    lives: 2,
    timeLimit: 45,
    clue: "PROTOCOLE NEXUS",
    pairs: [
      { left: "Cyborg", leftIcon: "fa-user-gear", right: "Transhumanisme", rightIcon: "fa-infinity" },
      { left: "Hologramme", leftIcon: "fa-cube", right: "Projection", rightIcon: "fa-video" },
      { left: "Login", leftIcon: "fa-user", right: "Pass", rightIcon: "fa-key" },
      { left: "Flux", leftIcon: "fa-wave-square", right: "Données", rightIcon: "fa-database" },
      { left: "Mémoire", leftIcon: "fa-memory", right: "Stockage", rightIcon: "fa-hard-drive" },
      { left: "Blackout", leftIcon: "fa-power-off", right: "Panne", rightIcon: "fa-triangle-exclamation" },
      { left: "Cortex", leftIcon: "fa-microchip", right: "Cerveau", rightIcon: "fa-brain" }
    ]
  },
  {
    id: 2,
    name: "CHIFFREMENT PROFOND",
    difficulty: "MEDIUM",
    lives: 2,
    clue: "06 AVRIL",
    timeLimit: 30,
    pairs: [
      { left: "Alien", leftIcon: "fa-user-secret", right: "Ovni", rightIcon: "fa-shuttle-space" },
      { left: "Laser", leftIcon: "fa-bolt", right: "Phaser", rightIcon: "fa-gun" },
      { left: "Robot", leftIcon: "fa-robot", right: "IA", rightIcon: "fa-brain" },
      { left: "Portail", leftIcon: "fa-dungeon", right: "Vortex", rightIcon: "fa-hurricane" },
      { left: "Clone", leftIcon: "fa-people-group", right: "ADN", rightIcon: "fa-dna" },
      { left: "Lune", leftIcon: "fa-moon", right: "Base", rightIcon: "fa-circle-dot" },
      { left: "Noyau", leftIcon: "fa-atom", right: "Coeur", rightIcon: "fa-heart" }
    ]
  },
  {
    id: 3,
    name: "INTRUSION SYSTÈME (ROOT)",
    difficulty: "HARD",
    lives: 2,
    timeLimit: 30,
    clue: "image://https://i.ibb.co/n8t3X6ss/54654654.png",
    pairs: [
      { left: "Terminal", leftIcon: "fa-terminal", right: "Root", rightIcon: "fa-code" },
      { left: "Androïde", leftIcon: "fa-robot", right: "Humain", rightIcon: "fa-person" },
      { left: "CPU", leftIcon: "fa-microchip", right: "Overclock", rightIcon: "fa-fire" },
      { left: "Mutation", leftIcon: "fa-biohazard", right: "Génome", rightIcon: "fa-dna" },
      { left: "Drone", leftIcon: "fa-plane-up", right: "Caméra", rightIcon: "fa-camera" },
      { left: "Biométrie", leftIcon: "fa-fingerprint", right: "Scan", rightIcon: "fa-expand" },
      { left: "Nano", leftIcon: "fa-vial", right: "Bot", rightIcon: "fa-spider" }
    ]
  }
];

export const SCRAMBLE_CHARS = "øX#_9µ£§∆∂∑∏πΩ@%&";