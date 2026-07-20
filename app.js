/* ==========================================================================
   CHESS 2.0 - MAIN APPLICATION LOGIC
   ========================================================================== */

// --- Global Constants & Configurations ---
const PIECE_NAMES = {
  'p': 'Pawn', 'n': 'Knight', 'b': 'Bishop', 'r': 'Rook', 'q': 'Queen', 'k': 'King'
};

// SVG assets from Lichess CDN
const LICHESS_PIECE_CDN = 'https://lichess1.org/assets/piece/cburnett';

// --- Sound Effects Synthesizer (Web Audio API) ---
const ChessAudio = {
  ctx: null,
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  playMove() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  },
  playCapture() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  },
  playCheck() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [now, now + 0.07].forEach((time, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(index === 0 ? 380 : 480, time);
      
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.linearRampToValueAtTime(0.01, time + 0.06);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(time);
      osc.stop(time + 0.06);
    });
  }
};

// --- Offline AI Engine: Minimax Alpha-Beta Fallback ---
const MinimaxAI = (() => {
  // Piece-Square tables for positional evaluation
  const pawnEval = [
    [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
    [5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0],
    [1.0,  1.0,  2.0,  3.0,  3.0,  2.0,  1.0,  1.0],
    [0.5,  0.5,  1.0,  2.5,  2.5,  1.0,  0.5,  0.5],
    [0.0,  0.0,  0.0,  2.0,  2.0,  0.0,  0.0,  0.0],
    [0.5, -0.5, -1.0,  0.0,  0.0, -1.0, -0.5,  0.5],
    [0.5,  1.0,  1.0, -2.0, -2.0,  1.0,  1.0,  0.5],
    [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0]
  ];
  const knightEval = [
    [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0],
    [-4.0, -2.0,  0.0,  0.0,  0.0,  0.0, -2.0, -4.0],
    [-3.0,  0.0,  1.0,  1.5,  1.5,  1.0,  0.0, -3.0],
    [-3.0,  0.5,  1.5,  2.0,  2.0,  1.5,  0.5, -3.0],
    [-3.0,  0.0,  1.5,  2.0,  2.0,  1.5,  0.0, -3.0],
    [-3.0,  0.5,  1.0,  1.5,  1.5,  1.0,  0.5, -3.0],
    [-4.0, -2.0,  0.0,  0.5,  0.5,  0.0, -2.0, -4.0],
    [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0]
  ];
  const bishopEval = [
    [-2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0],
    [-1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0],
    [-1.0,  0.0,  0.5,  1.0,  1.0,  0.5,  0.0, -1.0],
    [-1.0,  0.5,  0.5,  1.0,  1.0,  0.5,  0.5, -1.0],
    [-1.0,  0.0,  1.0,  1.0,  1.0,  1.0,  0.0, -1.0],
    [-1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0, -1.0],
    [-1.0,  0.5,  0.0,  0.0,  0.0,  0.0,  0.5, -1.0],
    [-2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0]
  ];
  const rookEval = [
    [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
    [0.5,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [0.0,  0.0,  0.0,  0.5,  0.5,  0.0,  0.0,  0.0]
  ];
  const queenEval = [
    [-2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0],
    [-1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0],
    [-1.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0],
    [-0.5,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5],
    [0.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5],
    [-1.0,  0.5,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0],
    [-1.0,  0.0,  0.5,  0.0,  0.0,  0.5,  0.0, -1.0],
    [-2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0]
  ];
  const kingEvalWhite = [
    [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [-2.0, -3.0, -3.0, -4.0, -4.0, -3.0, -3.0, -2.0],
    [-1.0, -2.0, -2.0, -2.0, -2.0, -2.0, -2.0, -1.0],
    [2.0,  2.0,  0.0,  0.0,  0.0,  0.0,  2.0,  2.0],
    [2.0,  3.0,  1.0,  0.0,  0.0,  1.0,  3.0,  2.0]
  ];
  const kingEvalBlack = [...kingEvalWhite].reverse();

  function getPieceValue(piece, r, c) {
    if (!piece) return 0;
    
    let score = 0;
    const type = piece.type;
    
    if (type === 'p') {
      score = 10 + (piece.color === 'w' ? pawnEval[r][c] : pawnEval[7 - r][c]);
    } else if (type === 'n') {
      score = 30 + knightEval[r][c];
    } else if (type === 'b') {
      score = 30 + bishopEval[r][c];
    } else if (type === 'r') {
      score = 50 + rookEval[r][c];
    } else if (type === 'q') {
      score = 90 + queenEval[r][c];
    } else if (type === 'k') {
      score = 900 + (piece.color === 'w' ? kingEvalWhite[r][c] : kingEvalBlack[r][c]);
    }
    
    return piece.color === 'w' ? score : -score;
  }

  function evaluateBoard(board) {
    let totalEvaluation = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        totalEvaluation += getPieceValue(board[r][c], r, c);
      }
    }
    return totalEvaluation;
  }

  function minimax(chess, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || chess.game_over()) {
      return { value: evaluateBoard(chess.board()) };
    }

    const moves = chess.moves({ verbose: true });
    // Sort moves: Captures and promotions first for faster alpha-beta cuts
    moves.sort((a, b) => {
      let sa = 0, sb = 0;
      if (a.captured) sa += 10;
      if (b.captured) sb += 10;
      if (a.promotion) sa += 50;
      if (b.promotion) sb += 50;
      return sb - sa;
    });

    let bestMove = null;

    if (isMaximizing) {
      let maxVal = -Infinity;
      for (let move of moves) {
        chess.move(move);
        const evaluation = minimax(chess, depth - 1, alpha, beta, false).value;
        chess.undo();
        if (evaluation > maxVal) {
          maxVal = evaluation;
          bestMove = move;
        }
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return { value: maxVal, move: bestMove };
    } else {
      let minVal = Infinity;
      for (let move of moves) {
        chess.move(move);
        const evaluation = minimax(chess, depth - 1, alpha, beta, true).value;
        chess.undo();
        if (evaluation < minVal) {
          minVal = evaluation;
          bestMove = move;
        }
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return { value: minVal, move: bestMove };
    }
  }

  return {
    getBestMove(chess, difficulty) {
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) return null;

      if (difficulty === 'beginner') {
        // 80% random, 20% shallow minimax
        if (Math.random() < 0.8) {
          return moves[Math.floor(Math.random() * moves.length)];
        }
        return minimax(chess, 1, -Infinity, Infinity, chess.turn() === 'w').move;
      }

      if (difficulty === 'intermediate') {
        // Depth 2 minimax
        return minimax(chess, 2, -Infinity, Infinity, chess.turn() === 'w').move;
      }

      // Master / Grandmaster fallback (Depth 3)
      return minimax(chess, 3, -Infinity, Infinity, chess.turn() === 'w').move;
    }
  };
})();

// --- Stockfish Web Worker wrapper ---
class StockfishEngine {
  constructor() {
    this.worker = null;
    this.onBestMoveCallback = null;
    this.isReady = false;
    this.isFallback = false;
    this.init();
  }

  init() {
    try {
      // Create a blob worker to load Stockfish.js from cdnjs cross-origin without CORS issues
      const blobCode = `importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');`;
      const blob = new Blob([blobCode], { type: 'application/javascript' });
      const workerURL = URL.createObjectURL(blob);
      this.worker = new Worker(workerURL);
      
      this.worker.onmessage = (e) => {
        const line = e.data;
        if (line === 'readyok') {
          this.isReady = true;
          console.log('Stockfish CDN engine is ready.');
        } else if (line.startsWith('bestmove')) {
          const parts = line.split(' ');
          const moveStr = parts[1]; // e.g. "e2e4" or "e7e8q"
          if (moveStr && moveStr !== '(none)') {
            const from = moveStr.substring(0, 2);
            const to = moveStr.substring(2, 4);
            const promotion = moveStr.length > 4 ? moveStr.charAt(4) : null;
            if (this.onBestMoveCallback) {
              this.onBestMoveCallback({ from, to, promotion });
            }
          }
        }
      };

      this.worker.postMessage('uci');
      this.worker.postMessage('isready');
    } catch (err) {
      console.warn('Failed to load Stockfish CDN Web Worker. Fallback Minimax AI active.', err);
      this.isFallback = true;
    }
  }

  getBestMove(fen, level, callback) {
    if (this.isFallback || !this.isReady) {
      // Worker failed, call custom minimax fallback
      const mockChess = new Chess(fen);
      const move = MinimaxAI.getBestMove(mockChess, level);
      setTimeout(() => {
        callback(move);
      }, 400);
      return;
    }

    this.onBestMoveCallback = callback;

    let skill = 0;
    let depth = 1;
    let movetime = 100;

    // Difficulty settings
    if (level === 'beginner') {
      skill = 0;
      depth = 1;
      movetime = 100;
    } else if (level === 'intermediate') {
      skill = 6;
      depth = 5;
      movetime = 300;
    } else if (level === 'master') {
      skill = 14;
      depth = 10;
      movetime = 800;
    } else if (level === 'grandmaster') {
      // True Grandmaster (Max level, deeper depth)
      skill = 20;
      depth = 18;
      movetime = 1800;
    }

    this.worker.postMessage(`setoption name Skill Level value ${skill}`);
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${depth} movetime ${movetime}`);
  }
}

// --- Application State Controller ---
const App = {
  // Game state variables
  userId: '',
  playerName: 'Anonymous Knight',
  gameMode: 'bot', // 'bot' | 'local' | 'online'
  botLevel: 'beginner',
  playerColor: 'w', // 'w' | 'b' (in local, 'w'; in online, assigned by DB)
  
  // Game logic
  chess: new Chess(),
  stockfish: null,
  boardFlipped: false,
  gameActive: false,
  
  // Drag and Drop state
  isDragging: false,
  draggedPieceElement: null,
  draggedPieceSquare: null,
  draggedPieceLegalMoves: [],
  boardRect: null,
  
  // Selection state (for click to move)
  selectedSquare: null,
  
  // Game Timer state
  clocks: {
    w: 600, // 10 minutes in seconds
    b: 600
  },
  timerInterval: null,
  
  // Firebase database state
  db: null,
  roomId: null,
  onlineRole: null, // 'white' | 'black' | 'spectator'
  roomRef: null,
  isFirebaseInitialized: false,
  
  // Pending move for promotions
  pendingMove: null,

  // Dom caches
  dom: {},

  init() {
    this.cacheDomElements();
    this.loadUserData();
    this.setupListeners();
    this.stockfish = new StockfishEngine();
    
    // Auto join room if in URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const queryRoomId = urlParams.get('roomid');
    
    // Try to auto-connect to Firebase
    this.initializeFirebase().then((success) => {
      if (success && queryRoomId) {
        this.joinOnlineRoom(queryRoomId.toUpperCase());
      }
    });
    
    this.drawBoard();
  },

  cacheDomElements() {
    this.dom.themeSelect = document.getElementById('theme-select');
    this.dom.btnConfigDb = document.getElementById('btn-config-db');
    this.dom.connectionBadge = document.getElementById('connection-badge');
    
    // Views
    this.dom.menuView = document.getElementById('menu-view');
    this.dom.arenaView = document.getElementById('arena-view');
    
    // Arena elements
    this.dom.board = document.getElementById('chessboard');
    this.dom.opponentName = document.getElementById('opponent-name');
    this.dom.opponentRole = document.getElementById('opponent-badge');
    this.dom.opponentTimer = document.getElementById('opponent-timer');
    this.dom.opponentCaptures = document.getElementById('opponent-captures');
    
    this.dom.playerName = document.getElementById('player-name');
    this.dom.playerRole = document.getElementById('player-badge');
    this.dom.playerTimer = document.getElementById('player-timer');
    this.dom.playerCaptures = document.getElementById('player-captures');
    
    this.dom.opponentColorDot = document.getElementById('opponent-color-dot');
    this.dom.playerColorDot = document.getElementById('player-color-dot');

    this.dom.statusLabel = document.getElementById('game-status-label');
    this.dom.roomDisplayId = document.getElementById('room-display-id');
    this.dom.statusMessage = document.getElementById('game-status-message');
    
    // Online sharing
    this.dom.sharePanel = document.getElementById('online-share-panel');
    this.dom.shareLinkInput = document.getElementById('share-link-input');
    this.dom.btnCopyLink = document.getElementById('btn-copy-link');
    
    // Chat panel
    this.dom.chatPanel = document.getElementById('chat-panel');
    this.dom.chatMessagesBox = document.getElementById('chat-messages-box');
    this.dom.chatInput = document.getElementById('chat-input');
    this.dom.btnSendChat = document.getElementById('btn-send-chat');
    
    // History Table
    this.dom.movesTbody = document.getElementById('moves-tbody');
    this.dom.movesContainer = document.getElementById('moves-log-container');
    
    // Buttons
    this.dom.btnFlip = document.getElementById('btn-flip');
    this.dom.btnDraw = document.getElementById('btn-draw');
    this.dom.btnResign = document.getElementById('btn-resign');
    this.dom.btnRematch = document.getElementById('btn-rematch');
    this.dom.btnExit = document.getElementById('btn-exit');
    
    // Modals
    this.dom.modalName = document.getElementById('modal-name-prompt');
    this.dom.inputName = document.getElementById('player-display-name-input');
    this.dom.btnSaveName = document.getElementById('btn-save-display-name');
    
    this.dom.modalPromo = document.getElementById('modal-promotion');
    
    this.dom.modalGameOver = document.getElementById('modal-gameover');
    this.dom.gameoverTitle = document.getElementById('gameover-title');
    this.dom.gameoverReason = document.getElementById('gameover-reason');
    this.dom.btnGameoverRematch = document.getElementById('btn-gameover-rematch');
    this.dom.btnGameoverMenu = document.getElementById('btn-gameover-menu');
    
    this.dom.modalConfig = document.getElementById('modal-firebase-config');
    this.dom.textareaConfig = document.getElementById('fb-config-json');
    this.dom.btnSaveConfig = document.getElementById('btn-save-fb-config');
    this.dom.btnClearConfig = document.getElementById('btn-clear-fb-config');
    this.dom.btnCloseConfig = document.getElementById('btn-close-fb-config');
  },

  loadUserData() {
    // Generate/Load Unique User ID
    let storedUid = localStorage.getItem('chess2_uid');
    if (!storedUid) {
      storedUid = 'user_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('chess2_uid', storedUid);
    }
    this.userId = storedUid;

    // Load Player Name
    const storedName = localStorage.getItem('chess2_name');
    if (storedName) {
      this.playerName = storedName;
    } else {
      // Force user name input
      this.dom.modalName.classList.add('active');
    }
  },

  async initializeFirebase() {
    try {
      // Try to load custom local config first
      let fbConfig = null;
      const customConfig = localStorage.getItem('firebaseConfig');
      if (customConfig) {
        fbConfig = JSON.parse(customConfig);
      } else {
        // Try to fetch from serverless config
        const response = await fetch('/api/config');
        if (response.ok) {
          fbConfig = await response.json();
        }
      }

      if (fbConfig && fbConfig.apiKey && fbConfig.databaseURL) {
        // Initialize Firebase
        if (firebase.apps.length === 0) {
          firebase.initializeApp(fbConfig);
        }
        this.db = firebase.database();
        this.isFirebaseInitialized = true;
        this.dom.connectionBadge.className = 'connection-badge online';
        this.dom.connectionBadge.querySelector('.badge-text').innerText = 'Firebase Connected';
        console.log('Firebase connected.');
        return true;
      }
    } catch (e) {
      console.warn('Firebase connection failed, running in local-only mode:', e);
    }
    
    this.dom.connectionBadge.className = 'connection-badge offline';
    this.dom.connectionBadge.querySelector('.badge-text').innerText = 'Firebase Disconnected';
    return false;
  },

  setupListeners() {
    // Theme Selector
    this.dom.themeSelect.addEventListener('change', (e) => {
      document.body.className = 'theme-' + e.target.value;
    });

    // DB config triggers
    this.dom.btnConfigDb.addEventListener('click', () => {
      const currentConfig = localStorage.getItem('firebaseConfig');
      this.dom.textareaConfig.value = currentConfig ? currentConfig : '';
      this.dom.modalConfig.classList.add('active');
    });

    this.dom.btnCloseConfig.addEventListener('click', () => {
      this.dom.modalConfig.classList.remove('active');
    });

    this.dom.btnSaveConfig.addEventListener('click', () => {
      try {
        const json = JSON.parse(this.dom.textareaConfig.value);
        localStorage.setItem('firebaseConfig', JSON.stringify(json));
        this.dom.modalConfig.classList.remove('active');
        // Reload to initialize connection
        window.location.reload();
      } catch (err) {
        alert('Invalid JSON object structure. Copy your configuration from the Firebase console.');
      }
    });

    this.dom.btnClearConfig.addEventListener('click', () => {
      localStorage.removeItem('firebaseConfig');
      this.dom.modalConfig.classList.remove('active');
      window.location.reload();
    });

    // Save Display Name
    this.dom.btnSaveName.addEventListener('click', () => {
      const name = this.dom.inputName.value.trim();
      if (name.length >= 2) {
        this.playerName = name;
        localStorage.setItem('chess2_name', name);
        this.dom.modalName.classList.remove('active');
      } else {
        alert('Please enter a valid nickname (min 2 chars).');
      }
    });

    // Start local / bot games
    document.querySelectorAll('.btn-start-game').forEach(button => {
      button.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        this.startGameMode(mode);
      });
    });

    // Difficulty Button select
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.botLevel = e.target.dataset.level;
      });
    });

    // Navigation and in-game controls
    this.dom.btnFlip.addEventListener('click', () => {
      this.boardFlipped = !this.boardFlipped;
      this.drawBoard();
    });

    this.dom.btnExit.addEventListener('click', () => {
      this.exitToMenu();
    });

    this.dom.btnResign.addEventListener('click', () => {
      if (confirm('Are you sure you want to resign the game?')) {
        this.handleResign();
      }
    });

    this.dom.btnDraw.addEventListener('click', () => {
      this.handleDrawOffer();
    });

    this.dom.btnRematch.addEventListener('click', () => {
      this.handleRematchOffer();
    });

    // Modal Gameover buttons
    this.dom.btnGameoverMenu.addEventListener('click', () => {
      this.dom.modalGameOver.classList.remove('active');
      this.exitToMenu();
    });

    this.dom.btnGameoverRematch.addEventListener('click', () => {
      this.dom.modalGameOver.classList.remove('active');
      this.handleRematchOffer();
    });

    // Create / Join Room
    document.getElementById('btn-create-room').addEventListener('click', () => {
      this.createOnlineRoom();
    });

    document.getElementById('btn-join-room').addEventListener('click', () => {
      const codeInput = document.getElementById('input-room-id').value.trim().toUpperCase();
      if (codeInput.length > 3) {
        this.joinOnlineRoom(codeInput);
      } else {
        alert('Enter a valid 6-8 digit Room ID.');
      }
    });

    this.dom.btnCopyLink.addEventListener('click', () => {
      this.dom.shareLinkInput.select();
      document.execCommand('copy');
      const oldTxt = this.dom.btnCopyLink.innerText;
      this.dom.btnCopyLink.innerText = 'Copied!';
      setTimeout(() => {
        this.dom.btnCopyLink.innerText = oldTxt;
      }, 1500);
    });

    // Chat sending
    this.dom.btnSendChat.addEventListener('click', () => {
      this.sendChatMessage();
    });
    this.dom.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendChatMessage();
      }
    });

    // Promotion piece choice click
    document.querySelectorAll('.promo-choice').forEach(choice => {
      choice.addEventListener('click', (e) => {
        const piece = e.currentTarget.dataset.piece;
        this.completePawnPromotion(piece);
      });
    });

    // Global drag & drop event handling
    window.addEventListener('mousemove', (e) => this.dragMove(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.dragMove(e), { passive: false });
    
    window.addEventListener('mouseup', (e) => this.dragEnd(e));
    window.addEventListener('touchend', (e) => this.dragEnd(e));
  },

  // --- Views Controller ---
  showView(viewName) {
    document.querySelectorAll('.view-panel').forEach(view => {
      view.classList.remove('active');
    });
    if (viewName === 'menu') {
      this.dom.menuView.classList.add('active');
    } else if (viewName === 'arena') {
      this.dom.arenaView.classList.add('active');
    }
  },

  startGameMode(mode) {
    this.gameMode = mode;
    this.chess = new Chess();
    this.gameActive = true;
    this.boardFlipped = false;
    this.selectedSquare = null;
    this.clocks = { w: 600, b: 600 };
    
    // Hide online panels by default
    this.dom.sharePanel.classList.add('hidden');
    this.dom.chatPanel.classList.add('hidden');
    this.dom.roomDisplayId.classList.add('hidden');
    this.dom.btnRematch.classList.add('hidden');
    
    this.dom.btnResign.disabled = false;
    this.dom.btnDraw.disabled = false;
    
    // Setup Players Info Cards
    if (mode === 'bot') {
      this.playerColor = 'w';
      this.dom.playerName.innerText = this.playerName;
      this.dom.playerRole.innerText = 'You';
      
      this.dom.opponentName.innerText = `Stockfish (${this.botLevel.charAt(0).toUpperCase() + this.botLevel.slice(1)})`;
      this.dom.opponentRole.innerText = 'Bot';
      
      this.dom.statusLabel.innerText = 'Vs Computer';
      this.dom.statusMessage.innerText = 'Your Turn';
      
      this.dom.opponentColorDot.innerText = '⚫';
      this.dom.playerColorDot.innerText = '⚪';
    } else if (mode === 'local') {
      this.playerColor = 'w'; // White starts
      this.dom.playerName.innerText = 'White Player';
      this.dom.playerRole.innerText = 'Local';
      
      this.dom.opponentName.innerText = 'Black Player';
      this.dom.opponentRole.innerText = 'Local';
      
      this.dom.statusLabel.innerText = 'Local Pass & Play';
      this.dom.statusMessage.innerText = "White's Turn";
      
      this.dom.opponentColorDot.innerText = '⚫';
      this.dom.playerColorDot.innerText = '⚪';
    }
    
    this.drawBoard();
    this.clearMovesLog();
    this.updateCapturedPool();
    this.startClocks();
    this.showView('arena');
  },

  exitToMenu() {
    this.gameActive = false;
    this.stopClocks();
    this.clearActiveOnlineRoomListeners();
    this.showView('menu');
    // Clear URL queries
    window.history.pushState({}, document.title, window.location.pathname);
  },

  // --- Core Board Drawing ---
  drawBoard() {
    this.dom.board.innerHTML = '';
    const boardState = this.chess.board();
    const isFlipped = this.boardFlipped;
    
    // Find check state
    let kingInCheckSquare = null;
    if (this.chess.in_check()) {
      // Find current turn's king position
      const turnColor = this.chess.turn();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = boardState[r][c];
          if (p && p.type === 'k' && p.color === turnColor) {
            kingInCheckSquare = this.colRowToSquare(c, r);
            break;
          }
        }
      }
    }
    
    // Find last move square codes
    let lastMoveFrom = null;
    let lastMoveTo = null;
    const history = this.chess.history({ verbose: true });
    if (history.length > 0) {
      const last = history[history.length - 1];
      lastMoveFrom = last.from;
      lastMoveTo = last.to;
    }

    // Build the squares
    for (let displayRow = 0; displayRow < 8; displayRow++) {
      for (let displayCol = 0; displayCol < 8; displayCol++) {
        const r = isFlipped ? 7 - displayRow : displayRow;
        const c = isFlipped ? 7 - displayCol : displayCol;
        
        const squareName = this.colRowToSquare(c, r);
        const squareColorClass = (r + c) % 2 === 0 ? 'light' : 'dark';
        
        const squareDiv = document.createElement('div');
        squareDiv.className = `board-square ${squareColorClass}`;
        squareDiv.dataset.square = squareName;
        
        // Highlight logic
        if (kingInCheckSquare === squareName) {
          squareDiv.classList.add('check-square');
        } else if (squareName === lastMoveFrom || squareName === lastMoveTo) {
          squareDiv.classList.add('last-move-square');
        }
        
        if (this.selectedSquare === squareName) {
          squareDiv.classList.add('selected-square');
        }

        // Draw Coordinate labels in corners of outer squares
        if (displayRow === 7) {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'coordinate coord-file';
          fileLabel.innerText = String.fromCharCode(97 + c);
          squareDiv.appendChild(fileLabel);
        }
        if (displayCol === 0) {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'coordinate coord-rank';
          rankLabel.innerText = (8 - r).toString();
          squareDiv.appendChild(rankLabel);
        }

        // Append square
        this.dom.board.appendChild(squareDiv);
      }
    }

    // Draw Pieces absolute overlay
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardState[r][c];
        if (piece) {
          const squareName = this.colRowToSquare(c, r);
          const pieceImg = document.createElement('img');
          pieceImg.src = `${LICHESS_PIECE_CDN}/${piece.color}${piece.type.toUpperCase()}.svg`;
          pieceImg.className = `chess-piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`;
          pieceImg.dataset.square = squareName;
          
          // Absolute Position Calculations
          const leftPercent = isFlipped ? (7 - c) * 12.5 : c * 12.5;
          const topPercent = isFlipped ? (7 - r) * 12.5 : r * 12.5;
          pieceImg.style.left = leftPercent + '%';
          pieceImg.style.top = topPercent + '%';
          
          // Touch/mouse inputs
          pieceImg.addEventListener('mousedown', (e) => this.dragStart(e));
          pieceImg.addEventListener('touchstart', (e) => this.dragStart(e), { passive: false });
          pieceImg.addEventListener('click', (e) => this.handlePieceClick(e));
          
          this.dom.board.appendChild(pieceImg);
        }
      }
    }
    
    // Add Click handler on squares for click-to-move destinations
    document.querySelectorAll('.board-square').forEach(sq => {
      sq.addEventListener('click', (e) => this.handleSquareClick(e));
    });
  },

  colRowToSquare(c, r) {
    return `${String.fromCharCode(97 + c)}${8 - r}`;
  },

  squareToColRow(square) {
    const col = square.charCodeAt(0) - 97;
    const row = 8 - parseInt(square.charAt(1));
    return { col, row };
  },

  // --- Click to Move Mechanics ---
  handlePieceClick(e) {
    e.stopPropagation(); // Avoid double triggering on square underneath
    if (!this.gameActive) return;
    if (!this.isMyTurn()) return;
    
    const clickedSquare = e.target.dataset.square;
    const clickedPieceColor = this.chess.get(clickedSquare).color;
    
    if (clickedPieceColor === this.chess.turn()) {
      // Selecting our own piece
      this.selectedSquare = clickedSquare;
      this.draggedPieceLegalMoves = this.chess.moves({ square: clickedSquare, verbose: true });
      
      this.drawBoard();
      this.drawLegalMoveIndicators();
    } else {
      // Capturing click
      if (this.selectedSquare) {
        this.attemptMove(this.selectedSquare, clickedSquare);
      }
    }
  },

  handleSquareClick(e) {
    if (!this.gameActive) return;
    if (!this.isMyTurn()) return;
    
    const clickedSquare = e.currentTarget.dataset.square;
    
    if (this.selectedSquare) {
      this.attemptMove(this.selectedSquare, clickedSquare);
    }
  },

  drawLegalMoveIndicators() {
    this.draggedPieceLegalMoves.forEach(move => {
      const sqEl = document.querySelector(`.board-square[data-square="${move.to}"]`);
      if (sqEl) {
        const pieceExists = this.chess.get(move.to);
        if (pieceExists) {
          // Capturing dot (ring overlay)
          const ring = document.createElement('div');
          ring.className = 'move-dest-ring';
          sqEl.appendChild(ring);
        } else {
          // standard moving dot
          const dot = document.createElement('div');
          dot.className = 'move-dest-dot';
          sqEl.appendChild(dot);
        }
      }
    });
  },

  // --- Drag and Drop Logic ---
  dragStart(e) {
    if (!this.gameActive) return;
    if (!this.isMyTurn()) return;
    
    // Prevent default scroll on touch
    if (e.type === 'touchstart') {
      e.preventDefault();
    }
    
    const target = e.target;
    const square = target.dataset.square;
    const piece = this.chess.get(square);
    
    if (!piece || piece.color !== this.chess.turn()) return;
    
    this.isDragging = true;
    this.draggedPieceElement = target;
    this.draggedPieceSquare = square;
    
    this.draggedPieceLegalMoves = this.chess.moves({ square: square, verbose: true });
    
    // Highlight visuals
    this.selectedSquare = square;
    this.drawBoard();
    this.drawLegalMoveIndicators();
    
    this.draggedPieceElement.classList.add('dragging');
    this.boardRect = this.dom.board.getBoundingClientRect();
    
    this.positionPieceAtCursor(e);
  },

  dragMove(e) {
    if (!this.isDragging) return;
    
    if (e.cancelable) {
      e.preventDefault(); // Stop mobile page elastic scroll
    }
    
    this.positionPieceAtCursor(e);
  },

  dragEnd(e) {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.draggedPieceElement.classList.remove('dragging');
    
    const clientX = e.type.startsWith('touch') ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.changedTouches[0].clientY : e.clientY;
    
    const x = clientX - this.boardRect.left;
    const y = clientY - this.boardRect.top;
    
    let col = Math.floor(x / (this.boardRect.width / 8));
    let row = Math.floor(y / (this.boardRect.height / 8));
    
    if (this.boardFlipped) {
      col = 7 - col;
      row = 7 - row;
    }
    
    let dropSuccess = false;
    
    if (col >= 0 && col < 8 && row >= 0 && row < 8) {
      const destSquare = this.colRowToSquare(col, row);
      const isLegal = this.draggedPieceLegalMoves.some(m => m.to === destSquare);
      
      if (isLegal) {
        this.attemptMove(this.draggedPieceSquare, destSquare);
        dropSuccess = true;
      }
    }
    
    if (!dropSuccess) {
      // Snaps piece back
      this.drawBoard();
    }
  },

  positionPieceAtCursor(e) {
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - this.boardRect.left;
    const y = clientY - this.boardRect.top;
    
    const size = this.boardRect.width;
    const halfWidth = size / 16;
    
    const leftPx = x - halfWidth;
    const topPx = y - halfWidth;
    
    this.draggedPieceElement.style.left = leftPx + 'px';
    this.draggedPieceElement.style.top = topPx + 'px';
  },

  // --- Move Execution Wrapper ---
  attemptMove(from, to) {
    // Check if promotion is needed
    const moves = this.chess.moves({ square: from, verbose: true });
    const move = moves.find(m => m.to === to);
    
    if (move && move.promotion) {
      // Show promotion modal
      this.pendingMove = { from, to };
      this.dom.modalPromo.classList.add('active');
    } else {
      this.executeMove({ from, to });
    }
  },

  completePawnPromotion(pieceType) {
    this.dom.modalPromo.classList.remove('active');
    if (this.pendingMove) {
      this.executeMove({
        from: this.pendingMove.from,
        to: this.pendingMove.to,
        promotion: pieceType
      });
      this.pendingMove = null;
    }
  },

  executeMove(moveObj) {
    const isCapture = this.chess.get(moveObj.to) !== null || (this.chess.get(moveObj.from)?.type === 'p' && moveObj.to.charAt(0) !== moveObj.from.charAt(0) && this.chess.get(moveObj.to) === null); // handles en passant
    
    const result = this.chess.move(moveObj);
    if (!result) return;
    
    // Play sounds
    if (this.chess.in_check()) {
      ChessAudio.playCheck();
    } else if (isCapture) {
      ChessAudio.playCapture();
    } else {
      ChessAudio.playMove();
    }

    this.selectedSquare = null;
    
    // Sync state
    if (this.gameMode === 'online') {
      this.syncOnlineGameState();
    } else {
      // Local or bot updates
      this.drawBoard();
      this.updateMovesLog();
      this.updateCapturedPool();
      
      const gameOver = this.checkGameOver();
      if (!gameOver && this.gameMode === 'bot' && this.chess.turn() !== this.playerColor) {
        // Trigger computer turn
        this.triggerBotTurn();
      }
    }
  },

  triggerBotTurn() {
    this.dom.statusMessage.innerText = 'Computer is thinking...';
    const currentFen = this.chess.fen();
    
    this.stockfish.getBestMove(currentFen, this.botLevel, (move) => {
      if (!this.gameActive || this.chess.fen() !== currentFen) return;
      
      this.executeMove(move);
      this.dom.statusMessage.innerText = 'Your Turn';
    });
  },

  // --- Clock Timers ---
  startClocks() {
    this.stopClocks();
    this.updateClockDisplays();
    
    this.timerInterval = setInterval(() => {
      if (!this.gameActive) return;
      
      const turn = this.chess.turn();
      
      if (this.gameMode === 'online') {
        // In online mode, we only count down locally if it's our active turn
        if (this.isMyTurn()) {
          this.clocks[turn]--;
          if (this.clocks[turn] <= 0) {
            this.clocks[turn] = 0;
            this.handleTimeout(turn);
          }
          // Periodic sync of clocks to database to prevent drift (every 5s)
          if (this.clocks[turn] % 5 === 0) {
            this.roomRef.child('gameState/clocks').update({
              white: this.clocks.w,
              black: this.clocks.b
            });
          }
        } else {
          // If opponent's turn, count down locally too for visual feedback
          this.clocks[turn]--;
          if (this.clocks[turn] <= 0) this.clocks[turn] = 0;
        }
      } else {
        // Bot or local pass-and-play
        this.clocks[turn]--;
        if (this.clocks[turn] <= 0) {
          this.clocks[turn] = 0;
          this.handleTimeout(turn);
        }
      }
      
      this.updateClockDisplays();
    }, 1000);
  },

  stopClocks() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  updateClockDisplays() {
    this.dom.playerTimer.innerText = this.formatTime(this.playerColor === 'w' ? this.clocks.w : this.clocks.b);
    this.dom.opponentTimer.innerText = this.formatTime(this.playerColor === 'w' ? this.clocks.b : this.clocks.w);
    
    // Add flashing alerts for low times (30 seconds)
    if (this.clocks.w < 30) this.dom.playerTimer.classList.add('low-time');
    else this.dom.playerTimer.classList.remove('low-time');
    
    if (this.clocks.b < 30) this.dom.opponentTimer.classList.add('low-time');
    else this.dom.opponentTimer.classList.remove('low-time');
  },

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  handleTimeout(color) {
    this.gameActive = false;
    this.stopClocks();
    
    const loser = color === 'w' ? 'White' : 'Black';
    const reason = `${loser} ran out of time!`;
    const title = this.gameMode === 'online'
      ? (color === this.playerColor ? 'Defeat!' : 'Victory!')
      : `${color === 'w' ? 'Black' : 'White'} Wins`;
      
    if (this.gameMode === 'online') {
      this.roomRef.child('gameState').update({
        status: 'timeout',
        winner: color === 'w' ? 'b' : 'w'
      });
    } else {
      this.announceGameOver(title, reason);
    }
  },

  // --- Capture Pool Tracking ---
  updateCapturedPool() {
    const startingCounts = {
      wP: 8, wN: 2, wB: 2, wR: 2, wQ: 1,
      bP: 8, bN: 2, bB: 2, bR: 2, bQ: 1
    };
    
    const activeCounts = {
      wP: 0, wN: 0, wB: 0, wR: 0, wQ: 0,
      bP: 0, bN: 0, bB: 0, bR: 0, bQ: 0
    };
    
    // Count active pieces
    this.chess.board().forEach(row => {
      row.forEach(p => {
        if (p && p.type !== 'k') {
          const key = `${p.color}${p.type.toUpperCase()}`;
          activeCounts[key]++;
        }
      });
    });

    // Clear pools
    this.dom.playerCaptures.innerHTML = '';
    this.dom.opponentCaptures.innerHTML = '';
    
    // Render captured pieces
    // White's captured pool shows Black pieces captured by White
    // Black's captured pool shows White pieces captured by Black
    const colors = ['w', 'b'];
    colors.forEach(col => {
      const targetDom = (col === this.playerColor) ? this.dom.playerCaptures : this.dom.opponentCaptures;
      const enemyCol = col === 'w' ? 'b' : 'w';
      
      const piecesTypes = ['P', 'N', 'B', 'R', 'Q'];
      piecesTypes.forEach(type => {
        const pieceKey = `${enemyCol}${type}`;
        const capturedAmount = startingCounts[pieceKey] - activeCounts[pieceKey];
        
        for (let i = 0; i < capturedAmount; i++) {
          const img = document.createElement('img');
          img.src = `${LICHESS_PIECE_CDN}/${pieceKey}.svg`;
          img.className = 'captured-img';
          img.alt = PIECE_NAMES[type.toLowerCase()];
          targetDom.appendChild(img);
        }
      });
    });
  },

  // --- Moves Log UI Panel ---
  updateMovesLog() {
    const moves = this.chess.history({ verbose: true });
    this.dom.movesTbody.innerHTML = '';
    
    for (let i = 0; i < moves.length; i += 2) {
      const moveIndex = Math.floor(i / 2) + 1;
      const whiteMove = moves[i] ? moves[i].san : '';
      const blackMove = moves[i+1] ? moves[i+1].san : '';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${moveIndex}</td>
        <td class="move-cell" data-move-idx="${i}">${whiteMove}</td>
        <td class="move-cell" data-move-idx="${i+1}">${blackMove}</td>
      `;
      this.dom.movesTbody.appendChild(tr);
    }
    
    // Auto scroll bottom
    this.dom.movesContainer.scrollTop = this.dom.movesContainer.scrollHeight;
  },

  clearMovesLog() {
    this.dom.movesTbody.innerHTML = '';
  },

  // --- Game Over Determinations ---
  checkGameOver() {
    if (!this.gameActive) return true;
    
    let reason = '';
    let winnerTitle = '';
    let isGameOver = false;

    if (this.chess.in_checkmate()) {
      isGameOver = true;
      const loser = this.chess.turn() === 'w' ? 'White' : 'Black';
      reason = `Checkmate! ${loser} is defeated.`;
      
      if (this.gameMode === 'bot') {
        winnerTitle = this.chess.turn() === this.playerColor ? 'Defeat!' : 'Victory!';
      } else if (this.gameMode === 'online') {
        winnerTitle = this.chess.turn() === this.playerColor ? 'Defeat!' : 'Victory!';
      } else {
        winnerTitle = `${this.chess.turn() === 'w' ? 'Black' : 'White'} Wins`;
      }
    } else if (this.chess.in_stalemate()) {
      isGameOver = true;
      reason = 'Draw by Stalemate';
      winnerTitle = 'Draw';
    } else if (this.chess.in_threefold_repetition()) {
      isGameOver = true;
      reason = 'Draw by Threefold Repetition';
      winnerTitle = 'Draw';
    } else if (this.chess.insufficient_material()) {
      isGameOver = true;
      reason = 'Draw by Insufficient Material';
      winnerTitle = 'Draw';
    } else if (this.chess.in_draw()) {
      isGameOver = true;
      reason = 'Draw by 50-move rule / Stalemate';
      winnerTitle = 'Draw';
    }

    if (isGameOver) {
      this.gameActive = false;
      this.stopClocks();
      
      if (this.gameMode === 'online') {
        // In online mode, we push results to database instead of direct popups
        this.roomRef.child('gameState').update({
          status: winnerTitle === 'Draw' ? 'draw' : 'checkmate',
          winner: this.chess.turn() === 'w' ? 'b' : 'w',
          reason: reason
        });
      } else {
        this.announceGameOver(winnerTitle, reason);
      }
      return true;
    }
    return false;
  },

  announceGameOver(title, reason) {
    this.dom.gameoverTitle.innerText = title;
    this.dom.gameoverReason.innerText = reason;
    this.dom.modalGameOver.classList.add('active');
    this.dom.btnResign.disabled = true;
    this.dom.btnDraw.disabled = true;
  },

  handleResign() {
    this.gameActive = false;
    this.stopClocks();
    
    if (this.gameMode === 'online') {
      this.roomRef.child('gameState').update({
        status: 'resigned',
        winner: this.playerColor === 'w' ? 'b' : 'w'
      });
    } else {
      const loser = this.gameMode === 'local' ? (this.chess.turn() === 'w' ? 'White' : 'Black') : 'You';
      const winner = this.gameMode === 'local' ? (this.chess.turn() === 'w' ? 'Black' : 'White') : 'Computer';
      this.announceGameOver(`${winner} Wins`, `${loser} resigned the match.`);
    }
  },

  handleDrawOffer() {
    if (this.gameMode === 'online') {
      this.roomRef.child('gameState').update({
        drawOfferedBy: this.playerColor
      });
      alert('Draw offer sent to opponent.');
    } else {
      // Local draw agreement
      if (confirm('Does your opponent accept the draw offer?')) {
        this.gameActive = false;
        this.stopClocks();
        this.announceGameOver('Draw', 'Draw by mutual agreement');
      }
    }
  },

  // --- Online Multiplayer Room Integrations ---
  createOnlineRoom() {
    if (!this.isFirebaseInitialized) {
      alert('Firebase is not configured yet. Press the Settings Gear (⚙️) icon in the top right to configure Firebase for online play.');
      return;
    }
    
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.roomId = newRoomId;
    this.onlineRole = 'white';
    this.playerColor = 'w';
    
    this.setupFirebaseRoom(newRoomId, true);
  },

  joinOnlineRoom(roomId) {
    if (!this.isFirebaseInitialized) {
      alert('Firebase is not configured yet. Press the Settings Gear (⚙️) icon in the top right to configure Firebase for online play.');
      return;
    }
    
    this.roomId = roomId;
    this.setupFirebaseRoom(roomId, false);
  },

  setupFirebaseRoom(roomId, isCreator) {
    this.roomRef = this.db.ref('rooms/' + roomId);
    this.dom.roomDisplayId.querySelector('.room-val').innerText = roomId;
    this.dom.roomDisplayId.classList.remove('hidden');
    
    // Execute transacting joins to ensure safe slot occupancy
    this.roomRef.transaction((room) => {
      if (!room) {
        if (isCreator) {
          return {
            players: {
              white: this.userId
            },
            playerNames: {
              white: this.playerName
            },
            gameState: {
              fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              status: 'waiting',
              turn: 'w',
              clocks: {
                white: 600,
                black: 600
              }
            }
          };
        } else {
          return null; // Cancel transaction if room doesn't exist
        }
      }

      if (!room.players) room.players = {};
      if (!room.playerNames) room.playerNames = {};

      // If user reconnecting to room
      if (room.players.white === this.userId) {
        room.playerNames.white = this.playerName;
        return room;
      }
      if (room.players.black === this.userId) {
        room.playerNames.black = this.playerName;
        return room;
      }

      // Fill empty slots
      if (!room.players.white) {
        room.players.white = this.userId;
        room.playerNames.white = this.playerName;
      } else if (!room.players.black) {
        room.players.black = this.userId;
        room.playerNames.black = this.playerName;
        if (room.gameState.status === 'waiting') {
          room.gameState.status = 'active';
        }
      } else {
        // Specator mode
      }

      return room;
    }, (error, committed, snapshot) => {
      if (error) {
        alert('Matchmaking transaction failed. Please retry.');
        this.exitToMenu();
        return;
      }

      if (!committed && !isCreator) {
        alert('Room does not exist or has been closed.');
        this.exitToMenu();
        return;
      }

      const roomData = snapshot.val();
      this.determineOnlineRole(roomData);
      this.initOnlineUIElements();
      this.listenToOnlineRoom();
      
      // Update share links
      const shareUrl = `${window.location.origin}${window.location.pathname}?roomid=${roomId}`;
      this.dom.shareLinkInput.value = shareUrl;
      
      // Add share link query in window address bar for clean Vercel sharing
      window.history.pushState({ roomId }, `Room ${roomId}`, `?roomid=${roomId}`);
    });
  },

  determineOnlineRole(roomData) {
    if (roomData.players.white === this.userId) {
      this.onlineRole = 'white';
      this.playerColor = 'w';
    } else if (roomData.players.black === this.userId) {
      this.onlineRole = 'black';
      this.playerColor = 'b';
      this.boardFlipped = true; // Auto flip board for black side
    } else {
      this.onlineRole = 'spectator';
      this.playerColor = 'w'; // Spectator default view
    }
  },

  initOnlineUIElements() {
    this.dom.sharePanel.classList.remove('hidden');
    this.dom.chatPanel.classList.remove('hidden');
    
    this.dom.statusLabel.innerText = this.onlineRole === 'spectator' ? 'Spectator Mode' : 'Online Room';
    
    // Set headers depending on side
    if (this.onlineRole === 'white') {
      this.dom.playerName.innerText = this.playerName;
      this.dom.playerRole.innerText = 'White (You)';
      this.dom.opponentName.innerText = 'Waiting for opponent...';
      this.dom.opponentRole.innerText = 'Black';
      this.dom.playerColorDot.innerText = '⚪';
      this.dom.opponentColorDot.innerText = '⚫';
    } else if (this.onlineRole === 'black') {
      this.dom.playerName.innerText = this.playerName;
      this.dom.playerRole.innerText = 'Black (You)';
      this.dom.playerColorDot.innerText = '⚫';
      this.dom.opponentColorDot.innerText = '⚪';
    } else {
      // Spectator
      this.dom.playerRole.innerText = 'Spectator';
      this.dom.btnResign.disabled = true;
      this.dom.btnDraw.disabled = true;
    }

    this.dom.chatMessagesBox.innerHTML = '';
    this.showView('arena');
  },

  listenToOnlineRoom() {
    this.clearActiveOnlineRoomListeners();
    
    // 1. Listen to general game state updates
    this.roomRef.child('gameState').on('value', (snap) => {
      if (!snap.exists()) return;
      const state = snap.val();
      
      const FEN = state.fen;
      const turn = state.turn;
      const status = state.status;
      
      // Update local engine
      if (this.chess.fen() !== FEN) {
        this.chess = new Chess(FEN);
        this.drawBoard();
        this.updateMovesLog();
        this.updateCapturedPool();
        
        // Sound updates
        if (state.lastMove) {
          const isCheck = this.chess.in_check();
          if (isCheck) ChessAudio.playCheck();
          else ChessAudio.playMove(); // general move sound
        }
      }

      // Sync Clocks
      if (state.clocks) {
        this.clocks.w = state.clocks.white;
        this.clocks.b = state.clocks.black;
        this.updateClockDisplays();
      }

      // Status notifications
      if (status === 'waiting') {
        this.dom.statusMessage.innerText = 'Waiting for opponent...';
        this.gameActive = false;
        this.stopClocks();
      } else if (status === 'active') {
        this.gameActive = true;
        this.startClocks();
        
        if (this.onlineRole === 'spectator') {
          this.dom.statusMessage.innerText = `Game active. Turn: ${turn === 'w' ? 'White' : 'Black'}`;
        } else {
          this.dom.statusMessage.innerText = turn === this.playerColor ? 'Your Turn' : "Opponent's Turn";
        }
      } else if (status === 'checkmate') {
        this.gameActive = false;
        this.stopClocks();
        const winnerColor = state.winner;
        const won = winnerColor === this.playerColor;
        const title = this.onlineRole === 'spectator'
          ? `${winnerColor === 'w' ? 'White' : 'Black'} Wins`
          : (won ? 'Victory!' : 'Defeat!');
        this.announceGameOver(title, state.reason || 'Checkmate');
        this.dom.btnRematch.classList.remove('hidden');
      } else if (status === 'draw') {
        this.gameActive = false;
        this.stopClocks();
        this.announceGameOver('Draw', state.reason || 'Draw by agreement');
        this.dom.btnRematch.classList.remove('hidden');
      } else if (status === 'resigned') {
        this.gameActive = false;
        this.stopClocks();
        const winnerColor = state.winner;
        const won = winnerColor === this.playerColor;
        const title = this.onlineRole === 'spectator'
          ? `${winnerColor === 'w' ? 'White' : 'Black'} Wins`
          : (won ? 'Victory!' : 'Defeat!');
        const loserName = winnerColor === 'w' ? 'Black' : 'White';
        this.announceGameOver(title, `${loserName} Resigned`);
        this.dom.btnRematch.classList.remove('hidden');
      } else if (status === 'timeout') {
        this.gameActive = false;
        this.stopClocks();
        const winnerColor = state.winner;
        const won = winnerColor === this.playerColor;
        const title = this.onlineRole === 'spectator'
          ? `${winnerColor === 'w' ? 'White' : 'Black'} Wins`
          : (won ? 'Victory!' : 'Defeat!');
        const loserName = winnerColor === 'w' ? 'Black' : 'White';
        this.announceGameOver(title, `${loserName} ran out of time!`);
        this.dom.btnRematch.classList.remove('hidden');
      }

      // Handle Rematch alerts
      if (state.rematchOffered && state.rematchOffered !== this.playerColor && this.onlineRole !== 'spectator') {
        this.dom.statusMessage.innerText = 'Opponent offered rematch!';
      }

      // Handle Draw offers
      if (state.drawOfferedBy && state.drawOfferedBy !== this.playerColor && this.onlineRole !== 'spectator') {
        if (confirm('Opponent offered a draw. Accept?')) {
          this.roomRef.child('gameState').update({
            status: 'draw',
            reason: 'Draw by mutual agreement',
            drawOfferedBy: null
          });
        } else {
          // Decline draw
          this.roomRef.child('gameState/drawOfferedBy').set(null);
        }
      }
    });

    // 2. Listen to player slots updates
    this.roomRef.child('playerNames').on('value', (snap) => {
      if (!snap.exists()) return;
      const names = snap.val();
      
      if (this.onlineRole === 'white') {
        this.dom.opponentName.innerText = names.black ? names.black : 'Waiting for opponent...';
        this.dom.opponentRole.innerText = names.black ? 'Black Player' : 'Black';
      } else if (this.onlineRole === 'black') {
        this.dom.opponentName.innerText = names.white ? names.white : 'White Player';
        this.dom.opponentRole.innerText = names.white ? 'White Player' : 'White';
        this.dom.playerName.innerText = this.playerName;
      } else {
        // Spectator
        this.dom.playerName.innerText = names.white ? names.white : 'White';
        this.dom.opponentName.innerText = names.black ? names.black : 'Black';
      }
    });

    // 3. Listen to chat messages
    this.roomRef.child('chat').limitToLast(50).on('child_added', (snap) => {
      const msg = snap.val();
      this.appendChatMessage(msg);
    });
  },

  clearActiveOnlineRoomListeners() {
    if (this.roomRef) {
      this.roomRef.child('gameState').off();
      this.roomRef.child('playerNames').off();
      this.roomRef.child('chat').off();
    }
  },

  syncOnlineGameState() {
    const history = this.chess.history({ verbose: true });
    const lastMove = history.length > 0 ? history[history.length - 1] : null;
    
    const updatePayload = {
      fen: this.chess.fen(),
      turn: this.chess.turn(),
      lastMove: lastMove ? { from: lastMove.from, to: lastMove.to } : null,
      clocks: {
        white: this.clocks.w,
        black: this.clocks.b
      }
    };

    // If game ended local-side, specify here
    if (this.chess.in_checkmate()) {
      updatePayload.status = 'checkmate';
      updatePayload.winner = this.chess.turn() === 'w' ? 'b' : 'w';
      updatePayload.reason = 'Checkmate';
    } else if (this.chess.in_draw() || this.chess.in_stalemate() || this.chess.insufficient_material() || this.chess.in_threefold_repetition()) {
      updatePayload.status = 'draw';
      updatePayload.winner = 'draw';
      updatePayload.reason = 'Draw';
    }

    this.roomRef.child('gameState').update(updatePayload);
  },

  handleRematchOffer() {
    if (this.gameMode === 'online') {
      this.roomRef.child('gameState/rematchOffered').once('value', (snap) => {
        const currentOffer = snap.val();
        if (currentOffer && currentOffer !== this.playerColor) {
          // Both have offered rematch. RESET game!
          this.roomRef.child('gameState').update({
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            status: 'active',
            turn: 'w',
            lastMove: null,
            rematchOffered: null,
            drawOfferedBy: null,
            clocks: {
              white: 600,
              black: 600
            }
          });
          // Swap sides for fun rematch variety!
          this.onlineRole = this.onlineRole === 'white' ? 'black' : 'white';
          this.playerColor = this.onlineRole === 'white' ? 'w' : 'b';
          this.boardFlipped = this.onlineRole === 'black';
          
          this.initOnlineUIElements();
        } else {
          this.roomRef.child('gameState/rematchOffered').set(this.playerColor);
          alert('Rematch offer sent to opponent.');
        }
      });
    } else {
      // Local or Bot restart
      this.startGameMode(this.gameMode);
    }
  },

  sendChatMessage() {
    const text = this.dom.chatInput.value.trim();
    if (text.length === 0 || !this.roomRef) return;
    
    this.roomRef.child('chat').push({
      senderId: this.userId,
      senderName: this.playerName,
      text: text,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    this.dom.chatInput.value = '';
  },

  appendChatMessage(msg) {
    const msgDiv = document.createElement('div');
    const isSelf = msg.senderId === this.userId;
    msgDiv.className = `chat-msg ${isSelf ? 'self' : 'other'}`;
    
    msgDiv.innerHTML = `
      <span class="chat-msg-sender">${isSelf ? 'You' : msg.senderName}</span>
      <span class="chat-msg-text">${msg.text}</span>
    `;
    
    this.dom.chatMessagesBox.appendChild(msgDiv);
    this.dom.chatMessagesBox.scrollTop = this.dom.chatMessagesBox.scrollHeight;
  },

  // --- Helper state queries ---
  isMyTurn() {
    if (this.gameMode === 'local') return true;
    if (this.gameMode === 'bot') return this.chess.turn() === this.playerColor;
    if (this.gameMode === 'online') {
      if (this.onlineRole === 'spectator') return false;
      return this.chess.turn() === this.playerColor;
    }
    return false;
  }
};

// Start application when page loads
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
