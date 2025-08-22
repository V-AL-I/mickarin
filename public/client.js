document.addEventListener("DOMContentLoaded", () => {
  // --- SOCKET.IO & STATE ---
  const socket = io();
  let gameState = {};
  let myPlayerId = null;
  let selectedTilesForSale = [];
  let turnTimerInterval = null;

  // --- DOM ELEMENTS ---
  const mainMenu = document.getElementById("main-menu");
  const gameContainer = document.getElementById("game-container");
  const gameInfoFooter = document.getElementById("game-info-footer");
  const turnTimerEl = document.getElementById("turn-timer");
  const leaveGameBtn = document.getElementById("leave-game-btn");
  const leaveLobbyBtn = document.getElementById("leave-lobby-btn"); // --- NEW ---
  // ... other DOM elements are unchanged ...
  const createGameBtn = document.getElementById("create-game-btn");
  const joinGameBtn = document.getElementById("join-game-btn");
  const lobbyModal = document.getElementById("lobby-modal");
  const startGameLobbyBtn = document.getElementById("start-game-btn");
  const board = document.getElementById("board");
  const playersPanel = document.getElementById("players-panel");
  const gameLogEl = document.getElementById("game-log");
  const controlsPanel = document.getElementById("controls-panel");
  const playerTurnEl = document.getElementById("player-turn");
  const playerMoneyEl = document.getElementById("player-money");
  const rollDiceBtn = document.getElementById("roll-dice-btn");
  const diceResultEl = document.getElementById("dice-result");
  const machineTilesEl = document.getElementById("machine-tiles");
  const takeTileBtn = document.getElementById("take-tile-btn");
  const relaunchBtn = document.getElementById("relaunch-btn");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const auctionModal = document.getElementById("auction-modal");
  const stealModal = document.getElementById("steal-modal");
  const sellModal = document.getElementById("sell-modal");
  const winnerModal = document.getElementById("winner-modal");
  const sellTilesContainer = document.getElementById("sell-tiles-container");
  const sellTotalEl = document.getElementById("sell-total");
  const confirmSellBtn = document.getElementById("confirm-sell-btn");
  const cancelSellBtn = document.getElementById("cancel-sell-btn");
  const placeBidBtn = auctionModal.querySelector("#place-bid-btn");
  const passBidBtn = auctionModal.querySelector("#pass-bid-btn");

  // --- EVENT EMITTERS ---
  createGameBtn.addEventListener("click", () => {
    const playerData = {
      name: document.getElementById("player-name-create").value.trim(),
      yob: parseInt(document.getElementById("player-yob-create").value),
    };
    if (playerData.name && playerData.yob) {
      localStorage.setItem("mickarin_player_name", playerData.name);
      localStorage.setItem("mickarin_player_yob", playerData.yob);
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
      localStorage.setItem("mickarin_game_code", joinData.gameCode);
      localStorage.setItem("mickarin_player_name", joinData.playerData.name);
      localStorage.setItem("mickarin_player_yob", joinData.playerData.yob);
      socket.emit("joinGame", joinData);
    } else {
      alert("Veuillez remplir tous les champs.");
    }
  });
  startGameLobbyBtn.addEventListener("click", () => {
    socket.emit("startGame", gameState.gameCode);
  });
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
    const tilesToSend = selectedTilesForSale.map(
      (index) => currentPlayer.tiles[index]
    );
    socket.emit("sellTiles", {
      gameCode: gameState.gameCode,
      tiles: tilesToSend,
    });
    hideModal(sellModal);
  });
  cancelSellBtn.addEventListener("click", () => {
    hideModal(sellModal);
  });
  document.getElementById("restart-game-btn").addEventListener("click", () => {
    clearReconnectData();
    window.location.reload();
  });
  leaveGameBtn.addEventListener("click", () => {
    if (
      confirm(
        "Êtes-vous sûr de vouloir quitter la partie ? Cette action est définitive et vous ne pourrez pas revenir."
      )
    ) {
      clearReconnectData();
      socket.emit("leaveGame", { gameCode: gameState.gameCode });
    }
  });

  // --- NEW: Leave Lobby Emitter ---
  leaveLobbyBtn.addEventListener("click", () => {
    socket.emit("leaveLobby", { gameCode: gameState.gameCode });
    // Immediately return to menu for responsiveness
    hideModal(lobbyModal);
    mainMenu.classList.remove("hidden");
    clearReconnectData();
  });

  // --- EVENT LISTENERS ---
  socket.on("connect", () => {
    console.log("Connected to server with ID:", socket.id);
    attemptReconnect();
  });
  socket.on("error", (message) => {
    console.error("Server error:", message);
    alert(`Erreur: ${message}`);
    if (message === "Game not found." || message.includes("already started")) {
      clearReconnectData();
      mainMenu.classList.remove("hidden");
      gameContainer.classList.add("hidden");
      gameInfoFooter.classList.add("hidden");
    }
  });
  socket.on("lobbyUpdate", (newGameState) => {
    gameState = newGameState;
    localStorage.setItem("mickarin_game_code", newGameState.gameCode);
    if (myPlayerId === null) {
      const me = newGameState.players.find((p) => p.socketId === socket.id);
      if (me) myPlayerId = me.id;
    }
    renderLobby();
  });

  // --- NEW: Lobby Closed Listener ---
  socket.on("lobbyClosed", (message) => {
    alert(message);
    hideModal(lobbyModal);
    mainMenu.classList.remove("hidden");
    clearReconnectData();
  });

  socket.on("gameStarted", (initialGameState) => {
    gameState = initialGameState;
    mainMenu.classList.add("hidden");
    hideModal(lobbyModal);
    gameContainer.classList.remove("hidden");
    gameInfoFooter.classList.remove("hidden");
    initializeBoard();
    renderGame();
  });
  socket.on("reconnectSuccess", (reconnectGameState) => {
    console.log("Successfully reconnected to game!");
    gameState = reconnectGameState;
    const me = reconnectGameState.players.find((p) => p.socketId === socket.id);
    if (me) {
      myPlayerId = me.id;
    }
    mainMenu.classList.add("hidden");
    gameContainer.classList.remove("hidden");
    gameInfoFooter.classList.remove("hidden");
    initializeBoard();
    renderGame();
  });
  socket.on("gameStateUpdate", (newGameState) => {
    gameState = newGameState;
    renderGame();
  });

  // --- RENDER FUNCTIONS ---
  function renderGame() {
    if (!gameState || !gameState.players) return;
    const me = gameState.players.find((p) => p.id === myPlayerId);
    if (!me) {
      if (gameState.status !== "finished") {
        alert("Vous avez été retiré de la partie.");
      }
      clearReconnectData();
      window.location.reload();
      return;
    }
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    renderPlayersAndPawns();
    playerTurnEl.textContent = `Tour de: ${currentPlayer.name}`;
    playerMoneyEl.textContent = `${me.money}€`;
    diceResultEl.textContent = gameState.lastDiceRoll
      ? `Résultat : ${gameState.lastDiceRoll}`
      : "";
    const isMyTurn = currentPlayer.id === myPlayerId;
    rollDiceBtn.disabled =
      !isMyTurn ||
      (gameState.turnState !== "start" && gameState.turnState !== "secondRoll");
    const sellBtn = document.getElementById("sell-tiles-btn");
    if (sellBtn) {
      sellBtn.style.display =
        isMyTurn && gameState.turnState === "start" ? "block" : "none";
    }
    gameLogEl.innerHTML = "";
    (gameState.gameLog || []).forEach((msg) => {
      const p = document.createElement("p");
      p.textContent = msg;
      gameLogEl.prepend(p);
    });
    const footerCodeEl = document.getElementById("footer-game-code");
    if (footerCodeEl) footerCodeEl.textContent = gameState.gameCode;
    updateTurnTimer();
    renderMachine();
    renderModals();
  }

  // All other functions are unchanged...
  function updateTurnTimer() {
    if (turnTimerInterval) {
      clearInterval(turnTimerInterval);
    }
    if (gameState.status !== "in-progress" || !gameState.turnEndTime) {
      turnTimerEl.style.display = "none";
      return;
    }
    turnTimerEl.style.display = "inline-block";
    turnTimerInterval = setInterval(() => {
      const remaining = Math.round((gameState.turnEndTime - Date.now()) / 1000);
      if (remaining <= 0) {
        turnTimerEl.textContent = "0s";
        clearInterval(turnTimerInterval);
      } else {
        turnTimerEl.textContent = `${remaining}s`;
      }
    }, 500);
  }
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
  function renderPlayersAndPawns() {
    playersPanel.innerHTML = "";
    const existingPawns = new Set();
    gameState.players.forEach((player) => {
      let playerInfoDiv = document.getElementById(`player-info-${player.id}`);
      if (!playerInfoDiv) {
        playerInfoDiv = document.createElement("div");
        playerInfoDiv.id = `player-info-${player.id}`;
        playerInfoDiv.className = "player-info";
        playerInfoDiv.style.borderColor = player.color;
        playerInfoDiv.innerHTML = `<h4>${player.name}</h4><p>Argent: <span class="money">${player.money}</span></p><div class="player-tile-collection" id="collection-${player.id}"></div>`;
        playersPanel.appendChild(playerInfoDiv);
        createPlayerTileCollection(player);
      }
      playerInfoDiv.querySelector(".money").textContent =
        typeof player.money === "number" ? `${player.money}€` : "???";
      updatePlayerTileCollection(player);
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
    [auctionModal, stealModal, sellModal, winnerModal].forEach(hideModal);
    switch (gameState.status) {
      case "auction":
        renderAuctionModal();
        showModal(auctionModal);
        break;
      case "steal":
        renderStealModal();
        showModal(stealModal);
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
    const bidderInfo = auctionState.bidders[auctionState.currentBidderIndex];
    const bidder = gameState.players.find((p) => p.id === bidderInfo.id);
    const auctionInfoEl = auctionModal.querySelector("#auction-info");
    const bidAmountInput = auctionModal.querySelector("#bid-amount");
    const canAct = bidder.id === myPlayerId;
    placeBidBtn.disabled = !canAct;
    bidAmountInput.disabled = !canAct;
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
    const canAffordMandatoryBid = bidder.money >= 100;
    passBidBtn.disabled = !canAct || (isObligated && canAffordMandatoryBid);
  }
  function renderStealModal() {
    const stealState = gameState.stealState;
    if (!stealState) return;
    const thief = gameState.players.find((p) => p.id === stealState.thiefId);
    const victim = gameState.players.find(
      (p) => p.id === stealState.victimQueue[0]
    );
    if (!thief || !victim) {
      hideModal(stealModal);
      return;
    }
    stealModal.querySelector(
      "#steal-info"
    ).textContent = `${thief.name}, choisissez une tuile à voler à ${victim.name}:`;
    const stealOptions = stealModal.querySelector("#steal-options");
    stealOptions.innerHTML = "";
    if (thief.id === myPlayerId) {
      if (victim.tiles.length === 0) {
        stealOptions.innerHTML = `<p>${victim.name} n'a pas de tuiles à voler.</p>`;
      } else {
        victim.tiles.forEach((tile, index) => {
          const tileDiv = createTileElement(tile, true);
          tileDiv.style.cursor = "pointer";
          tileDiv.onclick = () => {
            stealOptions
              .querySelectorAll(".tile")
              .forEach((t) => (t.onclick = null));
            socket.emit("stealTile", {
              gameCode: gameState.gameCode,
              victimId: victim.id,
              tileIndex: index,
            });
          };
          stealOptions.appendChild(tileDiv);
        });
      }
    } else {
      victim.tiles.forEach(() => {
        const tileDiv = createTileElement({}, false);
        stealOptions.appendChild(tileDiv);
      });
    }
  }
  function openSellModal() {
    if (gameState.status === "finished" || gameState.turnState !== "start")
      return;
    renderSellModal();
    showModal(sellModal);
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
    clearReconnectData();
  }
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
  const SIGN_ORDER_DISPLAY = [
    "Rat",
    "Buffle",
    "Tigre",
    "Chat",
    "Dragon",
    "Serpent",
    "Cheval",
    "Chevre",
    "Singe",
    "Coq",
    "Chien",
    "Cochon",
  ];
  function isTileSpecial_client(sign, color) {
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
  function createTileElement(tile, faceUp = true) {
    const tileDiv = document.createElement("div");
    tileDiv.className = "tile";
    if (tile.color) tileDiv.style.backgroundColor = tile.color;
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
      const signIndex = Math.floor(i / 3) % SIGNS.length;
      const animalSign = SIGNS[signIndex];
      cells[index].dataset.sign = animalSign;
      cells[index].style.backgroundColor = animalColors[animalSign];
      if (i % 3 === 1) {
        cells[index].dataset.type = "money";
        cells[index].style.backgroundImage = "url('images/Yuan.png')";
      } else {
        cells[index].dataset.type = "color";
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
    collectionContainer.innerHTML = "";
    colorOrder.forEach((color) => {
      const row = document.createElement("div");
      row.className = "player-collection-row";
      SIGN_ORDER_DISPLAY.forEach((sign) => {
        const tile = { sign, color };
        const tileDiv = createTileElement(tile, true);
        tileDiv.classList.add("player-collection-tile");
        if (isTileSpecial_client(sign, color)) {
          tileDiv.classList.add("special-tile");
        }
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
  function attemptReconnect() {
    const gameCode = localStorage.getItem("mickarin_game_code");
    const name = localStorage.getItem("mickarin_player_name");
    const yob = localStorage.getItem("mickarin_player_yob");
    if (gameCode && name && yob) {
      console.log(
        `Found saved game data. Attempting to reconnect to ${gameCode}...`
      );
      mainMenu.classList.add("hidden");
      socket.emit("joinGame", {
        gameCode,
        playerData: { name, yob: parseInt(yob) },
      });
    }
  }
  function clearReconnectData() {
    localStorage.removeItem("mickarin_game_code");
    localStorage.removeItem("mickarin_player_name");
    localStorage.removeItem("mickarin_player_yob");
    console.log("Cleared reconnection data.");
  }
  setupSellButton();
});
