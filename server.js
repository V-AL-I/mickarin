// --- Imports ---
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');
const { MongoClient } = require('mongodb');

// --- Configuration ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000; // Use port 3000 or a port of your choice
const MONGO_URL = "mongodb://localhost:27017"; // Your MongoDB connection string
const DB_NAME = "mickarin";

// --- Database Connection ---
let db;
let gamesCollection;

MongoClient.connect(MONGO_URL, { useUnifiedTopology: true })
  .then(client => {
    console.log("Connected to Database");
    db = client.db(DB_NAME);
    gamesCollection = db.collection("games");
  })
  .catch(error => console.error(error));

// --- Serve the Frontend Files ---
// Place your index.html, script.js, style.css, and images folder in a 'public' subfolder
app.use(express.static('public'));

// --- Game Logic (Moved from client) ---
// It's a good practice to move classes and game logic into separate files (e.g., game.js)
// For simplicity, we'll keep them here for now.
const SIGNS = ["Singe", "Coq", "Chien", "Cochon", "Rat", "Buffle", "Tigre", "Chat", "Dragon", "Serpent", "Cheval", "Chevre"];
const COLORS = { RED: "#b81425", YELLOW: "#ffd000", GREEN: "#2c8c27", BLUE: "#1175f7", PINK: "#de4ed9", PURPLE: "#732da8" };
const STARTING_MONEY = 2500;
const BOARD_SIZE = 36;

// --- Real-time Logic with Socket.IO ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('createGame', async (playerData) => {
        try {
            const gameCode = nanoid(5).toUpperCase(); // Generate a 5-character game code
            const host = createPlayer(0, playerData.name, playerData.yob, socket.id);

            const newGame = {
                gameCode,
                hostId: socket.id,
                status: 'lobby',
                players: [host],
                // Full game state will be added when the game starts
            };

            await gamesCollection.insertOne(newGame);

            socket.join(gameCode);
            socket.emit('gameCreated', newGame); // Send the new game state to the creator
        } catch (err) {
            console.error(err);
            socket.emit('error', 'Could not create game.');
        }
    });

    socket.on('joinGame', async ({ gameCode, playerData }) => {
        try {
            const game = await gamesCollection.findOne({ gameCode });

            if (!game) {
                socket.emit('error', 'Game not found.');
                return;
            }
            if (game.status !== 'lobby') {
                socket.emit('error', 'Game has already started.');
                return;
            }
            if (game.players.length >= 8) {
                socket.emit('error', 'Game is full.');
                return;
            }

            const newPlayer = createPlayer(game.players.length, playerData.name, playerData.yob, socket.id);
            const updatedGame = await gamesCollection.findOneAndUpdate(
                { gameCode },
                { $push: { players: newPlayer } },
                { returnOriginal: false }
            );

            socket.join(gameCode);
            io.to(gameCode).emit('playerJoined', updatedGame.value); // Notify all players in the room
        } catch (err) {
            console.error(err);
            socket.emit('error', 'Could not join game.');
        }
    });

    // ... More events for starting the game, rolling dice, etc. will go here ...

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Handle player disconnection (e.g., mark as 'disconnected' in the game state)
    });
});

// --- Helper Functions (Server-side) ---
function createPlayer(id, name, yob, socketId) {
    const playerColors = ["#d90429", "#0077b6", "#fca311", "#588157", "#6f1d1b", "#432818", "#99582a", "#6a4c93"];
    return {
        id,
        name,
        yob,
        socketId,
        color: playerColors[id],
        money: STARTING_MONEY,
        position: (yob % 12) * 3,
        tiles: [],
        isReady: false,
    };
}


// --- Start Server ---
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
