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
    process.exit(1);
  });

// --- 3. EXPRESS SETUP ---
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
  for (let i = machine.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [machine[i], machine[j]] = [machine[j], machine[i]];
  }
  return machine;
}

function logMessage(game, message) {
  console.log(`[${game.gameCode}] ${message}`);
  game.gameLog.unshift(message);
  if (game.gameLog.length > 50) game.gameLog.pop();
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
      const disconnectedPlayer = game.players.find(
        (p) => p.name === playerData.name && p.isDisconnected
      );
      if (disconnectedPlayer) {
        disconnectedPlayer.isDisconnected = false;
        disconnectedPlayer.socketId = socket.id;
      } else {
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
      game.turnState = "start";
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
    player.position = (player.position + diceRoll) % BOARD_SIZE;
    const cell = { type: player.position % 3 === 1 ? "money" : "color" };
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
      drawFromMachine(game);
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
    if (!checkForWinner(game, player)) {
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
    player.tiles = player.tiles.filter((tileInHand) => {
      if (soldTileIdentifiers.has(`${tileInHand.sign}-${tileInHand.color}`)) {
        moneyGained += tileInHand.isSpecial ? 400 : 200;
        soldTileIdentifiers.delete(`${tileInHand.sign}-${tileInHand.color}`);
        return false;
      }
      return true;
    });
    player.money += moneyGained;
    logMessage(
      game,
      `${player.name} a vendu ${tiles.length} tuile(s) pour ${moneyGained}€.`
    );
    await gamesCollection.updateOne({ gameCode }, { $set: game });
    io.to(gameCode).emit("gameStateUpdate", game);
  });

  // =========================================================================
  // --- NEW CODE: AUCTION HANDLING ---
  // =========================================================================
  socket.on("placeBid", async ({ gameCode, amount }) => {
    const game = await gamesCollection.findOne({ gameCode });
    if (!game || game.status !== "auction") return;

    const auction = game.auctionState;
    const bidderInfo = auction.bidders[auction.currentBidderIndex];
    const player = game.players.find((p) => p.id === bidderInfo.id);

    // Validation: Is it this player's turn to bid?
    if (player.socketId !== socket.id) return;

    // Validation: Is the bid valid?
    const minBid = auction.highestBid + 100;
    if (amount >= minBid && amount <= player.money && amount % 100 === 0) {
      auction.highestBid = amount;
      auction.highestBidderName = player.name;
      auction.highestBidderId = player.id;
      logMessage(game, `${player.name} enchérit à ${amount}€.`);
      advanceAuction(game); // Move to the next bidder
    } else {
      socket.emit(
        "error",
        `Votre offre doit être d'au moins ${minBid}€, par paliers de 100€, et dans les limites de votre argent.`
      );
    }

    await gamesCollection.updateOne({ gameCode }, { $set: game });
    io.to(gameCode).emit("gameStateUpdate", game);
  });

  socket.on("passBid", async ({ gameCode }) => {
    const game = await gamesCollection.findOne({ gameCode });
    if (!game || game.status !== "auction") return;

    const auction = game.auctionState;
    const bidderInfo = auction.bidders[auction.currentBidderIndex];
    const player = game.players.find((p) => p.id === bidderInfo.id);

    // Validation: Is it this player's turn?
    if (player.socketId !== socket.id) return;

    logMessage(game, `${player.name} passe son tour.`);
    bidderInfo.hasPassed = true;
    advanceAuction(game); // Move to the next bidder

    await gamesCollection.updateOne({ gameCode }, { $set: game });
    io.to(gameCode).emit("gameStateUpdate", game);
  });
  // =========================================================================
  // --- END OF NEW CODE ---
  // =========================================================================

  // --- DISCONNECT HANDLING ---
  socket.on("disconnect", async () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
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
    bidders: game.players
      .filter((p) => !p.isDisconnected)
      .map((p) => ({ id: p.id, name: p.name, hasPassed: false })),
    currentBidderIndex: game.players.findIndex(
      (p) => p.id === game.players[game.currentPlayerIndex].id
    ),
    highestBid: 0,
    highestBidderName: null,
    highestBidderId: null, // Keep track of the winner's ID
  };
}

// =========================================================================
// --- NEW HELPER FUNCTIONS FOR AUCTION ---
// =========================================================================
function advanceAuction(game) {
  const auction = game.auctionState;
  const activeBidders = auction.bidders.filter((b) => !b.hasPassed);

  // Check if the auction should end
  if (activeBidders.length <= 1) {
    endAuction(game);
    return;
  }

  // Find the next bidder
  let nextIndex = (auction.currentBidderIndex + 1) % auction.bidders.length;
  while (auction.bidders[nextIndex].hasPassed) {
    nextIndex = (nextIndex + 1) % auction.bidders.length;
  }
  auction.currentBidderIndex = nextIndex;
}

function endAuction(game) {
  const auction = game.auctionState;
  if (auction.highestBidderId !== null) {
    const winner = game.players.find((p) => p.id === auction.highestBidderId);
    winner.money -= auction.highestBid;
    game.machineOffer.forEach((offer) => winner.tiles.push(offer.tile));
    logMessage(
      game,
      `${winner.name} remporte l'enchère pour ${auction.highestBid}€ et reçoit ${game.machineOffer.length} tuile(s).`
    );
    checkForWinner(game, winner);
  } else {
    logMessage(game, "Personne n'a enchéri. Les tuiles sont défaussées.");
  }

  // Clean up auction state and move to the next player's turn
  game.auctionState = null;
  if (game.status !== "finished") {
    endTurn(game);
  }
}
// =========================================================================
// --- END OF NEW HELPER FUNCTIONS ---
// =========================================================================

function endTurn(game) {
  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  game.turnState = "start";
  game.status = "in-progress"; // Ensure status is correct
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
  game.winner = { name: winner.name, reason: reason };
  logMessage(
    game,
    `🏁 La partie est terminée ! ${winner.name} a gagné ${reason} !`
  );
}

// --- 7. START SERVER ---
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
