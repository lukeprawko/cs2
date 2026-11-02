# Dust Alley — Taktyczna Strzelanka 3D FPS (5v5 Plant / Defuse)

Kompletna, przeglądarkowa gra taktyczna FPS 3D inspirowana trybem *Bomb Defusal* (Counter-Strike), stworzona w React + TypeScript + Three.js + Web Audio API + WebSocket (`ws`), działająca w 100% proceduralnie bez zewnętrznych plików modeli, tekstur czy audio.

## Uruchomienie

```bash
npm install
npm run dev
```

Serwer Express + Vite + WebSocket uruchamia się na porcie `http://localhost:3000`.

## Sterowanie

- **WASD** – ruch
- **Shift** – cichy chód (brak hałasu kroków)
- **Ctrl / C** – kucanie (mniejszy hitbox i większa celność)
- **Spacja** – skok
- **Mysz** – rozglądanie i celowanie (Pointer Lock)
- **LPM** – strzał / rzut granatem
- **PPM** – przybliżenie lunety (AWP 2 poziomy, AUG) / silne pchnięcie nożem
- **R** – przeładowanie broni
- **1–5 / Scroll / Q** – wybór broni (1: Długa, 2: Pistolet, 3: Nóż, 4: Granat, 5: Ładunek C4, Q: Ostatnia broń)
- **E (przytrzymanie)** – podkładanie C4 (3.2 s w strefie A/B) oraz rozbrajanie C4 (10 s lub 5 s z Defuse Kitem)
- **B** – menu zakupów (w strefie startowej przez pierwsze 5 s rundy)
- **Tab** – tabela wyników 5v5 (K/D/A, kasa, MVP, ping)
- **Esc / P** – menu pauzy i ustawień

## Główne funkcje

- **Mapa "Dust Alley"**: Symetryczny układ 3-liniowy (Long A, Short A / Catwalk, dwupoziomowy MID z oknem i drzwiami, tunele B, Bombsite A i B).
- **Grafika PBR**: Proceduralne tekstury (`CanvasTexture`), oświetlenie słoneczne z miękkimi cieniami, `RoomEnvironment` IBL, `ACESFilmicToneMapping`, kompozytowe wieloczęściowe modele broni i operatorów CT/T.
- **Taktyczne Boty 5v5 (AI)**: Nawigacja A* po grafie waypointów, strategie drużynowe (Rush A, Rush B, Split Mid-to-A, Default), percepcja wzrokowa i słuchowa, podkładanie i rozbrajanie C4, komunikaty radiowe oraz 4 poziomy trudności.
- **Pełna Ekonomia i Arsenał**: Start 800$, max 16000$, bonusy za serię przegranych, nagrody za eliminacje, podłożenie i rozbrojenie bomby, pistolety, SMG, karabiny, strzelba ze śrucinami, snajperka AWP oraz granaty (HE, Flashbang, Smoke 18s).
- **Tryb Offline + Multiplayer Online**: Domyślny tryb offline z botami oraz lobby online (4-znakowe kody pokojów, autorytatywny serwer WebSocket 20Hz).
