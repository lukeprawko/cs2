import React from 'react';
import { GameCanvas } from './components/GameCanvas';
import { BuyMenu } from './ui/BuyMenu';
import { HUD } from './ui/HUD';
import { Menu } from './ui/Menu';
import { Scoreboard } from './ui/Scoreboard';

export default function App() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0b0d10]">
      <GameCanvas />
      <HUD />
      <BuyMenu />
      <Scoreboard />
      <Menu />
    </main>
  );
}
