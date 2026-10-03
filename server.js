
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.static("public"));

const rooms = new Map();

function freshPlayer(id, slot) {
  return {
    id, slot,
    x: slot === 0 ? -12 : 12,
    z: 0,
    vx: 0, vz: 0,
    angle: slot === 0 ? 0 : Math.PI,
    accel: false, brake: false, left: false, right: false, boost: false,
    boosts: 1, alive: true
  };
}

function roomState(room) {
  return [...room.players.values()].map(p => ({
    slot:p.slot,x:p.x,z:p.z,vx:p.vx,vz:p.vz,angle:p.angle,
    alive:p.alive,boosts:p.boosts
  }));
}

function tickRoom(room) {
  if (room.winner !== null) return;

  for (const p of room.players.values()) {
    if (!p.alive) continue;
    const steer = (p.right ? 1 : 0) - (p.left ? 1 : 0);
    const speed = Math.hypot(p.vx, p.vz);
    p.angle += steer * (0.018 + Math.min(speed / 12, 1) * 0.045);

    if (p.accel) {
      p.vx += Math.sin(p.angle) * 0.16;
      p.vz += Math.cos(p.angle) * 0.16;
    }
    if (p.brake) {
      p.vx *= 0.90; p.vz *= 0.90;
    }
    if (p.boost && p.boosts > 0) {
      p.vx += Math.sin(p.angle) * 0.28;
      p.vz += Math.cos(p.angle) * 0.28;
      p.boosts--;
      p.boost = false;
    }

    const s = Math.hypot(p.vx,p.vz);
    if (s > 10) { p.vx *= 10/s; p.vz *= 10/s; }

    p.x += p.vx;
    p.z += p.vz;
    p.vx *= 0.985; p.vz *= 0.985;

    // Arena boundaries. Side walls bounce; KO strips at the ends.
    if (p.z < -18) { p.z = -18; p.vz *= -0.65; }
    if (p.z > 18)  { p.z = 18;  p.vz *= -0.65; }
  }

  const ps = [...room.players.values()];
  if (ps.length === 2) {
    const a=ps[0], b=ps[1];
    const dx=b.x-a.x, dz=b.z-a.z, d=Math.hypot(dx,dz);
    if (d < 4 && d > 0) {
      const nx=dx/d, nz=dz/d;
      const rv=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
      if (rv > 0) {
        const impulse=rv*1.35;
        a.vx-=impulse*nx; a.vz-=impulse*nz;
        b.vx+=impulse*nx; b.vz+=impulse*nz;
      }
      const push=(4-d)/2;
      a.x-=nx*push; a.z-=nz*push;
      b.x+=nx*push; b.z+=nz*push;
    }

    // Knockout if a car is pushed past either end.
    for (const p of ps) {
      if (p.x < -30 || p.x > 30) {
        p.alive=false;
        room.winner = p.slot === 0 ? 1 : 0;
      }
    }
  }

  io.to(room.id).emit("state", {
    players: roomState(room),
    winner: room.winner,
    started: ps.length === 2
  });
}

io.on("connection", socket => {
  socket.on("joinRoom", code => {
    code = String(code || "").trim().toUpperCase().slice(0,8);
    if (!/^[A-Z0-9]{3,8}$/.test(code)) return socket.emit("errorMsg","Use a 3-8 character room code.");

    let room = rooms.get(code);
    if (!room) {
      room={id:code,players:new Map(),winner:null};
      rooms.set(code,room);
    }
    if (room.players.size >= 2) return socket.emit("errorMsg","Room is full.");
    const slot=room.players.size;
    room.players.set(socket.id,freshPlayer(socket.id,slot));
    socket.join(code);
    socket.data.room=code;
    socket.data.slot=slot;
    socket.emit("joined",{slot,code});
    io.to(code).emit("state",{players:roomState(room),winner:null,started:room.players.size===2});
  });

  socket.on("input", input => {
    const room=rooms.get(socket.data.room);
    const p=room?.players.get(socket.id);
    if (!p) return;
    p.accel=!!input.accel; p.brake=!!input.brake;
    p.left=!!input.left; p.right=!!input.right;
    if (input.boost) p.boost=true;
  });

  socket.on("restart", () => {
    const code=socket.data.room, room=rooms.get(code);
    if (!room) return;
    for (const p of room.players.values()) {
      const old=p.slot, fresh=freshPlayer(p.id,old);
      room.players.set(p.id,fresh);
    }
    room.winner=null;
    io.to(code).emit("state",{players:roomState(room),winner:null,started:room.players.size===2});
  });

  socket.on("disconnect",()=>{
    const code=socket.data.room, room=rooms.get(code);
    if (!room) return;
    room.players.delete(socket.id);
    io.to(code).emit("state",{players:roomState(room),winner:null,started:room.players.size===2});
    if (room.players.size===0) rooms.delete(code);
  });
});

setInterval(()=>{
  for (const room of rooms.values()) tickRoom(room);
}, 1000/30);

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Car Knockout running on http://localhost:${PORT}`));
