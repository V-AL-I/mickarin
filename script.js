document.addEventListener("DOMContentLoaded", () => {
  // --- CONSTANTES ET CONFIGURATION ---
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

  const RED = "#b81425";
  const YELLOW = "#ffd000";
  const GREEN = "#2c8c27";
  const BLUE = "#1175f7";
  const PINK = "#de4ed9";
  const PURPLE = "#732da8";

  const BOARD_SIZE = 36; // 10x10 grid perimeter minus corners = 36 cells
  const STARTING_MONEY = 2500;

  // --- VARIABLES D'ÉTAT DU JEU ---
  let players = [];
  let currentPlayerIndex = 0;
  let tileMachine = [];
  let gameInProgress = false;
  let machineOffer = [];

  // --- ÉLÉMENTS DU DOM ---
  const board = document.getElementById("board");
  const playersPanel = document.getElementById("players-panel");
  const rollDiceBtn = document.getElementById("roll-dice-btn");
  const playerTurnEl = document.getElementById("player-turn");
  const playerMoneyEl = document.getElementById("player-money");
  const diceResultEl = document.getElementById("dice-result");
  const gameLogEl = document.getElementById("game-log");

  // Machine elements
  const machineTilesEl = document.getElementById("machine-tiles");
  const takeTileBtn = document.getElementById("take-tile-btn");
  const relaunchBtn = document.getElementById("relaunch-btn");

  // Modal elements
  const modalBackdrop = document.getElementById("modal-backdrop");
  const setupModal = document.getElementById("setup-modal");
  const playerCountInput = document.getElementById("player-count");
  const setupPlayersBtn = document.getElementById("setup-players-btn");
  const playersSetup = document.getElementById("players-setup");
  const playersInputs = document.getElementById("players-inputs");
  const startGameBtn = document.getElementById("start-game-btn");
  const auctionModal = document.getElementById("auction-modal");
  const stealModal = document.getElementById("steal-modal");
  const sellModal = document.getElementById("sell-modal");
  const winnerModal = document.getElementById("winner-modal");

  const sellTilesContainer = document.getElementById("sell-tiles-container");
  const sellTotalEl = document.getElementById("sell-total");
  const confirmSellBtn = document.getElementById("confirm-sell-btn");
  const cancelSellBtn = document.getElementById("cancel-sell-btn");

  // --- CLASSES DU JEU ---
  class Player {
    constructor(id, name, color, yob) {
      this.id = id;
      this.name = name;
      this.color = color;
      this.yob = yob;
      this.money = STARTING_MONEY;
      this.position = this.getStartingPosition(yob);
      this.tiles = [];
      this.pawn = null;
      this.infoEl = null;
      this.collectionEl = null;
    }

    getStartingPosition(yob) {
      return (yob % 12) * 3;
    }

    addTile(tile) {
      this.tiles.push(tile);
      this.updatePlayerInfo();
      updatePlayerTileCollections(); // Update collection display

      if (gameInProgress && checkForWinner(this)) {
        return; // Game has ended, stop processing
      }
    }

    removeTile(tileToRemove) {
      this.tiles = this.tiles.filter((tile) => tile !== tileToRemove);
      this.updatePlayerInfo();
      updatePlayerTileCollections(); // Update collection display
    }

    getOwnedSigns() {
      const signCounts = this.tiles.reduce((acc, tile) => {
        acc[tile.sign] = (acc[tile.sign] || 0) + 1;
        return acc;
      }, {});
      return Object.keys(signCounts).filter((sign) => signCounts[sign] >= 3);
    }

    updatePlayerInfo() {
      if (!this.infoEl) return;
      this.infoEl.querySelector(".money").textContent = this.money;
    }
  }

  class Tile {
    constructor(sign, color) {
      this.sign = sign;
      this.color = color;
      this.imagePath = `images/${sign}.png`; // Path to the PNG file
      this.isSpecial = this.checkIfSpecial(sign, color);
    }

    checkIfSpecial(sign, color) {
      const specialTiles = [
        { sign: "Dragon", color: GREEN }, // green
        { sign: "Chien", color: GREEN }, // green
        { sign: "Chevre", color: PINK }, // pink
        { sign: "Buffle", color: PINK }, // pink
        { sign: "Singe", color: YELLOW }, // yellow
        { sign: "Tigre", color: YELLOW }, // yellow
        { sign: "Rat", color: BLUE }, // blue
        { sign: "Cheval", color: BLUE }, // blue
        { sign: "Cochon", color: RED }, // red
        { sign: "Serpent", color: RED }, // red
        { sign: "Chat", color: PURPLE }, // purple
        { sign: "Coq", color: PURPLE }, // purple
      ];

      return specialTiles.some(
        (special) => special.sign === sign && special.color === color
      );
    }
  }

  // Helper function to create tile DOM elements with images
  function createTileElement(tile, faceUp = true) {
    const tileDiv = document.createElement("div");
    tileDiv.className = "tile";

    // Always set the background color
    tileDiv.style.backgroundColor = tile.color;

    if (faceUp) {
      tileDiv.style.backgroundImage = `url('${tile.imagePath}')`;
      tileDiv.title = tile.sign;
      // Fallback text if image doesn't load
      tileDiv.textContent = tile.sign.substring(0, 1);

      // Add special outline if it's a special tile and face up
      if (tile.isSpecial) {
        tileDiv.classList.add("special-tile");
      }
    } else {
      tileDiv.classList.add("face-down");
      // No image or text for face-down tiles, just the color
      // Special outline is NOT shown when face down
    }

    return tileDiv;
  }

  // --- CONFIGURATION DES JOUEURS ---
  function setupPlayerInputs() {
    const playerCount = parseInt(playerCountInput.value);
    if (playerCount < 2 || playerCount > 8) {
      alert("Veuillez choisir entre 2 et 8 joueurs.");
      return;
    }

    playersInputs.innerHTML = "";
    const playerColors = [
      "#d90429", // red
      "#0077b6", // blue
      "#fca311", // orange
      "#588157", // green
      "#6f1d1b", // dark red
      "#432818", // brown
      "#99582a", // tan
      "#6a4c93", // purple
    ];

    for (let i = 0; i < playerCount; i++) {
      const playerDiv = document.createElement("div");
      playerDiv.className = "player-input";
      playerDiv.style.borderColor = playerColors[i];
      playerDiv.innerHTML = `
        <h4>Joueur ${i + 1}</h4>
        <label for="player-name-${i}">Nom:</label>
        <input type="text" id="player-name-${i}" placeholder="Entrez votre nom" required>
        <label for="player-yob-${i}">Année de naissance:</label>
        <input type="number" id="player-yob-${i}" placeholder="Ex: 1990" min="1000" max="9999" required>
      `;
      playersInputs.appendChild(playerDiv);
    }

    playersSetup.classList.remove("hidden");
  }

  function validateAndCreatePlayers() {
    const playerCount = parseInt(playerCountInput.value);
    const playerColors = [
      "#d90429", // red
      "#0077b6", // blue
      "#fca311", // orange
      "#588157", // green
      "#6f1d1b", // dark red
      "#432818", // brown
      "#99582a", // tan
      "#6a4c93", // purple
    ];
    const playerData = [];

    // Validate all inputs
    for (let i = 0; i < playerCount; i++) {
      const nameInput = document.getElementById(`player-name-${i}`);
      const yobInput = document.getElementById(`player-yob-${i}`);

      const name = nameInput.value.trim();
      const yob = parseInt(yobInput.value);

      if (!name) {
        alert(`Veuillez entrer un nom pour le Joueur ${i + 1}.`);
        nameInput.focus();
        return false;
      }

      if (!yob || yob < 1000 || yob > 9999) {
        alert(
          `Veuillez entrer une année de naissance valide (4 chiffres) pour ${name}.`
        );
        yobInput.focus();
        return false;
      }

      playerData.push({ name, yob, color: playerColors[i] });
    }

    // Check for duplicate names
    const names = playerData.map((p) => p.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      alert("Les noms des joueurs doivent être différents.");
      return false;
    }

    // Create players
    players = [];
    playerData.forEach((data, i) => {
      players.push(new Player(i, data.name, data.color, data.yob));
    });

    return true;
  }

  // --- INITIALISATION DU JEU ---
  function initializeGame() {
    if (!validateAndCreatePlayers()) {
      return;
    }

    createBoard();
    createTileMachine();
    setupUI();
    gameInProgress = true;
    currentPlayerIndex = 0;
    hideModal(setupModal);
    startTurn();
  }

  function createTileMachine() {
    tileMachine = [];

    // Define the 6 base colors for tiles
    const tileColors = [
      RED, // red
      PINK, // orange
      YELLOW, // yellow
      GREEN, // green
      BLUE, // blue
      PURPLE, // purple
    ];

    // Create one tile for each animal-color combination
    for (const sign of SIGNS) {
      for (const color of tileColors) {
        tileMachine.push(new Tile(sign, color));
      }
    }

    // Shuffle the machine
    for (let i = tileMachine.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tileMachine[i], tileMachine[j]] = [tileMachine[j], tileMachine[i]];
    }

    console.log(`Machine créée avec ${tileMachine.length} tuiles`); // Should be 72 tiles
  }

  function createBoard() {
    board.innerHTML = "";
    const path = [];
    for (let i = 0; i < 10; i++) path.push([0, i]);
    for (let i = 1; i < 10; i++) path.push([i, 9]);
    for (let i = 8; i >= 0; i--) path.push([9, i]);
    for (let i = 8; i > 0; i--) path.push([i, 0]);

    const cells = Array(100)
      .fill(null)
      .map(() => document.createElement("div"));

    // Define animal-color mapping
    const animalColors = {
      Chien: GREEN, // green
      Dragon: GREEN, // green
      Cochon: RED, // red
      Serpent: RED, // red
      Rat: BLUE, // blue
      Cheval: BLUE, // blue
      Buffle: PINK, // pink
      Chevre: PINK, // pink
      Singe: YELLOW, // yellow
      Tigre: YELLOW, // yellow
      Coq: PURPLE, // purple
      Chat: PURPLE, // purple
    };

    path.forEach((p, i) => {
      const index = p[0] * 10 + p[1];
      cells[index].className = "cell path";
      cells[index].dataset.id = i;

      // Assign colors and special properties
      if (i === 1 || (i > 1 && (i - 1) % 3 === 0)) {
        // Money cells
        cells[index].dataset.type = "money";
        const signIndex = Math.floor(i / 3) % SIGNS.length;
        const animalSign = SIGNS[signIndex];
        cells[index].style.backgroundColor = animalColors[animalSign];

        // Add Yuan image for money cells
        cells[index].style.backgroundImage = "url('images/Yuan.png')";
        cells[index].style.backgroundSize = "contain";
        cells[index].style.backgroundRepeat = "no-repeat";
        cells[index].style.backgroundPosition = "center";
        cells[index].textContent = ""; // Remove € symbol
      } else {
        // Animal cells
        const signIndex = Math.floor(i / 3) % SIGNS.length;
        const animalSign = SIGNS[signIndex];
        const animalColor = animalColors[animalSign];

        cells[index].style.backgroundColor = animalColor;
        cells[index].dataset.type = "color";
        cells[index].dataset.color = animalColor;
        cells[index].dataset.sign = animalSign;

        // Add animal image for color cells
        cells[index].style.backgroundImage = `url('images/${animalSign}.png')`;
        cells[index].style.backgroundSize = "contain";
        cells[index].style.backgroundRepeat = "no-repeat";
        cells[index].style.backgroundPosition = "center";
        cells[index].textContent = ""; // Remove animal text
      }
    });

    cells.forEach((cell) => board.appendChild(cell));
  }

  function setupUI() {
    playersPanel.innerHTML = "";
    players.forEach((player) => {
      const div = document.createElement("div");
      div.className = "player-info";
      div.style.borderColor = player.color;
      div.innerHTML = `
          <h4>${player.name}</h4>
          <p>Argent: <span class="money">${player.money}</span>€</p>
          <div class="player-tile-collection"></div>
      `;
      player.infoEl = div;
      player.collectionEl = div.querySelector(".player-tile-collection");
      playersPanel.appendChild(div);

      // Player pawn
      const pawn = document.createElement("div");
      pawn.className = "pawn";
      pawn.style.backgroundColor = player.color;
      player.pawn = pawn;
      board.appendChild(pawn);
      updatePawnPosition(player);

      // Create individual tile collection for this player
      createPlayerTileCollection(player);
    });
  }

  function createPlayerTileCollection(player) {
    const collectionContainer = player.collectionEl;

    // Define the order as specified
    const colorOrder = [
      BLUE, // "#1175f7"
      PINK, // "#de4ed9"
      YELLOW, // "#ffd000"
      PURPLE, // "#732da8"
      GREEN, // "#2c8c27"
      RED, // "#b81425"
    ]; // blue, pink, yellow, purple, green, red
    const signOrder = [
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
    ]; // mouse, buffalo, tiger, cat, dragon, snake, horse, goat, monkey, rooster, dog, pig

    colorOrder.forEach((color) => {
      const colorRow = document.createElement("div");
      colorRow.className = "player-collection-row";

      signOrder.forEach((sign) => {
        const tile = new Tile(sign, color);
        const tileDiv = createTileElement(tile, true);
        tileDiv.classList.add("player-collection-tile");
        tileDiv.dataset.sign = sign;
        tileDiv.dataset.color = color;
        tileDiv.dataset.playerId = player.id;
        colorRow.appendChild(tileDiv);
      });

      collectionContainer.appendChild(colorRow);
    });
  }

  function updatePlayerTileCollections() {
    players.forEach((player) => {
      const playerCollectionTiles = document.querySelectorAll(
        `.player-collection-tile[data-player-id="${player.id}"]`
      );

      // Debug log to see if tiles are found
      console.log(
        `Player ${player.name} (ID: ${player.id}) has ${playerCollectionTiles.length} collection tiles`
      );

      // Reset all tiles to low opacity for this player
      playerCollectionTiles.forEach((tile) => {
        tile.classList.remove("owned");
        tile.style.border = tile.classList.contains("special-tile")
          ? "2px dotted gold"
          : "1px solid #333";
        tile.style.boxShadow = "";
      });

      // Mark owned tiles for this player
      player.tiles.forEach((playerTile) => {
        const matchingTile = document.querySelector(
          `.player-collection-tile[data-player-id="${player.id}"][data-sign="${playerTile.sign}"][data-color="${playerTile.color}"]`
        );

        console.log(
          `Looking for tile: ${playerTile.sign} ${playerTile.color} for player ${player.id}`,
          matchingTile
        );

        if (matchingTile) {
          matchingTile.classList.add("owned");
          // Add player color border
          matchingTile.style.border = `2px solid ${player.color}`;
          // Keep special tile gold border if it's special
          if (matchingTile.classList.contains("special-tile")) {
            matchingTile.style.border = `2px dotted gold`;
            matchingTile.style.boxShadow = `0 0 3px rgba(255, 215, 0, 0.8), 0 0 0 1px ${player.color}`;
          }
        }
      });
    });
  }

  // --- GESTION DES TOURS ---
  function startTurn() {
    const currentPlayer = players[currentPlayerIndex];
    logMessage(`C'est au tour de ${currentPlayer.name}.`);
    playerTurnEl.textContent = `Tour de: ${currentPlayer.name}`;
    playerMoneyEl.textContent = `${currentPlayer.money}€`;
    rollDiceBtn.disabled = false;
    diceResultEl.textContent = "";

    // Remove any existing event listeners and set to normal roll behavior
    rollDiceBtn.onclick = null;
    rollDiceBtn.onclick = rollDice;
  }

  function endTurn() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    startTurn();
  }

  // --- VENTE DE TUILES ---
  let tilesToSell = [];
  let sellTotal = 0;

  function openSellModal() {
    const currentPlayer = players[currentPlayerIndex];

    if (currentPlayer.tiles.length === 0) {
      alert("Vous n'avez pas de tuiles à vendre.");
      return;
    }

    tilesToSell = [];
    sellTotal = 0;
    updateSellTotal();

    sellTilesContainer.innerHTML = "";

    currentPlayer.tiles.forEach((tile, index) => {
      const tileDiv = createTileElement(tile, true);
      tileDiv.style.cursor = "pointer";
      tileDiv.style.margin = "5px";
      tileDiv.style.position = "relative";
      tileDiv.dataset.tileIndex = index;

      // Add price indicator
      const priceLabel = document.createElement("div");
      priceLabel.style.position = "absolute";
      priceLabel.style.bottom = "2px";
      priceLabel.style.right = "2px";
      priceLabel.style.backgroundColor = "rgba(0,0,0,0.7)";
      priceLabel.style.color = "white";
      priceLabel.style.fontSize = "10px";
      priceLabel.style.padding = "2px";
      priceLabel.style.borderRadius = "3px";
      priceLabel.textContent = tile.isSpecial ? "400€" : "200€";
      tileDiv.appendChild(priceLabel);

      tileDiv.onclick = () => toggleTileForSale(tile, tileDiv, index);
      sellTilesContainer.appendChild(tileDiv);
    });

    showModal(sellModal);
  }

  function toggleTileForSale(tile, tileDiv, index) {
    if (tilesToSell.includes(index)) {
      // Remove from sale
      tilesToSell = tilesToSell.filter((i) => i !== index);
      tileDiv.style.border = "1px solid #333";
      tileDiv.style.opacity = "1";
      sellTotal -= tile.isSpecial ? 400 : 200;
    } else {
      // Add to sale
      tilesToSell.push(index);
      tileDiv.style.border = "3px solid #ff0000";
      tileDiv.style.opacity = "0.7";
      sellTotal += tile.isSpecial ? 400 : 200;
    }

    updateSellTotal();
  }

  function updateSellTotal() {
    sellTotalEl.textContent = `Total: ${sellTotal}€`;
    confirmSellBtn.disabled = tilesToSell.length === 0;
  }

  function confirmSell() {
    const currentPlayer = players[currentPlayerIndex];

    if (tilesToSell.length === 0) return;

    // Sort indices in descending order to remove from end first
    const sortedIndices = tilesToSell.sort((a, b) => b - a);

    sortedIndices.forEach((index) => {
      const tile = currentPlayer.tiles[index];
      logMessage(
        `${currentPlayer.name} vend une tuile ${tile.sign} pour ${
          tile.isSpecial ? 400 : 200
        }€.`
      );
      currentPlayer.tiles.splice(index, 1);
    });

    currentPlayer.money += sellTotal;
    currentPlayer.updatePlayerInfo();
    updatePlayerTileCollections();

    // Update the current player money display in controls panel
    playerMoneyEl.textContent = `${currentPlayer.money}€`;

    logMessage(
      `${currentPlayer.name} gagne ${sellTotal}€ en vendant ${tilesToSell.length} tuile(s).`
    );

    hideModal(sellModal);
    tilesToSell = [];
    sellTotal = 0;
  }

  function cancelSell() {
    hideModal(sellModal);
    tilesToSell = [];
    sellTotal = 0;
  }

  // --- GESTION DES TOURS ---
  function startTurn() {
    const currentPlayer = players[currentPlayerIndex];
    logMessage(`C'est au tour de ${currentPlayer.name}.`);
    playerTurnEl.textContent = `Tour de: ${currentPlayer.name}`;
    playerMoneyEl.textContent = `${currentPlayer.money}€`;
    rollDiceBtn.disabled = false;
    diceResultEl.textContent = "";

    // Remove any existing event listeners and set to normal roll behavior
    rollDiceBtn.onclick = null;
    rollDiceBtn.onclick = rollDice;

    // Show sell button
    showSellButton();
  }

  function showSellButton() {
    // Add sell button if it doesn't exist
    let sellBtn = document.getElementById("sell-tiles-btn");
    if (!sellBtn) {
      sellBtn = document.createElement("button");
      sellBtn.id = "sell-tiles-btn";
      sellBtn.textContent = "Vendre des tuiles";
      sellBtn.onclick = openSellModal;

      const controlsPanel = document.getElementById("controls-panel");
      const rollDiceBtn = document.getElementById("roll-dice-btn");
      controlsPanel.insertBefore(sellBtn, rollDiceBtn);
    }
    sellBtn.style.display = "block";
  }

  function hideSellButton() {
    const sellBtn = document.getElementById("sell-tiles-btn");
    if (sellBtn) {
      sellBtn.style.display = "none";
    }
  }

  // --- LOGIQUE DU JEU ---
  function rollDice() {
    rollDiceBtn.disabled = true;
    hideSellButton();
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    diceResultEl.textContent = `Résultat : ${diceRoll}`;
    logMessage(`${players[currentPlayerIndex].name} a fait un ${diceRoll}.`);
    movePlayer(diceRoll);
  }

  function movePlayer(steps, isSecondRoll = false) {
    const player = players[currentPlayerIndex];
    const oldPosition = player.position;

    // Disable dice button during movement
    rollDiceBtn.disabled = true;

    // Calculate the path of movement
    const movementPath = [];
    for (let i = 1; i <= steps; i++) {
      movementPath.push((oldPosition + i) % BOARD_SIZE);
    }

    // Animate movement through each position
    let currentStep = 0;

    function animateStep() {
      if (currentStep < movementPath.length) {
        player.position = movementPath[currentStep];
        updatePawnPosition(player);
        currentStep++;

        // Continue to next step after 200ms
        setTimeout(animateStep, 400);
      } else {
        // Movement complete, handle game logic
        handleMovementComplete(oldPosition, isSecondRoll);
      }
    }

    // Start the animation
    animateStep();
  }

  function handleMovementComplete(oldPosition, isSecondRoll) {
    const player = players[currentPlayerIndex];
    let overtakenPlayers = [];

    // Check for overtaking (only on first roll)
    if (!isSecondRoll) {
      players.forEach((otherPlayer) => {
        if (otherPlayer !== player) {
          const passed =
            (oldPosition < otherPlayer.position &&
              player.position >= otherPlayer.position) ||
            (oldPosition > player.position &&
              (oldPosition < otherPlayer.position ||
                player.position >= otherPlayer.position));
          if (passed) {
            overtakenPlayers.push(otherPlayer);
          }
        }
      });
    }

    // Handle overtaking
    if (overtakenPlayers.length > 0) {
      logMessage(
        `${player.name} a dépassé ${overtakenPlayers
          .map((p) => p.name)
          .join(", ")} !`
      );

      // Steal from each overtaken player
      overtakenPlayers.forEach((victim) => {
        handleSteal(player, victim);
      });

      // Roll again after stealing - no cell action
      setTimeout(() => {
        logMessage(
          `${player.name} relance le dé après avoir dépassé des joueurs.`
        );
        rollDiceBtn.disabled = false;
        rollDiceBtn.onclick = () => {
          rollDiceBtn.disabled = true;
          const secondRoll = Math.floor(Math.random() * 6) + 1;
          diceResultEl.textContent = `Résultat (2ème lancer) : ${secondRoll}`;
          logMessage(
            `${player.name} a fait un ${secondRoll} au second lancer.`
          );
          movePlayer(secondRoll, true); // Second roll
          // Reset to normal roll behavior after second roll
          rollDiceBtn.onclick = rollDice;
        };
      }, 500); // Small delay after movement animation
    } else {
      // No overtaking, handle normal cell action
      setTimeout(() => handleCellAction(isSecondRoll), 500);
    }
  }

  function handleCellAction(isSecondRoll = false) {
    const player = players[currentPlayerIndex];
    const cell = document.querySelector(`.cell[data-id='${player.position}']`);
    const cellType = cell.dataset.type;

    // Check for rent (always applies)
    const cellSign = cell.dataset.sign;
    if (cellSign) {
      const owner = players.find(
        (p) => p !== player && p.getOwnedSigns().includes(cellSign)
      );
      if (owner) {
        let rent = 50; // Base rent

        // Check if owner has 3+ tiles of this animal (monopoly)
        const ownedSignTiles = owner.tiles.filter(
          (tile) => tile.sign === cellSign
        );
        if (ownedSignTiles.length >= 3) {
          rent = 200; // Monopoly rent

          // Check if any of the 3+ tiles is a special tile
          const hasSpecialTile = ownedSignTiles.some((tile) => tile.isSpecial);
          if (hasSpecialTile) {
            rent = 400; // Special monopoly rent
          }
        }

        logMessage(
          `${player.name} paie un loyer de ${rent}€ à ${owner.name} pour le signe ${cellSign}.`
        );
        player.money -= rent;
        owner.money += rent;
        owner.updatePlayerInfo();
        player.updatePlayerInfo();
      }
    }

    // Handle cell effects (no money or machine on second roll after overtaking)
    if (cellType === "money" && !isSecondRoll) {
      const amount = 100;
      player.money += amount;
      logMessage(`${player.name} gagne ${amount}€.`);
      player.updatePlayerInfo();
      endTurn();
    } else if (cellType === "color" && !isSecondRoll) {
      logMessage(`${player.name} atterrit sur une case colorée.`);
      startMachineProcess();
    } else {
      // Start/other cells or second roll after overtaking - just end turn
      if (isSecondRoll) {
        logMessage(
          `${player.name} termine son tour (second lancer après dépassement).`
        );
      }
      endTurn(); // Add missing parentheses here
    }
  }

  function handleSteal(thief, victim) {
    if (victim.tiles.length === 0) {
      logMessage(`${victim.name} n'a pas de tuiles à voler.`);
      return;
    }

    // Show steal modal with tile choices
    stealModal.querySelector(
      "#steal-info"
    ).textContent = `${thief.name}, choisissez une tuile à voler à ${victim.name}:`;

    const stealOptions = stealModal.querySelector("#steal-options");
    stealOptions.innerHTML = "";

    victim.tiles.forEach((tile) => {
      const tileDiv = createTileElement(tile);
      tileDiv.style.cursor = "pointer";
      tileDiv.onclick = () => {
        logMessage(
          `${thief.name} vole une tuile ${tile.sign} à ${victim.name}.`
        );
        victim.removeTile(tile);
        thief.addTile(tile);
        hideModal(stealModal);
      };
      stealOptions.appendChild(tileDiv);
    });

    showModal(stealModal);
  }

  // --- LOGIQUE DE LA MACHINE ---
  function startMachineProcess() {
    machineOffer = [];
    drawFromMachine();
  }

  function drawFromMachine() {
    if (tileMachine.length === 0) {
      logMessage("La machine est vide !");
      endTurn();
      return;
    }

    const tile = tileMachine.pop();
    const faceUp = Math.random() < 0.5;

    machineOffer.push({ tile, faceUp });
    updateMachineUI();

    if (machineOffer.length > 1 && faceUp) {
      // Face up on a relaunch -> Auction!
      logMessage("Tuile face visible ! Le lot part aux enchères !");
      hideMachineControls();
      startAuction();
    } else {
      // Standard draw or face down on relaunch -> Player choice
      showMachineControls();
    }
  }

  function playerTakesTiles() {
    const player = players[currentPlayerIndex];

    // Check if there are any face-down tiles to reveal
    const faceDownTiles = machineOffer.filter((offer) => !offer.faceUp);

    if (faceDownTiles.length > 0) {
      // Show face-down tiles before taking them
      revealFaceDownTiles(faceDownTiles, () => {
        // After revealing, add all tiles to player
        machineOffer.forEach((offer) => player.addTile(offer.tile));
        logMessage(
          `${player.name} prend ${machineOffer.length} tuile(s) gratuitement.`
        );
        hideMachineControls();
        machineOffer = [];
        updateMachineUI();
        player.updatePlayerInfo();
        endTurn();
      });
    } else {
      // No face-down tiles, proceed normally
      machineOffer.forEach((offer) => player.addTile(offer.tile));
      logMessage(
        `${player.name} prend ${machineOffer.length} tuile(s) gratuitement.`
      );
      hideMachineControls();
      machineOffer = [];
      updateMachineUI();
      player.updatePlayerInfo();
      endTurn();
    }
  }

  // --- ENCHÈRES ---
  let auctionBidders,
    currentBidderIndex,
    highestBid,
    highestBidder,
    auctionPasses,
    initialBidderMadeBid;

  function startAuction() {
    auctionBidders = [...players];
    currentBidderIndex = currentPlayerIndex; // Start with the player who pulled the tiles
    highestBid = 0;
    highestBidder = null;
    auctionPasses = 0;
    initialBidderMadeBid = false;

    auctionModal.querySelector("#auction-tiles").innerHTML = "";
    machineOffer.forEach((offer) => {
      const tileDiv = createTileElement(offer.tile);
      auctionModal.querySelector("#auction-tiles").appendChild(tileDiv);
    });

    showModal(auctionModal);
    promptNextBidder();
  }

  function promptNextBidder() {
    if (auctionPasses >= players.length - 1 && highestBidder) {
      endAuction();
      return;
    }

    const bidder = auctionBidders[currentBidderIndex];
    if (!bidder) {
      // Player already passed
      currentBidderIndex = (currentBidderIndex + 1) % auctionBidders.length;
      promptNextBidder();
      return;
    }

    const isInitialBidder =
      currentBidderIndex === currentPlayerIndex && !initialBidderMadeBid;
    const minimumBid = Math.max(highestBid + 100, 100);

    if (isInitialBidder) {
      // First bidder (who pulled the tiles) must bid at least 100€ if they can afford it
      if (bidder.money >= 100) {
        auctionModal.querySelector(
          "#auction-info"
        ).textContent = `${bidder.name}, vous avez tiré les tuiles. Vous devez faire une enchère d'au moins 100€.`;
        auctionModal.querySelector("#bid-amount").value = 100;
        auctionModal.querySelector("#bid-amount").min = 100;
        auctionModal.querySelector("#pass-bid-btn").disabled = true; // Can't pass on first bid if they have money
      } else {
        auctionModal.querySelector(
          "#auction-info"
        ).textContent = `${bidder.name}, vous avez tiré les tuiles mais n'avez pas assez d'argent pour enchérir.`;
        auctionModal.querySelector("#pass-bid-btn").disabled = false;
      }
    } else {
      auctionModal.querySelector("#auction-info").textContent = `Au tour de ${
        bidder.name
      }. Enchère actuelle: ${highestBid}€ par ${
        highestBidder ? highestBidder.name : "personne"
      }.`;
      auctionModal.querySelector("#bid-amount").value = minimumBid;
      auctionModal.querySelector("#bid-amount").min = minimumBid;
      auctionModal.querySelector("#pass-bid-btn").disabled = false;
    }

    auctionModal.querySelector("#bid-amount").step = 100;
    auctionModal.querySelector("#bid-amount").max = bidder.money;
  }

  function handleBid(pass = false) {
    const bidder = auctionBidders[currentBidderIndex];
    const isInitialBidder =
      currentBidderIndex === currentPlayerIndex && !initialBidderMadeBid;

    if (pass) {
      // Check if initial bidder is trying to pass without money
      if (isInitialBidder && bidder.money >= 100) {
        alert(
          "Vous devez faire une enchère d'au moins 100€ car vous avez tiré les tuiles."
        );
        return;
      }

      logMessage(`${bidder.name} passe son tour.`);
      auctionBidders[currentBidderIndex] = null; // Mark as passed
      auctionPasses++;
    } else {
      const amount = parseInt(auctionModal.querySelector("#bid-amount").value);
      const minimumBid = isInitialBidder ? 100 : highestBid + 100;

      if (
        amount >= minimumBid &&
        amount <= bidder.money &&
        amount % 100 === 0
      ) {
        highestBid = amount;
        highestBidder = bidder;
        logMessage(`${bidder.name} enchérit à ${amount}€.`);
        auctionPasses = 0; // Reset passes on a new bid

        if (isInitialBidder) {
          initialBidderMadeBid = true;
        }
      } else {
        alert(
          `Votre offre doit être d'au moins ${minimumBid}€, par paliers de 100€, et dans les limites de votre argent.`
        );
        return;
      }
    }

    // Mark initial bidder as having made their mandatory bid if they passed (only if no money)
    if (isInitialBidder) {
      initialBidderMadeBid = true;
    }

    currentBidderIndex = (currentBidderIndex + 1) % players.length;
    promptNextBidder();
  }

  function endAuction() {
    if (highestBidder) {
      logMessage(
        `${highestBidder.name} remporte l'enchère pour ${highestBid}€.`
      );
      highestBidder.money -= highestBid;

      // Check if there are any face-down tiles to reveal
      const faceDownTiles = machineOffer.filter((offer) => !offer.faceUp);

      if (faceDownTiles.length > 0) {
        // Show face-down tiles before giving them to winner
        revealFaceDownTiles(faceDownTiles, () => {
          // After revealing, add all tiles to winner
          machineOffer.forEach((offer) => highestBidder.addTile(offer.tile));
          highestBidder.updatePlayerInfo();
          hideModal(auctionModal);
          machineOffer = [];
          updateMachineUI();
          endTurn();
        });
      } else {
        // No face-down tiles, proceed normally
        machineOffer.forEach((offer) => highestBidder.addTile(offer.tile));
        highestBidder.updatePlayerInfo();
        hideModal(auctionModal);
        machineOffer = [];
        updateMachineUI();
        endTurn();
      }
    } else {
      logMessage("Personne n'a enchéri. Les tuiles sont défaussées.");
      hideModal(auctionModal);
      machineOffer = [];
      updateMachineUI();
      endTurn();
    }
  }

  function revealFaceDownTiles(faceDownTiles, callback) {
    // Log the revealed tiles
    faceDownTiles.forEach((offer) => {
      logMessage(
        `Tuile révélée : ${offer.tile.sign} ${
          offer.tile.color === RED
            ? "rouge"
            : offer.tile.color === PINK
            ? "rose"
            : offer.tile.color === YELLOW
            ? "jaune"
            : offer.tile.color === GREEN
            ? "vert"
            : offer.tile.color === BLUE
            ? "bleu"
            : offer.tile.color === PURPLE
            ? "violet"
            : "error"
        }`
      );

      // Mark tile as face up for display
      offer.faceUp = true;
    });

    // Update the machine UI to show revealed tiles
    updateMachineUI();

    // Wait 1 second before proceeding
    setTimeout(() => {
      callback();
    }, 1500);
  }

  // --- VÉRIFICATION DE VICTOIRE ---
  function checkForWinner(player) {
    // Condition 1: 6 tuiles du même signe
    const signCounts = player.tiles.reduce((acc, tile) => {
      acc[tile.sign] = (acc[tile.sign] || 0) + 1;
      return acc;
    }, {});
    if (Object.values(signCounts).some((count) => count >= 6)) {
      endGame(player, "en obtenant 6 tuiles du même signe");
      return true;
    }

    // Condition 2: 12 signes différents
    const uniqueSigns = new Set(player.tiles.map((tile) => tile.sign));
    if (uniqueSigns.size >= 12) {
      endGame(player, "en obtenant 12 signes différents");
      return true;
    }

    return false;
  }

  function endGame(winner, reason) {
    gameInProgress = false;
    document.getElementById(
      "winner-message"
    ).textContent = `${winner.name} a gagné ${reason} !`;
    showModal(winnerModal);
  }

  // --- FONCTIONS UTILITAIRES ET DOM ---
  function updatePawnPosition(player) {
    const cell = document.querySelector(`.cell[data-id='${player.position}']`);
    const cellRect = cell.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();

    // Offset to place multiple pawns on the same cell without overlap
    const offset = player.id * (player.pawn.offsetWidth + 2);

    player.pawn.style.top = `${cellRect.top - boardRect.top + 5}px`;
    player.pawn.style.left = `${cellRect.left - boardRect.left + offset}px`;
  }

  function logMessage(msg) {
    const p = document.createElement("p");
    p.textContent = msg;
    gameLogEl.prepend(p);
  }

  function showModal(modal) {
    modalBackdrop.classList.remove("hidden");
    modal.classList.remove("hidden");
  }

  function hideModal(modal) {
    modalBackdrop.classList.add("hidden");
    modal.classList.add("hidden");
  }

  function updateMachineUI() {
    machineTilesEl.innerHTML = "";
    machineOffer.forEach((offer) => {
      const tileDiv = createTileElement(offer.tile, offer.faceUp);
      machineTilesEl.appendChild(tileDiv);
    });
  }

  function showMachineControls() {
    takeTileBtn.classList.remove("hidden");
    relaunchBtn.classList.remove("hidden");
  }

  function hideMachineControls() {
    takeTileBtn.classList.add("hidden");
    relaunchBtn.classList.add("hidden");
  }

  // --- ÉVÉNEMENTS ---
  setupPlayersBtn.addEventListener("click", setupPlayerInputs);
  startGameBtn.addEventListener("click", initializeGame);
  takeTileBtn.addEventListener("click", playerTakesTiles);
  relaunchBtn.addEventListener("click", drawFromMachine);

  confirmSellBtn.addEventListener("click", confirmSell);
  cancelSellBtn.addEventListener("click", cancelSell);

  auctionModal
    .querySelector("#place-bid-btn")
    .addEventListener("click", () => handleBid(false));
  auctionModal
    .querySelector("#pass-bid-btn")
    .addEventListener("click", () => handleBid(true));

  document.getElementById("restart-game-btn").addEventListener("click", () => {
    hideModal(winnerModal);
    showModal(setupModal);
    playersSetup.classList.add("hidden");
  });

  // --- DÉMARRAGE ---
  showModal(setupModal);
});
