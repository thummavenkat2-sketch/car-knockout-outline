# Car Knockout Online v2

A real-time 2-player 3D cockpit car knockout game.

## Includes
- Online room-code multiplayer with Socket.IO
- First-person cockpit camera for each player
- 3D cars, arena walls, lights, road markings and KO zones
- Accelerator, brake and manual steering
- Nitro/boost
- Speedometer
- Damage/KO HUD
- Minimap
- Countdown and sound effects
- Mobile touch controls
- Desktop keyboard controls
- Installable PWA shell

## Controls
P1: W/S/A/D
P2: Arrow Up/Down/Left/Right
Space: nitro
Touch controls are displayed on phones.

## Run
Node.js 18+:
npm install
npm start

Then open the server URL on two devices and enter the same room code.

## Online deployment
Deploy the Node.js server to a host that supports long-lived WebSocket connections. Set PORT from the host environment if required. Both players then use the same HTTPS URL and room code.

This package is a web app/PWA source project. A signed Android APK requires an Android build environment or a wrapper service.
