// --- 1. IMPORTS AND CONFIGURATION ---
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");
const { MongoClient } = require("mongodb");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MONGO_URL = "mongodb://localhost:27017";
const DB_NAME = "mickarin";

// --- 2. DATABASE CONNECTION ---
let db;
let gamesCollection;

MongoClient.connect(MONGO_URL, { useUnifiedTopology: true })
  .then((client) => {
    console.log("✅ Successfully connected to MongoDB.");
    db = client.db(DB_NAME);
    gamesCollection = db.collection("games");
  })
  .catch((error) => {
    console.error("❌ Could not connect to MongoDB.", error);
    process.exit(1); // Exit if DB connection fails
  });

// --- 3. EXPRESS SETUP ---
// Serve the 'public' folder which contains index.html, client.js, etc.
app.use(express.static("public"));

// --- 4. GAME CONSTANTS & HELPERS ---
const SIGNS = [
  "Singe",
  "Coq",
  "Chien",
  "Cochon",
  "Rat",
  "Buffle",
  "Tigre",
  "Chat",
  "Dragon",
  "Serpent",
  "Cheval",
  "Chevre",
];
const COLORS = {
  RED: "#b81425",
  YELLOW: "#ffd000",
  GREEN: "#2c8c27",
  BLUE: "#1175f7",
  PINK: "#de4ed9",
  PURPLE: "#732da8",
};
const STARTING_MONEY = 2500;
const BOARD_SIZE = 36;
const PLAYER_COLORS = [
  "#d90429",
  "#0077b6",
  "#fca311",
  "#588157",
  "#6f1d1b",
  "#432818",
  "#99582a",
  "#6a4c93",
];

class Tile {
  constructor(sign, color) {
    this.sign = sign;
    this.color = color;
    this.isSpecial = this.checkIfSpecial(sign, color);
  }

  checkIfSpecial(sign, color) {
    const specialTiles = [
      { sign: "Dragon", color: COLORS.GREEN },
      { sign: "Chien", color: COLORS.GREEN },
      { sign: "Chevre", color: COLORS.PINK },
      { sign: "Buffle", color: COLORS.PINK },
      { sign: "Singe", color: COLORS.YELLOW },
      { sign: "Tigre", color: COLORS.YELLOW },
      { sign: "Rat", color: COLORS.BLUE },
      { sign: "Cheval", color: COLORS.BLUE },
      { sign: "Cochon", color: COLORS.RED },
      { sign: "Serpent", color: COLORS.RED },
      { sign: "Chat", color: COLORS.PURPLE },
      { sign: "Coq", color: COLORS.PURPLE },
    ];
    return specialTiles.some((s) => s.sign === sign && s.color === color);
  }
}

function createPlayer(id, name, yob, socketId) {
  return {
    id,
    name,
    socketId,
    color: PLAYER_COLORS[id],
    money: STARTING_MONEY,
    position: (yob % 12) * 3,
    tiles: [],
    isDisconnected: false,
  };
}

function createAndShuffleTileMachine() {
  let machine = [];
  for (const sign of SIGNS) {
    for (const color of Object.values(COLORS)) {
      machine.push(new Tile(sign, color));
    }
  }
  // Shuffle
  for (let i = machine.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [machine[i], machine[j]] = [machine[j], machine[i]];
  }
  return machine;
}

// Helper to add a message to the game log
function logMessage(game, message) {
  console.log(`[${game.gameCode}] ${message}`);
  game.gameLog.unshift(message); // Add to the beginning of the array
  if (game.gameLog.length > 50) game.gameLog.pop(); // Keep log from getting too long
}

// --- 5. SOCKET.IO REAL-TIME LOGIC ---
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // --- LOBBY MANAGEMENT ---

  socket.on("createGame", async (playerData) => {
    try {
      const gameCode = nanoid(5).toUpperCase();
      const host = createPlayer(0, playerData.name, playerData.yob, socket.id);
      const newGame = {
        gameCode,
        hostId: socket.id,
        status: "lobby",
        players: [host],
        gameLog: [],
      };
      await gamesCollection.insertOne(newGame);
      socket.join(gameCode);
      io.to(gameCode).emit("lobbyUpdate", newGame);
    } catch (err) {
      console.error(err);
      socket.emit("error", "Could not create game.");
    }
  });

  socket.on("joinGame", async ({ gameCode, playerData }) => {
    try {
      const game = await gamesCollection.findOne({ gameCode });
      if (!game) return socket.emit("error", "Game not found.");

      // Reconnection logic
      const disconnectedPlayer = game.players.find(
        (p) => p.name === playerData.name && p.isDisconnected
      );
      if (disconnectedPlayer) {
        disconnectedPlayer.isDisconnected = false;
        disconnectedPlayer.socketId = socket.id;
      } else {
        // New player logic
        if (game.status !== "lobby")
          return socket.emit("error", "Game has already started.");
        if (game.players.length >= 8)
          return socket.emit("error", "Game is full.");
        const newPlayer = createPlayer(
          game.players.length,
          playerData.name,
          playerData.yob,
          socket.id
        );
        game.players.push(newPlayer);
      }

      await gamesCollection.updateOne(
        { gameCode },
        { $set: { players: game.players } }
      );
      socket.join(gameCode);

      const event = game.status === "lobby" ? "lobbyUpdate" : "gameStateUpdate";
      io.to(gameCode).emit(event, game);
    } catch (err) {
      console.error(err);
      socket.emit("error", "Could not join game.");
    }
  });

  socket.on("startGame", async (gameCode) => {
    try {
      const game = await gamesCollection.findOne({ gameCode });
      if (!game || game.hostId !== socket.id) return;
      if (game.players.length < 2)
        return socket.emit("error", "At least 2 players are needed.");

      game.status = "in-progress";
      game.currentPlayerIndex = 0;
      game.turnState = "start"; // 'start', 'machineChoice', 'auction', 'steal'
      game.tileMachine = createAndShuffleTileMachine();
      game.machineOffer = [];
      logMessage(
        game,
        `La partie commence ! C'est au tour de ${game.players[0].name}.`
      );

      await gamesCollection.updateOne({ gameCode }, { $set: game });
      io.to(gameCode).emit("gameStarted", game);
    } catch (err) {
      console.error(err);
    }
  });

  // --- CORE GAME ACTIONS ---

  socket.on("rollDice", async ({ gameCode }) => {
    const game = await gamesCollection.findOne({ gameCode });
    const player = game.players[game.currentPlayerIndex];
    if (player.socketId !== socket.id || game.turnState !== "start") return;

    const diceRoll = Math.floor(Math.random() * 6) + 1;
    game.lastDiceRoll = diceRoll;
    logMessage(game, `${player.name} a fait un ${diceRoll}.`);

    // --- Execute Game Logic Here ---
    player.position = (player.position + diceRoll) % BOARD_SIZE;
    // NOTE: Overtaking/stealing logic and multiple rolls would add significant complexity here.
    // For this version, we'll stick to a simple land-and-act model.

    const cell = {
      type: player.position % 3 === 1 ? "money" : "color",
    };

    if (cell.type === "money") {
      player.money += 100;
      logMessage(game, `${player.name} gagne 100€.`);
      endTurn(game);
    } else {
      game.turnState = "machineChoice";
      logMessage(
        game,
        `${player.name} atterrit sur une case colorée et active la machine.`
      );
      drawFromMachine(game); // Initial draw
    }

    await gamesCollection.updateOne({ gameCode }, { $set: game });
    io.to(gameCode).emit("gameStateUpdate", game);
  });

  socket.on("takeTiles", async ({ gameCode }) => {
    const game = await gamesCollection.findOne({ gameCode });
    const player = game.players[game.currentPlayerIndex];
    if (player.socketId !== socket.id || game.turnState !== "machineChoice")
      return;

    logMessage(
      game,
      `${player.name} prend ${game.machineOffer.length} tuile(s) gratuitement.`
    );
    game.machineOffer.forEach((offer) => player.tiles.push(offer.tile));

    if (checkForWinner(game, player)) {
      // Winner is handled inside the function
    } else {
      endTurn(game);
    }

    await gamesCollection.updateOne({ gameCode }, { $set: game });
    io.to(gameCode).emit("gameStateUpdate", game);
  });

  socket.on("relaunchMachine", async ({ gameCode }) => {
    const game = await gamesCollection.findOne({ gameCode });
    const player = game.players[game.currentPlayerIndex];
    if (player.socketId !== socket.id || game.turnState !== "machineChoice")
      return;

    logMessage(game, `${player.name} relance le tourniquet.`);
    const newDraw = drawFromMachine(game);

    if (newDraw && newDraw.faceUp) {
      logMessage(game, "Tuile face visible ! Le lot part aux enchères !");
      startAuction(game);
    }

    await gamesCollection.updateOne({ gameCode }, { $set: game });
    io.to(gameCode).emit("gameStateUpdate", game);
  });

  socket.on("sellTiles", async ({ gameCode, tiles }) => {
    const game = await gamesCollection.findOne({ gameCode });
    const player = game.players.find((p) => p.socketId === socket.id);
    if (!player || !tiles || tiles.length === 0) return;

    let moneyGained = 0;
    let soldTileIdentifiers = new Set(tiles.map((t) => `${t.sign}-${t.color}`));

    // Filter out the sold tiles from the player's hand
    player.tiles = player.tiles.filter((tileInHand) => {
      if (soldTileIdentifiers.has(`${tileInHand.sign}-${tileInHand.color}`)) {
        moneyGained += tileInHand.isSpecial ? 400 : 200;
        soldTileIdentifiers.delete(`${tileInHand.sign}-${tileInHand.color}`); // Prevent selling duplicates
        return false; // Remove tile
      }
      return true; // Keep tile
    });

    player.money += moneyGained;
    logMessage(
      game,
      `${player.name} a vendu ${tiles.length} tuile(s) pour ${moneyGained}€.`
    );

    await gamesCollection.updateOne({ gameCode }, { $set: game });
    io.to(gameCode).emit("gameStateUpdate", game);
  });

  // --- DISCONNECT HANDLING ---
  socket.on("disconnect", async () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    // Find which game the player was in
    const game = await gamesCollection.findOne({
      "players.socketId": socket.id,
    });
    if (game) {
      const player = game.players.find((p) => p.socketId === socket.id);
      if (player) {
        player.isDisconnected = true;
        logMessage(game, `${player.name} s'est déconnecté.`);
        await gamesCollection.updateOne(
          { gameCode: game.gameCode },
          { $set: { players: game.players } }
        );
        io.to(game.gameCode).emit("gameStateUpdate", game);
      }
    }
  });
});

// --- 6. SERVER-SIDE GAME LOGIC FUNCTIONS ---

function drawFromMachine(game) {
  if (game.tileMachine.length === 0) {
    logMessage(game, "La machine est vide !");
    return null;
  }
  const tile = game.tileMachine.pop();
  const faceUp = Math.random() < 0.5;
  const newDraw = { tile, faceUp };
  game.machineOffer.push(newDraw);
  return newDraw;
}

function startAuction(game) {
  game.status = "auction";
  game.turnState = "auction";
  game.auctionState = {
    bidders: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      money: p.money,
      hasPassed: false,
    })),
    currentBidderIndex: game.currentPlayerIndex,
    highestBid: 0,
    highestBidderName: null,
  };
  // The logic to handle bidding will go in 'placeBid' and 'passBid' socket events
}

function endTurn(game) {
  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  game.turnState = "start";
  game.machineOffer = [];
  game.lastDiceRoll = null;
  logMessage(
    game,
    `C'est au tour de ${game.players[game.currentPlayerIndex].name}.`
  );
}

function checkForWinner(game, player) {
  const signCounts = player.tiles.reduce((acc, tile) => {
    acc[tile.sign] = (acc[tile.sign] || 0) + 1;
    return acc;
  }, {});
  if (Object.values(signCounts).some((count) => count >= 6)) {
    endGame(game, player, "en obtenant 6 tuiles du même signe");
    return true;
  }

  const uniqueSigns = new Set(player.tiles.map((tile) => tile.sign));
  if (uniqueSigns.size >= 12) {
    endGame(game, player, "en obtenant 12 signes différents");
    return true;
  }
  return false;
}

function endGame(game, winner, reason) {
  game.status = "finished";
  game.winner = {
    name: winner.name,
    reason: reason,
  };
  logMessage(
    game,
    `🏁 La partie est terminée ! ${winner.name} a gagné ${reason} !`
  );
}

// --- 7. START SERVER ---
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
