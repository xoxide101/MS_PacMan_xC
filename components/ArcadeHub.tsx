'use client';

import { useState } from 'react';
import { arcadeAudio } from '@/lib/game/audio';
import JrPacManArcade from './JrPacManArcade';
import MsPacManArcade from './MsPacManArcade';

export default function ArcadeHub() {
  const [activeGame, setActiveGame] = useState<'jr' | 'ms'>('jr');

  const handleSwitchGame = (next: 'jr' | 'ms') => {
    if (next === activeGame) return;
    arcadeAudio.stopAmbient();
    setActiveGame(next);
  };

  if (activeGame === 'ms') {
    return <MsPacManArcade onSwitchGame={handleSwitchGame} />;
  }

  return <JrPacManArcade onSwitchGame={handleSwitchGame} />;
}
