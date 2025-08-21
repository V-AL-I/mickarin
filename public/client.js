document.addEventListener("DOMContentLoaded", () => {
  // --- SOCKET.IO & STATE ---
  const socket = io();
  let gameState = {};
  let myPlayerId = null;
  let selectedTilesForSale = []; // Client-side state for UI only

  // --- DOM ELEMENTS ---
  // Main Menu & Lobby
  const mainMenu = document.getElementById("main-menu");
  const createGameBtn = document.getElementById("create-game-btn");
  const joinGameBtn = document.getElementById("join-game-btn");
  const lobbyModal = document.getElementById("lobby-modal");
  const startGameLobbyBtn = document.getElementById("start-game-btn"); // Renamed for clarity

  // Game Containers
  const gameContainer = document.getElementById("game-container");
  const board = document.getElementById("board");
  const playersPanel = document.getElementById("players-panel");
  const gameLogEl = document.getElementById("game-log");

  // Controls
  const controlsPanel = document.getElementById("controls-panel");
  const playerTurnEl = document.getElementById("player-turn");
  const playerMoneyEl = document.getElementById("player-money");
  const rollDiceBtn = document.getElementById("roll-dice-btn");
  const diceResultEl = document.getElementById("dice-result");

  // Machine
  const machineTilesEl = document.getElementById("machine-tiles");
  const takeTileBtn = document.getElementById("take-tile-btn");
  const relaunchBtn = document.getElementById("relaunch-btn");

  // Modals
  const modalBackdrop = document.getElementById("modal-backdrop");
  const auctionModal = document.getElementById("auction-modal");
  const stealModal = document.getElementById("steal-modal");
  const sellModal = document.getElementById("sell-modal");
  const winnerModal = document.getElementById("winner-modal");

  // Sell Modal specific
  const sellTilesContainer = document.getElementById("sell-tiles-container");
  const sellTotalEl = document.getElementById("sell-total");
  const confirmSellBtn = document.getElementById("confirm-sell-btn");
  const cancelSellBtn = document.getElementById("cancel-sell-btn");

  // Auction Modal specific
  const placeBidBtn = auctionModal.querySelector("#place-bid-btn");
  const passBidBtn = auctionModal.querySelector("#pass-bid-btn");

  // --- 1. PRE-GAME: MENU & LOBBY ACTIONS (EMITTERS) ---

  createGameBtn.addEventListener("click", () => {
    const playerData = {
      name: document.getElementById("player-name-create").value.trim(),
      yob: parseInt(document.getElementById("player-yob-create").value),
    };
    if (playerData.name && playerData.yob) {
      socket.emit("createGame", playerData);
    } else {
      alert("Veuillez remplir tous les champs.");
    }
  });

  joinGameBtn.addEventListener("click", () => {
    const joinData = {
      gameCode: document
        .getElementById("game-code-join")
        .value.trim()
        .toUpperCase(),
      playerData: {
        name: document.getElementById("player-name-join").value.trim(),
        yob: parseInt(document.getElementById("player-yob-join").value),
      },
    };
    if (
      joinData.gameCode &&
      joinData.playerData.name &&
      joinData.playerData.yob
    ) {
      socket.emit("joinGame", joinData);
    } else {
      alert("Veuillez remplir tous les champs.");
    }
  });

  startGameLobbyBtn.addEventListener("click", () => {
    socket.emit("startGame", gameState.gameCode);
  });

  // --- 2. IN-GAME ACTIONS (EMITTERS) ---

  rollDiceBtn.addEventListener("click", () => {
    rollDiceBtn.disabled = true;
    socket.emit("rollDice", { gameCode: gameState.gameCode });
  });

  takeTileBtn.addEventListener("click", () => {
    hideMachineControls();
    socket.emit("takeTiles", { gameCode: gameState.gameCode });
  });

  relaunchBtn.addEventListener("click", () => {
    hideMachineControls();
    socket.emit("relaunchMachine", { gameCode: gameState.gameCode });
  });

  placeBidBtn.addEventListener("click", () => {
    const amount = parseInt(document.getElementById("bid-amount").value);
    socket.emit("placeBid", { gameCode: gameState.gameCode, amount });
  });

  passBidBtn.addEventListener("click", () => {
    socket.emit("passBid", { gameCode: gameState.gameCode });
  });

  confirmSellBtn.addEventListener("click", () => {
    const currentPlayer = gameState.players.find((p) => p.id === myPlayerId);
    if (!currentPlayer) return;

    // Get the actual tile objects to send to the server for validation
    const tilesToSend = selectedTilesForSale.map(
      (index) => currentPlayer.tiles[index]
    );
    socket.emit("sellTiles", {
      gameCode: gameState.gameCode,
      tiles: tilesToSend,
    });
  });

  cancelSellBtn.addEventListener("click", () => {
    hideModal(sellModal);
  });

  document.getElementById("restart-game-btn").addEventListener("click", () => {
    // This simply reloads the page to go back to the main menu
    window.location.reload();
  });

  // --- 3. SOCKET EVENT HANDLERS (LISTENERS) ---

  socket.on("connect", () => {
    console.log("Connected to server with ID:", socket.id);
  });

  socket.on("error", (message) => {
    console.error("Server error:", message);
    alert(`Erreur: ${message}`);
  });

  // Handles joining, creating, and other players joining
  socket.on("lobbyUpdate", (newGameState) => {
    gameState = newGameState;
    // Find our player ID if we don't have it yet
    if (myPlayerId === null) {
      const me = gameState.players.find((p) => p.socketId === socket.id);
      if (me) myPlayerId = me.id;
    }
    renderLobby();
  });

  socket.on("gameStarted", (initialGameState) => {
    gameState = initialGameState;
    mainMenu.classList.add("hidden");
    hideModal(lobbyModal);
    gameContainer.classList.remove("hidden");
    initializeBoard(); // Draw the board once
    renderGame(); // Full initial render
  });

  socket.on("gameStateUpdate", (newGameState) => {
    gameState = newGameState;
    renderGame();
  });

  // --- 4. RENDER & UI FUNCTIONS ---

  function renderLobby() {
    mainMenu.classList.add("hidden");
    showModal(lobbyModal);

    document.getElementById("lobby-game-code").textContent = gameState.gameCode;
    const playerList = document.getElementById("lobby-player-list");
    playerList.innerHTML = "";
    gameState.players.forEach((player) => {
      const li = document.createElement("li");
      li.textContent = `${player.name} ${
        player.socketId === gameState.hostId ? " (Hôte)" : ""
      }`;
      li.style.color = player.color;
      playerList.appendChild(li);
    });

    // Show start button only to the host when there are 2+ players
    const me = gameState.players.find((p) => p.socketId === socket.id);
    if (
      me &&
      me.socketId === gameState.hostId &&
      gameState.players.length >= 2
    ) {
      startGameLobbyBtn.classList.remove("hidden");
    } else {
      startGameLobbyBtn.classList.add("hidden");
    }
  }

  // Master render function, called after every state update
  function renderGame() {
    if (!gameState || !gameState.players) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const me = gameState.players.find((p) => p.id === myPlayerId);

    // Render Players Panel & Pawns
    renderPlayersAndPawns();

    // Render Controls Panel
    playerTurnEl.textContent = `Tour de: ${currentPlayer.name}`;
    playerMoneyEl.textContent = `${me.money}€`;
    diceResultEl.textContent = gameState.lastDiceRoll
      ? `Résultat : ${gameState.lastDiceRoll}`
      : "";
    rollDiceBtn.disabled =
      currentPlayer.id !== myPlayerId || gameState.turnState !== "start";

    // Render Game Log
    gameLogEl.innerHTML = "";
    gameState.gameLog.forEach((msg) => {
      const p = document.createElement("p");
      p.textContent = msg;
      gameLogEl.appendChild(p);
    });

    // Render Machine
    renderMachine();

    // Render Modals based on game status
    renderModals();
  }

  function renderPlayersAndPawns() {
    playersPanel.innerHTML = "";
    const existingPawns = new Set();

    gameState.players.forEach((player) => {
      // Create or update player info panel
      let playerInfoDiv = document.getElementById(`player-info-${player.id}`);
      if (!playerInfoDiv) {
        playerInfoDiv = document.createElement("div");
        playerInfoDiv.id = `player-info-${player.id}`;
        playerInfoDiv.className = "player-info";
        playerInfoDiv.style.borderColor = player.color;
        playerInfoDiv.innerHTML = `
          <h4>${player.name}</h4>
          <p>Argent: <span class="money">${player.money}</span>€</p>
          <div class="player-tile-collection" id="collection-${player.id}"></div>
        `;
        playersPanel.appendChild(playerInfoDiv);
        createPlayerTileCollection(player); // Create the grid layout once
      }
      playerInfoDiv.querySelector(".money").textContent = player.money;
      updatePlayerTileCollection(player); // Update owned status

      // Create or update pawn
      let pawn = document.getElementById(`pawn-${player.id}`);
      if (!pawn) {
        pawn = document.createElement("div");
        pawn.id = `pawn-${player.id}`;
        pawn.className = "pawn";
        pawn.style.backgroundColor = player.color;
        board.appendChild(pawn);
      }
      updatePawnPosition(player, pawn);
      existingPawns.add(pawn.id);
    });

    // Clean up pawns of disconnected players if any
    document.querySelectorAll(".pawn").forEach((p) => {
      if (!existingPawns.has(p.id)) {
        p.remove();
      }
    });
  }

  function renderMachine() {
    machineTilesEl.innerHTML = "";
    if (gameState.machineOffer) {
      gameState.machineOffer.forEach((offer) => {
        const tileDiv = createTileElement(offer.tile, offer.faceUp);
        machineTilesEl.appendChild(tileDiv);
      });
    }

    if (
      gameState.turnState === "machineChoice" &&
      gameState.currentPlayerIndex === myPlayerId
    ) {
      showMachineControls();
    } else {
      hideMachineControls();
    }
  }

  function renderModals() {
    // Hide all modals first
    [auctionModal, stealModal, sellModal, winnerModal].forEach(hideModal);

    // Show the correct modal based on state
    switch (gameState.status) {
      case "auction":
        renderAuctionModal();
        showModal(auctionModal);
        break;
      case "steal":
        renderStealModal();
        showModal(stealModal);
        break;
      case "sell": // This is triggered by a player action, not a game state
        renderSellModal();
        showModal(sellModal);
        break;
      case "finished":
        renderWinnerModal();
        showModal(winnerModal);
        break;
    }
  }

  function renderAuctionModal() {
    const auctionState = gameState.auctionState;
    const auctionTilesEl = auctionModal.querySelector("#auction-tiles");
    auctionTilesEl.innerHTML = "";
    gameState.machineOffer.forEach((offer) => {
      auctionTilesEl.appendChild(createTileElement(offer.tile, true));
    });

    // Find the full player object from the main players list to get their money
    const bidderInfo = auctionState.bidders[auctionState.currentBidderIndex];
    const bidder = gameState.players.find((p) => p.id === bidderInfo.id);

    const auctionInfoEl = auctionModal.querySelector("#auction-info");
    const bidAmountInput = auctionModal.querySelector("#bid-amount");

    const canAct = bidder.id === myPlayerId;
    placeBidBtn.disabled = !canAct;
    bidAmountInput.disabled = !canAct;

    // --- MODIFIED LOGIC ---
    const isObligated = !auctionState.initialBidMade;

    if (canAct && isObligated) {
      auctionInfoEl.textContent = `C'est votre tour. Vous devez faire la première enchère (100€ minimum).`;
      bidAmountInput.value = 100;
      bidAmountInput.min = 100;
    } else {
      auctionInfoEl.textContent = `Au tour de ${
        bidder.name
      }. Enchère actuelle: ${auctionState.highestBid}€ par ${
        auctionState.highestBidderName || "personne"
      }.`;
      bidAmountInput.value = auctionState.highestBid + 100;
      bidAmountInput.min = auctionState.highestBid + 100;
    }

    bidAmountInput.max = bidder.money;

    // Disable the pass button if the player is obligated and can afford to bid
    const canAffordMandatoryBid = bidder.money >= 100;
    passBidBtn.disabled = !canAct || (isObligated && canAffordMandatoryBid);
  }

  function renderStealModal() {
    const stealState = gameState.stealState;
    const thief = gameState.players.find((p) => p.id === stealState.thiefId);
    const victim = gameState.players.find((p) => p.id === stealState.victimId);

    stealModal.querySelector(
      "#steal-info"
    ).textContent = `${thief.name}, choisissez une tuile à voler à ${victim.name}:`;
    const stealOptions = stealModal.querySelector("#steal-options");
    stealOptions.innerHTML = "";

    if (thief.id === myPlayerId) {
      victim.tiles.forEach((tile, index) => {
        const tileDiv = createTileElement(tile);
        tileDiv.style.cursor = "pointer";
        tileDiv.onclick = () => {
          // Send the chosen tile's index to the server
          socket.emit("stealTile", {
            gameCode: gameState.gameCode,
            victimId: victim.id,
            tileIndex: index,
          });
        };
        stealOptions.appendChild(tileDiv);
      });
    } else {
      // Just display face-down tiles for non-thieves
      victim.tiles.forEach(() => {
        const tileDiv = document.createElement("div");
        tileDiv.className = "tile face-down";
        stealOptions.appendChild(tileDiv);
      });
    }
  }

  function openSellModal() {
    // This function now just opens the modal
    if (gameState.status === "finished") return;
    socket.emit("requestSell", { gameCode: gameState.gameCode });
  }

  function renderSellModal() {
    const me = gameState.players.find((p) => p.id === myPlayerId);
    if (!me) return;

    selectedTilesForSale = [];
    let sellTotal = 0;

    sellTilesContainer.innerHTML = "";

    me.tiles.forEach((tile, index) => {
      const tileDiv = createTileElement(tile, true);
      tileDiv.style.cursor = "pointer";
      tileDiv.onclick = () => {
        // Toggle selection locally for UI feedback
        const selectionIndex = selectedTilesForSale.indexOf(index);
        if (selectionIndex > -1) {
          selectedTilesForSale.splice(selectionIndex, 1);
          tileDiv.style.border = "1px solid #333";
          sellTotal -= tile.isSpecial ? 400 : 200;
        } else {
          selectedTilesForSale.push(index);
          tileDiv.style.border = "3px solid #ff0000";
          sellTotal += tile.isSpecial ? 400 : 200;
        }
        sellTotalEl.textContent = `Total: ${sellTotal}€`;
        confirmSellBtn.disabled = selectedTilesForSale.length === 0;
      };
      sellTilesContainer.appendChild(tileDiv);
    });

    sellTotalEl.textContent = "Total: 0€";
    confirmSellBtn.disabled = true;
  }

  function renderWinnerModal() {
    const winner = gameState.winner;
    document.getElementById(
      "winner-message"
    ).textContent = `${winner.name} a gagné ${winner.reason} !`;
  }

  // Create a sell button and add it to the UI
  function setupSellButton() {
    let sellBtn = document.getElementById("sell-tiles-btn");
    if (!sellBtn) {
      sellBtn = document.createElement("button");
      sellBtn.id = "sell-tiles-btn";
      sellBtn.textContent = "Vendre des tuiles";
      sellBtn.onclick = openSellModal;
      controlsPanel.insertBefore(sellBtn, rollDiceBtn);
    }
  }

  // --- 5. UTILITY & HELPER FUNCTIONS (Mostly from original file) ---

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

  function createTileElement(tile, faceUp = true) {
    const tileDiv = document.createElement("div");
    tileDiv.className = "tile";
    tileDiv.style.backgroundColor = tile.color;

    if (faceUp) {
      tileDiv.style.backgroundImage = `url('images/${tile.sign}.png')`;
      tileDiv.title = tile.sign;
      if (tile.isSpecial) {
        tileDiv.classList.add("special-tile");
      }
    } else {
      tileDiv.classList.add("face-down");
    }
    return tileDiv;
  }

  function initializeBoard() {
    // This logic is static, so it only needs to run once.
    // (Copied directly from your original createBoard function)
    board.innerHTML = "";
    const path = [];
    for (let i = 0; i < 10; i++) path.push([0, i]);
    for (let i = 1; i < 10; i++) path.push([i, 9]);
    for (let i = 8; i >= 0; i--) path.push([9, i]);
    for (let i = 8; i > 0; i--) path.push([i, 0]);
    const cells = Array(100)
      .fill(null)
      .map(() => document.createElement("div"));
    const animalColors = {
      Chien: COLORS.GREEN,
      Dragon: COLORS.GREEN,
      Cochon: COLORS.RED,
      Serpent: COLORS.RED,
      Rat: COLORS.BLUE,
      Cheval: COLORS.BLUE,
      Buffle: COLORS.PINK,
      Chevre: COLORS.PINK,
      Singe: COLORS.YELLOW,
      Tigre: COLORS.YELLOW,
      Coq: COLORS.PURPLE,
      Chat: COLORS.PURPLE,
    };
    path.forEach((p, i) => {
      const index = p[0] * 10 + p[1];
      cells[index].className = "cell path";
      cells[index].dataset.id = i;
      if (i % 3 === 1) {
        cells[index].dataset.type = "money";
        const signIndex = Math.floor((i - 1) / 3) % SIGNS.length;
        cells[index].style.backgroundColor = animalColors[SIGNS[signIndex]];
        cells[index].style.backgroundImage = "url('images/Yuan.png')";
      } else {
        const signIndex = Math.floor(i / 3) % SIGNS.length;
        const animalSign = SIGNS[signIndex];
        cells[index].style.backgroundColor = animalColors[animalSign];
        cells[index].dataset.type = "color";
        cells[index].dataset.sign = animalSign;
        cells[index].style.backgroundImage = `url('images/${animalSign}.png')`;
      }
    });
    cells.forEach((cell) => board.appendChild(cell));
  }

  function createPlayerTileCollection(player) {
    const collectionContainer = document.getElementById(
      `collection-${player.id}`
    );
    if (!collectionContainer) return;
    const colorOrder = [
      COLORS.BLUE,
      COLORS.PINK,
      COLORS.YELLOW,
      COLORS.PURPLE,
      COLORS.GREEN,
      COLORS.RED,
    ];
    colorOrder.forEach((color) => {
      const row = document.createElement("div");
      row.className = "player-collection-row";
      SIGNS.forEach((sign) => {
        const tile = { sign, color, isSpecial: false }; // isSpecial isn't needed here
        const tileDiv = createTileElement(tile, true);
        tileDiv.classList.add("player-collection-tile");
        tileDiv.dataset.sign = sign;
        tileDiv.dataset.color = color;
        row.appendChild(tileDiv);
      });
      collectionContainer.appendChild(row);
    });
  }

  function updatePlayerTileCollection(player) {
    const allCollectionTiles = document.querySelectorAll(
      `#collection-${player.id} .player-collection-tile`
    );
    allCollectionTiles.forEach((tileEl) => tileEl.classList.remove("owned"));
    player.tiles.forEach((ownedTile) => {
      const matchingTile = document.querySelector(
        `#collection-${player.id} .player-collection-tile[data-sign="${ownedTile.sign}"][data-color="${ownedTile.color}"]`
      );
      if (matchingTile) {
        matchingTile.classList.add("owned");
      }
    });
  }

  function updatePawnPosition(player, pawnElement) {
    const cell = document.querySelector(`.cell[data-id='${player.position}']`);
    if (!cell) return;
    const cellRect = cell.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const offset = player.id * (pawnElement.offsetWidth + 2);
    pawnElement.style.top = `${cellRect.top - boardRect.top + 5}px`;
    pawnElement.style.left = `${cellRect.left - boardRect.left + offset}px`;
  }

  function showModal(modal) {
    modalBackdrop.classList.remove("hidden");
    modal.classList.remove("hidden");
  }

  function hideModal(modal) {
    modal.classList.add("hidden");
    // Only hide backdrop if no other modals are open
    if (document.querySelectorAll(".modal:not(.hidden)").length === 0) {
      modalBackdrop.classList.add("hidden");
    }
  }

  function showMachineControls() {
    takeTileBtn.classList.remove("hidden");
    relaunchBtn.classList.remove("hidden");
  }

  function hideMachineControls() {
    takeTileBtn.classList.add("hidden");
    relaunchBtn.classList.add("hidden");
  }

  // --- INITIALIZE ---
  setupSellButton();
});
