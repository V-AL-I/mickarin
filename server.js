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
const TURN_DURATION = 90000;
const gameTimers = {};

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
    yob,
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
function getSignForPosition(position) {
  const signIndex = Math.floor(position / 3) % SIGNS.length;
  return SIGNS[signIndex];
}
function shuffleMachine(game) {
  const machine = game.tileMachine;
  for (let i = machine.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [machine[i], machine[j]] = [machine[j], machine[i]];
  }
}
function sanitizeGameStateForPlayer(fullGame, targetPlayerId) {
  const sanitizedGame = JSON.parse(JSON.stringify(fullGame));
  sanitizedGame.players.forEach((player) => {
    if (player.id !== targetPlayerId) {
      player.money = "???";
    }
  });
  return sanitizedGame;
}
function broadcastGameState(game, event = "gameStateUpdate") {
  game.players.forEach((player) => {
    if (!player.isDisconnected && player.socketId) {
      const sanitizedState = sanitizeGameStateForPlayer(game, player.id);
      io.to(player.socketId).emit(event, sanitizedState);
    }
  });
}

// --- 5. SOCKET.IO REAL-TIME LOGIC ---
io.on("connection", (socket) => {
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
      const existingPlayer = game.players.find(
        (p) => p.name === playerData.name && p.yob === playerData.yob
      );
      if (existingPlayer) {
        existingPlayer.isDisconnected = false;
        existingPlayer.socketId = socket.id;
        logMessage(game, `${existingPlayer.name} s'est reconnecté.`);
      } else {
        if (game.status !== "lobby")
          return socket.emit(
            "error",
            "Game has already started. New players cannot join."
          );
        if (game.players.length >= 8)
          return socket.emit("error", "Game is full.");
        if (game.players.some((p) => p.name === playerData.name))
          return socket.emit(
            "error",
            "A player with this name is already in the lobby."
          );
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
      if (game.status === "lobby") {
        io.to(gameCode).emit("lobbyUpdate", game);
      } else {
        socket.emit(
          "reconnectSuccess",
          sanitizeGameStateForPlayer(game, existingPlayer.id)
        );
        broadcastGameState(game);
      }
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
      startTurnTimer(game);
      await gamesCollection.updateOne({ gameCode }, { $set: game });
      broadcastGameState(game, "gameStarted");
    } catch (err) {
      console.error(err);
    }
  });
  socket.on("rollDice", async ({ gameCode }) => {
    const game = await gamesCollection.findOne({ gameCode });
    const player = game.players[game.currentPlayerIndex];
    if (player.socketId !== socket.id) return;
    clearTurnTimer(gameCode);
    if (game.turnState === "secondRoll") {
      const diceRoll = Math.floor(Math.random() * 6) + 1;
      game.lastDiceRoll = diceRoll;
      player.position = (player.position + diceRoll) % BOARD_SIZE;
      logMessage(
        game,
        `${player.name} fait un ${diceRoll} pour son second lancer et termine son tour.`
      );
      endTurn(game);
    } else if (game.turnState === "start") {
      const diceRoll = Math.floor(Math.random() * 6) + 1;
      game.lastDiceRoll = diceRoll;
      logMessage(game, `${player.name} a fait un ${diceRoll}.`);
      const oldPosition = player.position;
      player.position = (oldPosition + diceRoll) % BOARD_SIZE;
      handleRent(game, player);
      const victimsWithTiles = Array.from(
        new Set(
          Array.from(
            { length: diceRoll },
            (_, i) => (oldPosition + i + 1) % BOARD_SIZE
          ).flatMap((pos) =>
            game.players.filter((p) => p.id !== player.id && p.position === pos)
          )
        )
      ).filter((v) => v.tiles.length > 0);
      if (victimsWithTiles.length > 0) {
        logMessage(
          game,
          `${player.name} a dépassé ${victimsWithTiles
            .map((p) => p.name)
            .join(", ")} et va pouvoir voler des tuiles !`
        );
        game.status = "steal";
        game.turnState = "stealing";
        game.stealState = {
          thiefId: player.id,
          victimQueue: victimsWithTiles.map((v) => v.id),
        };
        startTurnTimer(game);
      } else {
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
          startTurnTimer(game);
        }
      }
    }
    await gamesCollection.updateOne({ gameCode }, { $set: game });
    broadcastGameState(game);
  });
  socket.on("stealTile", async ({ gameCode, victimId, tileIndex }) => {
    const game = await gamesCollection.findOne({ gameCode });
    if (game.turnState !== "stealing") return;
    const thief = game.players.find((p) => p.id === game.stealState.thiefId);
    if (thief.socketId !== socket.id) return;
    clearTurnTimer(gameCode);
    const victim = game.players.find((p) => p.id === victimId);
    if (!victim || !victim.tiles[tileIndex]) return;
    const stolenTile = victim.tiles.splice(tileIndex, 1)[0];
    thief.tiles.push(stolenTile);
    logMessage(
      game,
      `${thief.name} a volé une tuile ${stolenTile.sign} à ${victim.name}.`
    );
    game.stealState.victimQueue.shift();
    if (game.stealState.victimQueue.length === 0) {
      logMessage(
        game,
        `${thief.name} a fini de voler. Il doit maintenant relancer le dé.`
      );
      game.status = "in-progress";
      game.turnState = "secondRoll";
      game.stealState = null;
    }
    if (!checkForWinner(game, thief)) {
      await gamesCollection.updateOne({ gameCode }, { $set: game });
      startTurnTimer(game);
      broadcastGameState(game);
    } else {
      await gamesCollection.updateOne({ gameCode }, { $set: game });
      broadcastGameState(game);
    }
  });
  socket.on("takeTiles", async ({ gameCode }) => {
    const game = await gamesCollection.findOne({ gameCode });
    const player = game.players[game.currentPlayerIndex];
    if (player.socketId !== socket.id || game.turnState !== "machineChoice")
      return;
    clearTurnTimer(gameCode);
    await revealAndAwardTiles(game, player);
  });
  socket.on("relaunchMachine", async ({ gameCode }) => {
    const game = await gamesCollection.findOne({ gameCode });
    const player = game.players[game.currentPlayerIndex];
    if (player.socketId !== socket.id || game.turnState !== "machineChoice")
      return;
    clearTurnTimer(gameCode);
    logMessage(game, `${player.name} relance le tourniquet.`);
    const newDraw = drawFromMachine(game);
    if (newDraw && newDraw.faceUp) {
      logMessage(game, "Tuile face visible ! Le lot part aux enchères !");
      startAuction(game);
    } else {
      startTurnTimer(game);
    }
    await gamesCollection.updateOne({ gameCode }, { $set: game });
    broadcastGameState(game);
  });
  socket.on("sellTiles", async ({ gameCode, tiles }) => {
    const game = await gamesCollection.findOne({ gameCode });
    const player = game.players[game.currentPlayerIndex];
    if (player.socketId !== socket.id || game.turnState !== "start") return;
    if (!tiles || tiles.length === 0) return;
    let moneyGained = 0;
    const soldTilesForMachine = [];
    const soldTileIdentifiers = new Set(
      tiles.map((t) => `${t.sign}-${t.color}`)
    );
    const remainingTiles = [];
    for (const tileInHand of player.tiles) {
      const identifier = `${tileInHand.sign}-${tileInHand.color}`;
      if (soldTileIdentifiers.has(identifier)) {
        moneyGained += tileInHand.isSpecial ? 400 : 200;
        soldTilesForMachine.push(tileInHand);
        soldTileIdentifiers.delete(identifier);
      } else {
        remainingTiles.push(tileInHand);
      }
    }
    if (soldTilesForMachine.length === 0) return;
    player.tiles = remainingTiles;
    player.money += moneyGained;
    game.tileMachine.push(...soldTilesForMachine);
    shuffleMachine(game);
    logMessage(
      game,
      `${player.name} a vendu ${soldTilesForMachine.length} tuile(s) for ${moneyGained}€. Les tuiles retournent dans la machine.`
    );
    await gamesCollection.updateOne({ gameCode }, { $set: game });
    broadcastGameState(game);
  });
  socket.on("placeBid", async ({ gameCode, amount }) => {
    const game = await gamesCollection.findOne({ gameCode });
    if (!game || game.status !== "auction") return;
    const auction = game.auctionState;
    const bidderInfo = auction.bidders[auction.currentBidderIndex];
    const player = game.players.find((p) => p.id === bidderInfo.id);
    if (player.socketId !== socket.id) return;
    clearTurnTimer(gameCode);
    const isInitialBid = !auction.initialBidMade;
    const minBid = isInitialBid ? 100 : auction.highestBid + 100;
    if (amount >= minBid && amount <= player.money && amount % 100 === 0) {
      auction.highestBid = amount;
      auction.highestBidderName = player.name;
      auction.highestBidderId = player.id;
      if (isInitialBid) {
        auction.initialBidMade = true;
      }
      logMessage(game, `${player.name} enchérit à ${amount}€.`);
      advanceAuction(game);
    } else {
      socket.emit(
        "error",
        `Votre offre doit être d'au moins ${minBid}€, par paliers de 100€, et dans les limites de votre argent.`
      );
      startTurnTimer(game);
    }
    await gamesCollection.updateOne({ gameCode }, { $set: game });
    broadcastGameState(game);
  });
  socket.on("passBid", async ({ gameCode }) => {
    const game = await gamesCollection.findOne({ gameCode });
    if (!game || game.status !== "auction") return;
    const auction = game.auctionState;
    const bidderInfo = auction.bidders[auction.currentBidderIndex];
    const player = game.players.find((p) => p.id === bidderInfo.id);
    if (player.socketId !== socket.id) return;
    clearTurnTimer(gameCode);
    if (!auction.initialBidMade) {
      if (player.money >= 100) {
        startTurnTimer(game);
        return socket.emit(
          "error",
          "Vous avez initié l'enchère, vous devez faire une offre d'au moins 100€."
        );
      }
    }
    logMessage(game, `${player.name} passe son tour.`);
    bidderInfo.hasPassed = true;
    advanceAuction(game);
    await gamesCollection.updateOne({ gameCode }, { $set: game });
    broadcastGameState(game);
  });
  socket.on("leaveGame", async ({ gameCode }) => {
    const game = await gamesCollection.findOne({ gameCode });
    if (!game) return;
    const leavingPlayerIndex = game.players.findIndex(
      (p) => p.socketId === socket.id
    );
    if (leavingPlayerIndex === -1) return;
    const wasCurrentPlayer = game.currentPlayerIndex === leavingPlayerIndex;
    const leavingPlayer = game.players[leavingPlayerIndex];
    logMessage(game, `${leavingPlayer.name} a quitté la partie.`);
    game.players.splice(leavingPlayerIndex, 1);
    if (game.players.length <= 1) {
      if (game.players.length === 1) {
        endGame(game, game.players[0], "car il est le dernier joueur restant");
      } else {
        endGame(game, { name: "Personne" }, "car tous les joueurs ont quitté");
      }
    } else {
      if (leavingPlayerIndex < game.currentPlayerIndex) {
        game.currentPlayerIndex--;
      }
      if (wasCurrentPlayer) {
        endTurn(game);
      } else {
        game.currentPlayerIndex %= game.players.length;
        startTurnTimer(game);
      }
    }
    await gamesCollection.updateOne({ gameCode }, { $set: game });
    broadcastGameState(game);
  });
  socket.on("disconnect", async () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    const game = await gamesCollection.findOne({
      "players.socketId": socket.id,
    });
    if (game) {
      const player = game.players.find((p) => p.socketId === socket.id);
      if (player) {
        player.isDisconnected = true;
        player.socketId = null;
        logMessage(game, `${player.name} s'est déconnecté.`);
        await gamesCollection.updateOne(
          { gameCode: game.gameCode },
          { $set: { players: game.players } }
        );
        broadcastGameState(game);
      }
    }
  });
});

// --- 6. SERVER-SIDE GAME LOGIC FUNCTIONS ---
function startTurnTimer(game) {
  clearTurnTimer(game.gameCode);
  game.turnEndTime = Date.now() + TURN_DURATION;
  const gameCode = game.gameCode;
  const playerToExpireId = game.players[game.currentPlayerIndex].id;
  gameTimers[gameCode] = setTimeout(async () => {
    console.log(
      `[${gameCode}] Turn timer expired for player ID ${playerToExpireId}.`
    );
    const freshGame = await gamesCollection.findOne({ gameCode });
    if (
      freshGame &&
      freshGame.status === "in-progress" &&
      freshGame.players[freshGame.currentPlayerIndex].id === playerToExpireId
    ) {
      const kickedPlayer = freshGame.players[freshGame.currentPlayerIndex];
      logMessage(
        freshGame,
        `Le temps de ${kickedPlayer.name} est écoulé. Il est retiré de la partie.`
      );
      freshGame.players.splice(freshGame.currentPlayerIndex, 1);
      if (freshGame.players.length <= 1) {
        if (freshGame.players.length === 1) {
          endGame(
            freshGame,
            freshGame.players[0],
            "parce que son dernier adversaire a été éliminé"
          );
        } else {
          endGame(
            freshGame,
            { name: "Personne" },
            "car tous les joueurs ont quitté"
          );
        }
      } else {
        if (freshGame.currentPlayerIndex >= freshGame.players.length) {
          freshGame.currentPlayerIndex = 0;
        }
        endTurn(freshGame);
      }
      await gamesCollection.updateOne({ gameCode }, { $set: freshGame });
      broadcastGameState(freshGame);
    }
  }, TURN_DURATION);
}
function clearTurnTimer(gameCode) {
  if (gameTimers[gameCode]) {
    clearTimeout(gameTimers[gameCode]);
    delete gameTimers[gameCode];
  }
}
async function revealAndAwardTiles(game, winningPlayer) {
  const faceDownOffers = game.machineOffer.filter((offer) => !offer.faceUp);
  if (faceDownOffers.length > 0) {
    logMessage(game, "Révélation des tuiles...");
    game.turnState = "revealing";
    game.machineOffer.forEach((offer) => {
      if (!offer.faceUp) {
        const colorName = Object.keys(COLORS)
          .find((key) => COLORS[key] === offer.tile.color)
          .toLowerCase();
        logMessage(game, `Tuile révélée : ${offer.tile.sign} ${colorName}`);
        offer.faceUp = true;
      }
    });
    await gamesCollection.updateOne(
      { gameCode: game.gameCode },
      { $set: game }
    );
    broadcastGameState(game);
    setTimeout(async () => {
      const finalGame = await gamesCollection.findOne({
        gameCode: game.gameCode,
      });
      if (!finalGame) return;
      const finalWinner = finalGame.players.find(
        (p) => p.id === winningPlayer.id
      );
      finalWinner.tiles.push(
        ...finalGame.machineOffer.map((offer) => offer.tile)
      );
      logMessage(
        finalGame,
        `${finalWinner.name} a reçu ${finalGame.machineOffer.length} tuile(s).`
      );
      if (!checkForWinner(finalGame, finalWinner)) {
        endTurn(finalGame);
      }
      await gamesCollection.updateOne(
        { gameCode: finalGame.gameCode },
        { $set: finalGame }
      );
      broadcastGameState(finalGame);
    }, 1500);
  } else {
    winningPlayer.tiles.push(...game.machineOffer.map((offer) => offer.tile));
    logMessage(
      game,
      `${winningPlayer.name} a reçu ${game.machineOffer.length} tuile(s).`
    );
    if (!checkForWinner(game, winningPlayer)) {
      endTurn(game);
    }
    await gamesCollection.updateOne(
      { gameCode: game.gameCode },
      { $set: game }
    );
    broadcastGameState(game);
  }
}
function handleRent(game, currentPlayer) {
  const currentPosition = currentPlayer.position;
  const currentSign = getSignForPosition(currentPosition);
  const landlords = game.players.filter((p) => {
    if (p.id === currentPlayer.id || p.isDisconnected) return false;
    const ownedSignTiles = p.tiles.filter((tile) => tile.sign === currentSign);
    return ownedSignTiles.length >= 3;
  });
  if (landlords.length === 0) {
    return;
  }
  let finalLandlord = null;
  if (landlords.length === 1) {
    finalLandlord = landlords[0];
  } else {
    finalLandlord = landlords.find((landlord) =>
      landlord.tiles.some((tile) => tile.sign === currentSign && tile.isSpecial)
    );
  }
  if (!finalLandlord) {
    logMessage(
      game,
      `Conflit de propriété pour le signe ${currentSign}. Aucun loyer n'est payé.`
    );
    return;
  }
  const landlordHasSpecial = finalLandlord.tiles.some(
    (tile) => tile.sign === currentSign && tile.isSpecial
  );
  const rentAmount = landlordHasSpecial ? 400 : 200;
  currentPlayer.money -= rentAmount;
  finalLandlord.money += rentAmount;
  logMessage(
    game,
    `${currentPlayer.name} paie un loyer de ${rentAmount}€ à ${finalLandlord.name} pour le signe ${currentSign}.`
  );
}
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
    highestBidderId: null,
    initialBidMade: false,
  };
  startTurnTimer(game);
}
function advanceAuction(game) {
  const auction = game.auctionState;
  const activeBidders = auction.bidders.filter((b) => !b.hasPassed);
  if (activeBidders.length <= 1) {
    endAuction(game);
    return;
  }
  let nextIndex = (auction.currentBidderIndex + 1) % auction.bidders.length;
  while (auction.bidders[nextIndex].hasPassed) {
    nextIndex = (nextIndex + 1) % auction.bidders.length;
  }
  auction.currentBidderIndex = nextIndex;
  startTurnTimer(game);
}
async function endAuction(game) {
  const auction = game.auctionState;
  if (auction.highestBidderId !== null) {
    const winner = game.players.find((p) => p.id === auction.highestBidderId);
    winner.money -= auction.highestBid;
    logMessage(
      game,
      `${winner.name} remporte l'enchère pour ${auction.highestBid}€.`
    );
    await revealAndAwardTiles(game, winner);
  } else {
    logMessage(game, "Personne n'a enchéri. Les tuiles sont défaussées.");
    endTurn(game);
    await gamesCollection.updateOne(
      { gameCode: game.gameCode },
      { $set: game }
    );
    broadcastGameState(game);
  }
}

// --- MODIFIED: THE FIX IS HERE ---
function endTurn(game) {
  // Correctly increment the player index
  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  game.turnState = "start";
  game.status = "in-progress";
  game.machineOffer = [];
  game.lastDiceRoll = null;
  game.stealState = null;
  logMessage(
    game,
    `C'est au tour de ${game.players[game.currentPlayerIndex].name}.`
  );
  startTurnTimer(game);
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
  clearTurnTimer(game.gameCode);
  game.status = "finished";
  game.turnEndTime = null;
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
