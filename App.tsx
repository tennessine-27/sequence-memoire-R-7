import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, NodeItem, LevelConfig, Connection, SavedData } from './types';
import { LEVELS, SCRAMBLE_CHARS } from './constants';
import { audioService } from './services/audioService';
import MatrixRain from './components/MatrixRain';

// Helper to scrambled text based on progress
const getScrambledText = (target: string, progress: number) => {
  // If it's an image url, scramble a placeholder instead
  const textToScramble = target.startsWith('image://') ? "DONNÉES_VISUELLES_CRYPTÉES" : target;

  if (progress >= 1) return textToScramble;
  
  return textToScramble.split('').map((char, index) => {
    if (char === ' ' || char === '_') return char;
    if (Math.random() < progress) {
        return char;
    }
    return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
  }).join('');
};

const App: React.FC = () => {
  // State
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [currentLevelId, setCurrentLevelId] = useState(0);
  const [lives, setLives] = useState(2);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [unlockedClues, setUnlockedClues] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [errorNode, setErrorNode] = useState<string | null>(null);

  // Refs for Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  
  // Computed
  const currentLevelConfig = LEVELS.find(l => l.id === currentLevelId) || LEVELS[0];
  const isLevel3 = currentLevelConfig.id === 3;
  
  // Theme configuration
  const theme = isLevel3 ? {
    primary: 'text-rose-500',
    border: 'border-rose-500/50',
    bg: 'bg-rose-950/30',
    hoverBg: 'hover:bg-rose-900/40',
    ring: 'ring-rose-500',
    lineColor: '#f43f5e', // Rose-500
    glow: 'shadow-[0_0_15px_rgba(244,63,94,0.3)]',
    scrollbar: 'theme-red'
  } : {
    primary: 'text-cyan-400',
    border: 'border-cyan-500/50',
    bg: 'bg-cyan-950/30',
    hoverBg: 'hover:bg-cyan-900/40',
    ring: 'ring-cyan-400',
    lineColor: '#22d3ee', // Cyan-400
    glow: 'shadow-[0_0_15px_rgba(34,211,238,0.3)]',
    scrollbar: ''
  };

  // --- Initialization & Persistence ---

  useEffect(() => {
    // Load from local storage
    const saved = localStorage.getItem('cyberdeck_save');
    if (saved) {
      try {
        const parsed: SavedData = JSON.parse(saved);
        setCurrentLevelId(parsed.currentLevel);
        setUnlockedClues(parsed.unlockedClues);
      } catch (e) {
        console.error("Save file corrupted");
      }
    }
  }, []);

  const saveProgress = (levelId: number, clues: string[]) => {
    const data: SavedData = { currentLevel: levelId, unlockedClues: clues };
    localStorage.setItem('cyberdeck_save', JSON.stringify(data));
  };

  // --- Level Setup ---

  const startLevel = useCallback((levelId: number) => {
    const config = LEVELS.find(l => l.id === levelId);
    if (!config) return;

    // Generate Nodes
    const leftNodes: NodeItem[] = [];
    const rightNodes: NodeItem[] = [];

    // Limit to 7 pairs max per level rule
    const pairsToUse = config.pairs.slice(0, 7);

    pairsToUse.forEach((pair, idx) => {
      // Randomize IDs to prevent easy inspection cheating
      const idA = `L-${idx}-${Math.random().toString(36).substr(2, 5)}`;
      const idB = `R-${idx}-${Math.random().toString(36).substr(2, 5)}`;
      
      leftNodes.push({
        id: idA,
        icon: pair.leftIcon,
        label: pair.left,
        pairId: idB,
        side: 'left'
      });
      rightNodes.push({
        id: idB,
        icon: pair.rightIcon,
        label: pair.right,
        pairId: idA,
        side: 'right'
      });
    });

    // Shuffle right nodes
    const shuffledRight = [...rightNodes].sort(() => Math.random() - 0.5);

    setNodes([...leftNodes, ...shuffledRight]);
    setConnections([]);
    setLives(config.lives);
    setTimeLeft(config.timeLimit || null);
    setSelectedNode(null);
    setGameState(GameState.PLAYING);
  }, []);

  // --- Cheat Code ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.code === 'KeyL') {
        if (gameState === GameState.PLAYING) {
          completeLevel();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // --- Game Loop & Timer ---

  useEffect(() => {
    if (gameState !== GameState.PLAYING || timeLeft === null) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev !== null && prev <= 1) {
          clearInterval(timer);
          setGameState(GameState.GAME_OVER);
          audioService.playError();
          return 0;
        }
        if (prev !== null && prev <= 10) {
            audioService.playTick();
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  // --- Interaction Logic ---

  const handleNodeClick = (nodeId: string) => {
    if (gameState !== GameState.PLAYING) return;
    
    // Check if already connected
    if (connections.find(c => c.from === nodeId || c.to === nodeId)) return;

    audioService.playSelect();

    if (!selectedNode) {
      // First selection
      setSelectedNode(nodeId);
    } else {
      if (selectedNode === nodeId) {
        // Deselect
        setSelectedNode(null);
        return;
      }

      const nodeA = nodes.find(n => n.id === selectedNode);
      const nodeB = nodes.find(n => n.id === nodeId);

      if (!nodeA || !nodeB) return;

      if (nodeA.side === nodeB.side) {
        // Same side switch
        setSelectedNode(nodeId);
      } else {
        // Attempt connection
        validateConnection(nodeA, nodeB);
      }
    }
  };

  const validateConnection = (nodeA: NodeItem, nodeB: NodeItem) => {
    const isCorrect = nodeA.pairId === nodeB.id;

    if (isCorrect) {
      // Success
      audioService.playConnect();
      const newConnections = [...connections, { from: nodeA.id, to: nodeB.id, color: theme.lineColor }];
      setConnections(newConnections);
      setSelectedNode(null);

      // Check Level Completion
      if (newConnections.length === nodes.length / 2) {
        completeLevel();
      }

    } else {
      // Failure
      audioService.playError();
      setErrorNode(nodeB.id);
      
      setTimeout(() => setErrorNode(null), 500);

      if (currentLevelConfig.lives !== -1) {
        setLives(prev => {
          const newLives = prev - 1;
          if (newLives === 0) {
            setGameState(GameState.GAME_OVER);
          }
          return newLives;
        });
      }
      setSelectedNode(null);
    }
  };

  const completeLevel = useCallback(() => {
    audioService.playVictory();
    const clue = LEVELS.find(l => l.id === currentLevelId)?.clue || "";
    
    setUnlockedClues(prev => {
        if (!prev.includes(clue)) return [...prev, clue];
        return prev;
    });

    saveProgress(currentLevelId + 1, [...unlockedClues, clue]); 
    setGameState(GameState.TRANSITION);
  }, [currentLevelId, unlockedClues]);

  // --- Transition Logic ---
  
  const [transitionCount, setTransitionCount] = useState(5);
  
  useEffect(() => {
    if (gameState === GameState.TRANSITION) {
      setTransitionCount(5);
      const interval = setInterval(() => {
        setTransitionCount(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            if (currentLevelId === LEVELS.length - 1) {
              setGameState(GameState.VICTORY);
            } else {
              setCurrentLevelId(prevId => prevId + 1);
              setTimeout(() => {
                 startLevel(currentLevelId + 1);
              }, 0);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState, currentLevelId, startLevel]);


  // --- Canvas Drawing Logic ---

  const drawConnections = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw active connections
    connections.forEach(conn => {
      const elA = document.getElementById(`dot-${conn.from}`);
      const elB = document.getElementById(`dot-${conn.to}`);

      if (elA && elB) {
        const rectA = elA.getBoundingClientRect();
        const rectB = elB.getBoundingClientRect();

        const x1 = rectA.left + rectA.width / 2;
        const y1 = rectA.top + rectA.height / 2;
        const x2 = rectB.left + rectB.width / 2;
        const y2 = rectB.top + rectB.height / 2;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        
        // Neon Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = conn.color;
        
        ctx.strokeStyle = conn.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Reset shadow for next frame performance
        ctx.shadowBlur = 0;
      }
    });

    requestRef.current = requestAnimationFrame(drawConnections);
  }, [connections]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(drawConnections);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [drawConnections]);


  // --- Render Helpers ---

  const progress = connections.length / (nodes.length / 2 || 1);
  const scrambledClue = getScrambledText(currentLevelConfig.clue, progress);

  const renderClueContent = (clue: string, isList = false) => {
    if (clue.startsWith('image://')) {
      const url = clue.replace('image://', '');
      return (
        <div className={`mt-2 ${isList ? '' : 'w-full flex justify-center'}`}>
          <img 
            src={url} 
            alt="Donnée visuelle décryptée" 
            className={`border border-white/20 rounded shadow-lg ${isList ? 'h-20 w-auto' : 'max-w-full max-h-[40vh]'}`}
          />
        </div>
      );
    }
    return isList ? clue : (
        <p className="text-3xl md:text-5xl font-light text-white leading-relaxed font-mono" aria-live="polite">
            {clue}
        </p>
    );
  };

  // --- Screens ---

  if (gameState === GameState.MENU) {
    return (
      <div className={`w-full h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden text-center p-4 ${theme.scrollbar}`}>
        <div className="bg-grid" aria-hidden="true"></div>
        <div aria-hidden="true">
          <MatrixRain color="#22d3ee" />
        </div>
        <div className="scanlines" aria-hidden="true"></div>
        
        <div className={`relative z-10 p-6 md:p-10 border border-white/10 bg-black/50 backdrop-blur-sm rounded-lg shadow-2xl animate-fade-in w-full max-w-3xl`}>
          <h1 className={`text-4xl md:text-7xl font-bold mb-2 tracking-widest uppercase ${theme.primary} drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]`}>
            Séquence mémoire R-7
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-slate-400 font-light tracking-[0.2em]">MODÈLE : SÉRIE R</p>
          
          {/* INSTRUCTIONS SHELL - SIMPLIFIED */}
          <div className="w-full max-w-2xl mx-auto mb-12 text-left font-mono text-sm md:text-base relative group">
             {/* Decorative line */}
             <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent opacity-30 group-hover:opacity-100 transition-opacity"></div>
             
             <div className="text-slate-500 text-xs mb-3 tracking-[0.2em] uppercase border-b border-white/5 pb-2">
                // SYSTEM_INSTRUCTIONS.EXE
             </div>
             
             <div className="space-y-6">
               <div className="flex items-start">
                  <span className="text-cyan-500 min-w-[30px] font-bold mt-1" aria-hidden="true">01</span>
                  <span className="text-slate-300">
                     <div className="text-white font-bold tracking-wider mb-1">ACTION :</div>
                     <div className="lowercase">cliquez sur un élément à gauche, puis sur son association logique à droite pour les relier.</div>
                  </span>
               </div>
               <div className="flex items-start">
                  <span className="text-cyan-500 min-w-[30px] font-bold mt-1" aria-hidden="true">02</span>
                  <span className="text-slate-300">
                     <div className="text-white font-bold tracking-wider mb-1">TEMPS :</div>
                    <div className="lowercase"> <span className="text-cyan-400 font-bold">Limité</span> par niveau (sauf <span className="text-cyan-400 font-bold">Niveau 00 - Tutoriel</span>)</div>
                  </span>
               </div>
               <div className="flex items-start">
                  <span className="text-rose-500 min-w-[30px] font-bold mt-1" aria-hidden="true">03</span>
                  <span className="text-slate-300">
                     <div className="text-white font-bold tracking-wider mb-1">SÉCURITÉ :</div>
                     <div className="lowercase">droit à l'erreur limité. à la <span className="text-rose-400 font-bold">2ème erreur</span> par niveau, le système se verrouille définitivement.</div>
                  </span>
               </div>
             </div>
          </div>

          <button 
            onClick={() => startLevel(currentLevelId)}
            className={`
              relative px-12 py-5 text-xl md:text-2xl font-bold uppercase tracking-widest transition-all duration-300
              border-2 ${theme.border} ${theme.primary}
              hover:bg-cyan-500/10 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:scale-105
              focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-cyan-500
            `}
            aria-label={currentLevelId > 0 ? 'Reprendre la session' : 'Initialiser le noyau'}
          >
            {currentLevelId > 0 ? 'REPRENDRE LA SESSION' : 'INITIALISER LE NOYAU'}
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-current" aria-hidden="true"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-current" aria-hidden="true"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-current" aria-hidden="true"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-current" aria-hidden="true"></div>
          </button>
        </div>
      </div>
    );
  }

  if (gameState === GameState.TRANSITION) {
    return (
      <div className={`w-full h-screen bg-black flex flex-col items-center justify-center p-4 relative ${theme.scrollbar}`}>
        <div className="bg-grid" aria-hidden="true"></div>
        <div aria-hidden="true">
            <MatrixRain color={isLevel3 ? "#f43f5e" : "#22d3ee"} />
        </div>
        <div className="scanlines" aria-hidden="true"></div>
        <h2 className={`text-4xl md:text-6xl mb-8 font-bold animate-pulse ${theme.primary}`} role="status">CONNEXION ÉTABLIE</h2>
        
        <div className={`border ${theme.border} bg-black/60 backdrop-blur-md p-10 max-w-2xl rounded-sm shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10 text-center relative overflow-hidden`}>
           <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-${isLevel3 ? 'rose' : 'cyan'}-500 to-transparent opacity-50`}></div>
          <p className="text-sm uppercase mb-4 text-slate-400 tracking-widest">FRAGMENT DE DONNÉES DÉCRYPTÉ :</p>
          
          {renderClueContent(currentLevelConfig.clue)}
          
        </div>

        <div className="mt-12 text-center">
            <p className="text-xl mb-2 text-slate-400">TÉLÉCHARGEMENT VERS LE NOEUD SUIVANT...</p>
            <div className={`text-8xl font-bold ${theme.primary}`} aria-label={`Démarrage dans ${transitionCount} secondes`}>{transitionCount}</div>
        </div>
      </div>
    );
  }

  if (gameState === GameState.GAME_OVER) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center p-4 relative text-rose-500 theme-red overflow-y-auto">
        <div className="bg-grid" aria-hidden="true"></div>
        <div aria-hidden="true">
            <MatrixRain color="#f43f5e" />
        </div>
        <div className="scanlines" aria-hidden="true"></div>
        
        <div className="z-10 flex flex-col items-center max-w-4xl w-full my-auto">
            <h1 className="text-6xl md:text-7xl font-bold mb-4 tracking-tighter drop-shadow-[0_0_15px_rgba(244,63,94,0.6)] text-center" role="alert">ÉCHEC SYSTÈME</h1>
            <p className="text-xl md:text-2xl mb-8 text-rose-300 text-center">INTRUSION DÉTECTÉE. CONNEXION TERMINÉE.</p>
            
            {/* Lockout Message */}
            <div className="border border-rose-500/30 bg-rose-950/20 p-8 text-center max-w-md backdrop-blur-sm animate-pulse rounded mb-8">
                <div className="text-4xl mb-4" aria-hidden="true"><i className="fa-solid fa-lock"></i></div>
                <h3 className="text-xl font-bold tracking-widest mb-2">TERMINAL VERROUILLÉ</h3>
                <p className="text-sm text-rose-400/70 uppercase">
                    Protocole de sécurité activé. <br/>
                    Aucune nouvelle tentative autorisée.
                </p>
            </div>

            {/* Partial Data Log */}
            {unlockedClues.length > 0 && (
                <div className="text-left w-full max-w-2xl border border-rose-900/50 p-6 bg-black/50 rounded backdrop-blur-md">
                    <h3 className="text-rose-400 border-b border-rose-900/50 pb-2 mb-4 text-sm uppercase tracking-widest">
                        DONNÉES PARTIELLES RÉCUPÉRÉES :
                    </h3>
                    <ul className="space-y-4">
                        {unlockedClues.map((clue, i) => (
                            <li key={i} className="text-rose-200 font-mono text-lg flex flex-col sm:flex-row sm:items-center">
                                <span className="opacity-50 mr-4 font-bold text-rose-600 shrink-0" aria-hidden="true">0{i} //</span> 
                                <span className="break-all">{renderClueContent(clue, true)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
      </div>
    );
  }

  if (gameState === GameState.VICTORY) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center p-4 relative">
        <div className="bg-grid" aria-hidden="true"></div>
        <div className="scanlines" aria-hidden="true"></div>
        <div aria-hidden="true">
            <MatrixRain color="#22d3ee" />
        </div>
        <div className="z-10 bg-black/80 backdrop-blur-lg p-12 border border-cyan-500/50 rounded-xl shadow-[0_0_50px_rgba(34,211,238,0.2)] max-w-4xl w-full text-center">
          <h1 className="text-6xl md:text-8xl font-bold mb-6 text-cyan-400 tracking-tighter">PIRATAGE COMPLET</h1>
          <p className="text-2xl mb-10 text-slate-200">ACCÈS AUTORISÉ</p>
          
          <div className="text-left mb-8 border border-cyan-900/50 p-6 bg-black/50 rounded max-h-[50vh] overflow-y-auto" tabIndex={0} aria-label="Journal des données décryptées">
            <h3 className="text-cyan-400 border-b border-cyan-900/50 pb-2 mb-4 text-sm uppercase tracking-widest">JOURNAL DES DONNÉES :</h3>
            <ul className="space-y-4">
              {unlockedClues.map((clue, i) => (
                <li key={i} className="text-cyan-200 font-mono text-lg flex flex-col sm:flex-row sm:items-center">
                  <span className="opacity-50 mr-4 font-bold text-cyan-600 shrink-0" aria-hidden="true">0{i} //</span> 
                  <span className="break-all">{renderClueContent(clue, true)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="text-sm text-slate-500 uppercase mt-8 tracking-[0.3em]">Session Terminée. Fermeture du canal...</div>
        </div>
      </div>
    );
  }

  // GAME PLAYING SCREEN
  const leftNodes = nodes.filter(n => n.side === 'left');
  const rightNodes = nodes.filter(n => n.side === 'right');

  return (
    <div className={`w-full h-screen bg-black flex flex-col overflow-hidden relative ${theme.scrollbar}`}>
      <div className="bg-grid" aria-hidden="true"></div>
      <div aria-hidden="true">
        <MatrixRain color={isLevel3 ? "#f43f5e" : "#22d3ee"} />
      </div>
      <div className="scanlines" aria-hidden="true"></div>
      
      {/* Canvas Layer */}
      <canvas ref={canvasRef} className="absolute top-0 left-0 pointer-events-none z-10" aria-hidden="true" />

      {/* Timer Overlay (Background Art) */}
      {timeLeft !== null && (
        <div className="absolute top-24 left-0 right-0 md:right-72 bottom-0 flex items-center justify-center pointer-events-none z-0">
          <div 
            className={`text-[15rem] md:text-[25rem] font-bold ${isLevel3 ? 'text-rose-600' : 'text-slate-800'} opacity-10 animate-pulse select-none`}
            aria-hidden="true"
          >
            {timeLeft}
          </div>
        </div>
      )}

      {/* Header (Fixed) */}
      <header className={`relative z-30 h-24 border-b ${theme.border} bg-black/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 lg:px-12 shadow-lg`} role="banner">
        <div className="flex flex-col min-w-[100px]">
          <h2 className={`text-2xl md:text-3xl font-bold tracking-tighter ${theme.primary} drop-shadow-[0_0_5px_rgba(0,0,0,0.8)]`}>
            NIV 0{currentLevelId}
          </h2>
          <div className="text-[10px] md:text-xs text-slate-400 tracking-[0.2em] uppercase">{currentLevelConfig.name}</div>
        </div>
        
        <div className="flex flex-col items-center flex-1 mx-4 hidden md:flex">
            <div className={`
              w-full max-w-xl bg-black/40 border ${theme.border} rounded p-2 
              text-center text-xl font-mono tracking-widest break-all h-14 
              flex items-center justify-center overflow-hidden text-slate-200
              shadow-inner
            `} aria-label="Texte crypté" role="status">
              {scrambledClue}
            </div>
        </div>

        {/* Right side stats */}
        <div className="text-right flex flex-col items-end gap-1">
             {/* Visible Timer for RGAA/Clarity */}
            {timeLeft !== null && (
              <div className="flex items-center mb-1" role="timer" aria-label={`Temps restant : ${timeLeft} secondes`}>
                  <i className="fa-regular fa-clock mr-2 text-slate-400 text-sm"></i>
                  <span className={`text-2xl font-mono font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : theme.primary}`}>
                    {timeLeft}s
                  </span>
              </div>
            )}

            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest hidden sm:block">INTÉGRITÉ SYSTÈME</span>
              <div className={`flex text-lg ${theme.primary}`} aria-label={`${lives} vies restantes`}>
                {currentLevelConfig.lives === -1 ? (
                  <i className="fa-solid fa-infinity" title="Vies illimitées"></i>
                ) : (
                  Array.from({length: 2}).map((_, i) => (
                    <i key={i} className={`fa-solid fa-heart ml-1 drop-shadow-md ${i < lives ? '' : 'opacity-20 text-slate-600'}`} aria-hidden="true"></i>
                  ))
                )}
              </div>
            </div>
        </div>
      </header>

      {/* Container for Game Content + Sidebar */}
      <div className="flex-1 flex overflow-hidden relative z-20">
        
        {/* Main Game Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth" role="main">
          {/* Reduced padding for mobile to fix responsiveness */}
          <main className="min-h-full flex items-start justify-between px-2 sm:px-6 md:px-24 py-8 md:py-12 max-w-7xl mx-auto">
            
            {/* Left Column */}
            <div className="flex flex-col space-y-4 md:space-y-6 w-[45%] md:w-1/4">
              {leftNodes.map(node => {
                const isSelected = selectedNode === node.id;
                const isConnected = connections.find(c => c.from === node.id);
                return (
                  <button
                    id={node.id}
                    key={node.id}
                    onClick={() => handleNodeClick(node.id)}
                    disabled={!!isConnected}
                    aria-label={`Sélectionner ${node.label}`}
                    aria-pressed={isSelected}
                    className={`
                      relative group flex items-center justify-between p-3 md:p-5 border
                      transition-all duration-200 ease-out outline-none rounded-sm overflow-hidden
                      backdrop-blur-sm w-full min-h-[3.5rem]
                      focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cyan-500
                      ${isConnected 
                        ? `${theme.border} bg-black/40 opacity-40 grayscale` 
                        : `border-slate-700 bg-black/60 hover:border-slate-500 hover:scale-[1.02] ${theme.hoverBg} cursor-pointer`
                      }
                      ${isSelected ? `ring-1 ${theme.ring} ${theme.border} ${theme.bg} ${theme.glow}` : ''}
                      ${errorNode === node.id ? 'bg-rose-500/20 border-rose-500 animate-shake' : ''}
                    `}
                  >
                     {/* Tech corner accents */}
                    <div className="absolute top-0 left-0 w-1 h-1 bg-current opacity-50" aria-hidden="true"></div>
                    <div className="absolute bottom-0 right-0 w-1 h-1 bg-current opacity-50" aria-hidden="true"></div>

                    <i className={`fa-solid ${node.icon} text-lg md:text-2xl w-6 md:w-8 text-center shrink-0 ${isSelected || isConnected ? theme.primary : 'text-slate-400 group-hover:text-slate-200'}`} aria-hidden="true"></i>
                    
                    {/* Responsive text handling: Allow wrap, adjust size */}
                    <span className={`
                        block font-medium uppercase tracking-wider ml-2 md:ml-4 
                        text-xs sm:text-sm md:text-base whitespace-normal break-words text-left
                        ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-white'}
                    `}>
                        {node.label}
                    </span>
                    
                    {/* Connector Dot */}
                    <div 
                      id={`dot-${node.id}`}
                      className={`
                        absolute -right-1.5 top-1/2 -translate-y-1/2 w-2 h-2 md:w-3 md:h-3 rounded-full 
                        border border-current bg-black z-20 transition-colors
                        ${isConnected ? theme.primary : 'border-slate-600 group-hover:border-white'}
                        ${isSelected ? `bg-current ${theme.glow}` : ''}
                      `}
                      aria-hidden="true"
                    ></div>
                  </button>
                );
              })}
            </div>

            {/* Right Column */}
            <div className="flex flex-col space-y-4 md:space-y-6 w-[45%] md:w-1/4 text-right">
              {rightNodes.map(node => {
                const isSelected = selectedNode === node.id;
                const isConnected = connections.find(c => c.to === node.id);
                return (
                  <button
                    id={node.id}
                    key={node.id}
                    onClick={() => handleNodeClick(node.id)}
                    disabled={!!isConnected}
                    aria-label={`Connecter à ${node.label}`}
                    aria-pressed={isSelected}
                    className={`
                      relative group flex items-center justify-between flex-row-reverse p-3 md:p-5 border
                      transition-all duration-200 ease-out outline-none rounded-sm overflow-hidden
                      backdrop-blur-sm w-full min-h-[3.5rem]
                      focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cyan-500
                      ${isConnected 
                        ? `${theme.border} bg-black/40 opacity-40 grayscale` 
                        : `border-slate-700 bg-black/60 hover:border-slate-500 hover:scale-[1.02] ${theme.hoverBg} cursor-pointer`
                      }
                      ${isSelected ? `ring-1 ${theme.ring} ${theme.border} ${theme.bg} ${theme.glow}` : ''}
                      ${errorNode === node.id ? 'bg-rose-500/20 border-rose-500 animate-shake' : ''}
                    `}
                  >
                     {/* Tech corner accents */}
                     <div className="absolute top-0 right-0 w-1 h-1 bg-current opacity-50" aria-hidden="true"></div>
                     <div className="absolute bottom-0 left-0 w-1 h-1 bg-current opacity-50" aria-hidden="true"></div>

                    <i className={`fa-solid ${node.icon} text-lg md:text-2xl w-6 md:w-8 text-center shrink-0 ${isSelected || isConnected ? theme.primary : 'text-slate-400 group-hover:text-slate-200'}`} aria-hidden="true"></i>
                    
                    {/* Responsive text handling */}
                    <span className={`
                        block font-medium uppercase tracking-wider mr-2 md:mr-4 
                        text-xs sm:text-sm md:text-base whitespace-normal break-words text-right
                        ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-white'}
                    `}>
                        {node.label}
                    </span>
                    
                    {/* Connector Dot */}
                    <div 
                      id={`dot-${node.id}`}
                      className={`
                        absolute -left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 md:w-3 md:h-3 rounded-full 
                        border border-current bg-black z-20 transition-colors
                        ${isConnected ? theme.primary : 'border-slate-600 group-hover:border-white'}
                        ${isSelected ? `bg-current ${theme.glow}` : ''}
                      `}
                      aria-hidden="true"
                    ></div>
                  </button>
                );
              })}
            </div>

          </main>
        </div>

        {/* Sidebar / Data Stream */}
        <aside className={`
          absolute md:relative top-0 right-0 h-full w-72 bg-black/90 backdrop-blur-xl border-l ${theme.border} z-40 transform transition-transform duration-300
          ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `} aria-label="Flux de données latéral">
          <div className="p-6 h-full overflow-y-auto">
              <h3 className={`text-lg font-bold border-b ${theme.border} pb-4 mb-6 tracking-widest ${theme.primary} flex items-center`}>
                <i className="fa-solid fa-server mr-3" aria-hidden="true"></i>
                FLUX DE DONNÉES
              </h3>
              <div className="space-y-3">
                {unlockedClues.length === 0 ? (
                  <div className="text-sm opacity-30 italic font-mono p-4 border border-dashed border-slate-700 text-center">
                    EN ATTENTE DE SYNCHRONISATION...
                  </div>
                ) : (
                  unlockedClues.map((clue, idx) => (
                    <div key={idx} className={`text-xs border ${theme.border} bg-white/5 p-3 rounded-sm relative overflow-hidden group hover:bg-white/10 transition-colors`} tabIndex={0} role="article" aria-label={`Fragment ${idx + 1} décrypté`}>
                      <div className={`font-bold mb-1 opacity-50 font-mono ${theme.primary}`} aria-hidden="true">FRAGMENT_0{idx}</div>
                      <div className="text-slate-300 leading-relaxed">
                        {renderClueContent(clue, true)}
                      </div>
                      <div className={`absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-100 transition-opacity ${theme.primary}`} aria-hidden="true">
                        <i className="fa-solid fa-check"></i>
                      </div>
                    </div>
                  ))
                )}
              </div>
          </div>
        </aside>

      </div>

      {/* Sidebar Toggle (Mobile) */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`absolute bottom-6 right-6 z-50 md:hidden p-4 rounded-full border ${theme.border} bg-black/80 ${theme.primary} shadow-lg backdrop-blur focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500`}
        aria-label={isSidebarOpen ? "Fermer le flux de données" : "Afficher le flux de données"}
        aria-expanded={isSidebarOpen}
      >
        <i className={`fa-solid ${isSidebarOpen ? 'fa-xmark' : 'fa-database'}`} aria-hidden="true"></i>
      </button>

    </div>
  );
};

export default App;