'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TETROMINOES, randomTetromino } from '@/lib/tetrominoes';
import { useInterval } from '@/hooks/useInterval';

const STAGE_WIDTH = 12;
const STAGE_HEIGHT = 20;

type CellValue = string | number;
type STAGE = CellValue[][];

const createStage = () =>
  Array.from(Array(STAGE_HEIGHT), () =>
    new Array(STAGE_WIDTH).fill(0)
  );

export default function Tetris() {
  const [userName, setUserName] = useState('');
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'WON'>('START');
  const [stage, setStage] = useState<STAGE>(createStage());
  const [player, setPlayer] = useState<{
    pos: { x: number; y: number };
    tetromino: (string | number)[][];
    collided: boolean;
    color: string;
  }>({
    pos: { x: 0, y: 0 },
    tetromino: TETROMINOES[0].shape,
    collided: false,
    color: '#000',
  });
  const [nextPiece, setNextPiece] = useState(randomTetromino());
  const [linesCleared, setLinesCleared] = useState(0);
  const [dropTime, setDropTime] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);
  const [startTime, setStartTime] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isResultSavedRef = useRef<boolean>(false);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // Timer logic
  useEffect(() => {
    if (gameState === 'PLAYING') {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  // Auto-focus when game starts
  useEffect(() => {
    if (gameState === 'PLAYING' && gameContainerRef.current) {
      gameContainerRef.current.focus();
    }
  }, [gameState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const checkCollision = (
    playerObj: typeof player,
    stageObj: STAGE,
    { x: moveX, y: moveY }: { x: number; y: number }
  ) => {
    for (let y = 0; y < playerObj.tetromino.length; y += 1) {
      for (let x = 0; x < playerObj.tetromino[y].length; x += 1) {
        if (playerObj.tetromino[y][x] !== 0) {
          if (
            !stageObj[y + playerObj.pos.y + moveY] ||
            stageObj[y + playerObj.pos.y + moveY][x + playerObj.pos.x + moveX] === undefined ||
            stageObj[y + playerObj.pos.y + moveY][x + playerObj.pos.x + moveX] !== 0
          ) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const resetPlayer = useCallback(() => {
    const newPiece = nextPiece;
    setNextPiece(randomTetromino());
    
    setPlayer({
      pos: { x: STAGE_WIDTH / 2 - 2, y: 0 },
      tetromino: newPiece.shape,
      collided: false,
      color: newPiece.color,
    });

    // Game Over check
    if (checkCollision({
      pos: { x: STAGE_WIDTH / 2 - 2, y: 0 },
      tetromino: newPiece.shape,
      collided: false,
      color: newPiece.color,
    }, stage, { x: 0, y: 0 })) {
      setGameState('GAMEOVER');
      setDropTime(null);
    }
  }, [nextPiece, stage]);

  const updatePlayerPos = ({ x, y, collided }: { x: number; y: number; collided: boolean }) => {
    setPlayer((prev) => ({
      ...prev,
      pos: { x: (prev.pos.x + x), y: (prev.pos.y + y) },
      collided,
    }));
  };

  const rotate = (matrix: any[][], dir: number) => {
    const rotated = matrix.map((_, index) =>
      matrix.map((col) => col[index])
    );
    if (dir > 0) return rotated.map((row) => row.reverse());
    return rotated.reverse();
  };

  const playerRotate = (stage: STAGE, dir: number) => {
    const clonedPlayer = JSON.parse(JSON.stringify(player));
    clonedPlayer.tetromino = rotate(clonedPlayer.tetromino, dir);

    const pos = clonedPlayer.pos.x;
    let offset = 1;
    while (checkCollision(clonedPlayer, stage, { x: 0, y: 0 })) {
      clonedPlayer.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > clonedPlayer.tetromino[0].length) {
        rotate(clonedPlayer.tetromino, -dir);
        clonedPlayer.pos.x = pos;
        return;
      }
    }
    setPlayer(clonedPlayer);
  };

  const sweepRows = (newStage: STAGE) => {
    let rowsCleared = 0;
    const sweptStage = newStage.reduce((ack, row) => {
      if (row.findIndex((cell) => cell === 0) === -1) {
        rowsCleared += 1;
        ack.unshift(new Array(newStage[0].length).fill(0));
        return ack;
      }
      ack.push(row);
      return ack;
    }, [] as STAGE);

    if (rowsCleared > 0) {
      setLinesCleared((prev) => {
        const total = prev + rowsCleared;
        if (total >= 3) {
          const now = new Date().toLocaleString();
          setGameState('WON');
          setDropTime(null);
          saveGameResult(userName, startTime, now);
        }
        return total;
      });
    }
    return sweptStage;
  };

  const drop = () => {
    if (!checkCollision(player, stage, { x: 0, y: 1 })) {
      updatePlayerPos({ x: 0, y: 1, collided: false });
    } else {
      // Game Over check at the top
      if (player.pos.y < 1) {
        const now = new Date().toLocaleString();
        setGameState('GAMEOVER');
        setDropTime(null);
        saveGameResult(userName, startTime, now);
        return;
      }
      
      const newStage = stage.map((row) =>
        row.map((cell) => (cell === 0 ? 0 : cell))
      );
      
      player.tetromino.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            newStage[y + player.pos.y][x + player.pos.x] = player.color;
          }
        });
      });

      const sweptStage = sweepRows(newStage);
      setStage(sweptStage);
      resetPlayer();
    }
  };

  const hardDrop = () => {
    let potY = 0;
    while (!checkCollision(player, stage, { x: 0, y: potY + 1 })) {
      potY += 1;
    }
    
    const newStage = stage.map(row => [...row]);
    player.tetromino.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          newStage[y + player.pos.y + potY][x + player.pos.x] = player.color;
        }
      });
    });

    const sweptStage = sweepRows(newStage);
    setStage(sweptStage);
    resetPlayer();
  };

  const dropPlayer = () => {
    setDropTime(null);
    drop();
    setDropTime(1000);
  };

  const movePlayer = (dir: number) => {
    if (!checkCollision(player, stage, { x: dir, y: 0 })) {
      updatePlayerPos({ x: dir, y: 0, collided: false });
    }
  };

  const startGame = () => {
    if (!userName.trim()) return;
    setStage(createStage());
    setNextPiece(randomTetromino());
    setLinesCleared(0);
    setTimer(0);
    isResultSavedRef.current = false;
    setGameState('PLAYING');
    setDropTime(1000);
    // Initial piece logic
    const firstPiece = randomTetromino();
    const now = new Date().toLocaleString();
    setStartTime(now);
    setPlayer({
      pos: { x: STAGE_WIDTH / 2 - 2, y: 0 },
      tetromino: firstPiece.shape,
      collided: false,
      color: firstPiece.color,
    });
  };

  const saveGameResult = async (name: string, start: string, end: string) => {
    if (isResultSavedRef.current) return;
    isResultSavedRef.current = true;

    const WEB_APP_URL = process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
    
    if (!WEB_APP_URL) {
      console.warn('Google Sheets Web App URL이 .env.local에 설정되지 않았습니다.');
      return;
    }

    try {
      await fetch(WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors', // CORS 이슈 방지
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: start,
          name: name,
          finishtime: end,
        }),
      });
      console.log('Result saved successfully');
    } catch (error) {
      console.error('Error saving result:', error);
    }
  };

  const quitGame = () => {
    setGameState('START');
    setDropTime(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (gameState !== 'PLAYING') return;

    if (e.key === 'ArrowLeft') {
      movePlayer(-1);
    } else if (e.key === 'ArrowRight') {
      movePlayer(1);
    } else if (e.key === 'ArrowDown') {
      dropPlayer();
    } else if (e.key === 'ArrowUp') {
      playerRotate(stage, 1);
    } else if (e.key === ' ') {
      e.preventDefault();
      hardDrop();
    }
  };

  useInterval(() => {
    drop();
  }, dropTime);

  // Ghost piece calculation
  const getGhostPos = () => {
    let potY = 0;
    while (!checkCollision(player, stage, { x: 0, y: potY + 1 })) {
      potY += 1;
    }
    return { x: player.pos.x, y: player.pos.y + potY };
  };

  const renderStage = () => {
    const renderedStage = stage.map((row) =>
      row.map((cell) => ({ value: cell, color: cell === 0 ? '' : cell as string, isGhost: false }))
    );

    // Render Ghost
    const ghostPos = getGhostPos();
    if (gameState === 'PLAYING') {
      player.tetromino.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            const boardY = y + ghostPos.y;
            const boardX = x + ghostPos.x;
            if (renderedStage[boardY] && renderedStage[boardY][boardX] && renderedStage[boardY][boardX].value === 0) {
              renderedStage[boardY][boardX] = {
                value: 'G',
                color: player.color,
                isGhost: true,
              };
            }
          }
        });
      });
    }

    // Render Player
    player.tetromino.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          if (renderedStage[y + player.pos.y] && renderedStage[y + player.pos.y][x + player.pos.x]) {
            renderedStage[y + player.pos.y][x + player.pos.x] = {
              value: value,
              color: player.color,
              isGhost: false,
            };
          }
        }
      });
    });

    return renderedStage;
  };

  if (gameState === 'START') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-neutral-950 text-white font-sans">
        <div className="p-8 bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-800 space-y-6 w-80 animate-in fade-in zoom-in duration-500">
          <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">TETRIS</h1>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-400">사용자 이름</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="이름을 입력하세요"
            />
          </div>
          <button
            onClick={startGame}
            disabled={!userName.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-lg font-bold transition-all transform hover:scale-105 active:scale-95"
          >
            게임 시작
          </button>
          
          <div className="pt-4 border-t border-neutral-800 text-center">
            <p className="text-[10px] text-neutral-500 leading-relaxed font-medium">
              AI코딩을활용한창의적앱개발<br />
              신소재공학과 김효빈
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={gameContainerRef}
      className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white p-4 outline-none overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Left Panel: Next Piece & Stats */}
        <div className="space-y-6 w-48 order-2 md:order-1">
          <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800">
            <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-4 font-bold">Next Piece</h2>
            <div className="grid grid-cols-4 grid-rows-4 gap-1 w-24 h-24 mx-auto">
              {nextPiece.shape.map((row, y) => 
                row.map((cell, x) => (
                  <div 
                    key={`next-${y}-${x}`}
                    className="w-full h-full rounded-sm"
                    style={{ 
                      backgroundColor: cell !== 0 ? nextPiece.color : 'transparent',
                      boxShadow: cell !== 0 ? `inset 0 0 8px rgba(255,255,255,0.3)` : 'none'
                    }}
                  />
                ))
              )}
            </div>
          </div>

          <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 space-y-4">
            <div>
              <p className="text-xs text-neutral-500 font-bold uppercase">Time</p>
              <p className="text-2xl font-mono">{formatTime(timer)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 font-bold uppercase">Lines</p>
              <p className="text-2xl font-mono">{linesCleared} / 3</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setGameState(gameState === 'PLAYING' ? 'PAUSED' : 'PLAYING')}
              className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-bold transition-all"
            >
              {gameState === 'PAUSED' ? 'Resume' : 'Pause'}
            </button>
            <button 
              onClick={() => setGameState('START')}
              className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-bold transition-all"
            >
              Restart
            </button>
            <button 
              onClick={quitGame}
              className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 rounded-lg text-sm font-bold transition-all"
            >
              Quit
            </button>
          </div>
        </div>

        {/* Main Board */}
        <div className="relative order-1 md:order-2">
          <div 
            className="grid gap-[1px] bg-neutral-800 p-1 rounded-lg border-2 border-neutral-700 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            style={{
              gridTemplateColumns: `repeat(${STAGE_WIDTH}, 1.75rem)`,
              gridTemplateRows: `repeat(${STAGE_HEIGHT}, 1.75rem)`,
            }}
          >
            {renderStage().map((row, y) => 
              row.map((cell, x) => (
                <div 
                  key={`${y}-${x}`}
                  className={`w-7 h-7 rounded-[2px] transition-all duration-100 ${cell.color && !cell.isGhost ? 'shadow-[inset_0_0_10px_rgba(255,255,255,0.2)] block-drop' : ''}`}
                  style={{ 
                    backgroundColor: cell.isGhost ? 'transparent' : (cell.color || '#121212'),
                    border: cell.isGhost ? `2px border ${cell.color}44` : 'none',
                    boxShadow: cell.isGhost ? `inset 0 0 8px ${cell.color}33, 0 0 8px ${cell.color}22` : '',
                    opacity: cell.isGhost ? 0.4 : (cell.color ? 1 : 0.8),
                    outline: cell.isGhost ? `1px solid ${cell.color}88` : 'none',
                  }}
                />
              ))
            )}
          </div>

          {/* Overlays */}
          {gameState === 'PAUSED' && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
              <h2 className="text-4xl font-bold tracking-widest animate-pulse">PAUSED</h2>
            </div>
          )}

          {(gameState === 'GAMEOVER' || gameState === 'WON') && (
            <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-md flex flex-col items-center justify-center rounded-lg z-20 p-6 text-center space-y-4">
              <h2 className={`text-4xl font-black ${gameState === 'WON' ? 'text-green-500' : 'text-red-500'}`}>
                {gameState === 'WON' ? 'CLEAR!' : 'GAME OVER'}
              </h2>
              <div className="space-y-1">
                <p className="text-neutral-400 text-sm">Player: {userName}</p>
                <p className="text-2xl font-mono">{formatTime(timer)}</p>
                <p className="text-neutral-500">Lines Cleared: {linesCleared}</p>
              </div>
              <button 
                onClick={() => setGameState('START')}
                className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-neutral-200 transition-all transform hover:scale-105"
              >
                Back to Start
              </button>
            </div>
          )}
        </div>

        {/* Right Panel: Controls Info */}
        <div className="hidden lg:block w-48 space-y-4 order-3">
          <div className="p-4 bg-neutral-900/50 rounded-xl border border-neutral-800">
            <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-4 font-bold">Controls</h2>
            <ul className="text-xs space-y-2 text-neutral-400">
              <li className="flex justify-between"><span>Move</span> <span className="text-white">← →</span></li>
              <li className="flex justify-between"><span>Rotate</span> <span className="text-white">↑</span></li>
              <li className="flex justify-between"><span>Drop</span> <span className="text-white">↓</span></li>
              <li className="flex justify-between"><span>Hard Drop</span> <span className="text-white">Space</span></li>
            </ul>
          </div>
          <p className="text-[10px] text-neutral-600">
            Clear 3 lines to complete the challenge!
          </p>
        </div>
      </div>
    </div>
  );
}
