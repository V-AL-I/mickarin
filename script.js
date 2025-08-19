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
  const COLORS = [
    "#ffadad",
    "#ffd6a5",
    "#fdffb6",
    "#caffbf",
    "#9bf6ff",
    "#a0c4ff",
  ];
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
  const winnerModal = document.getElementById("winner-modal");

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
      this.tilesEl = null;
    }

    getStartingPosition(yob) {
      return (yob % 12) * 3;
    }

    addTile(tile) {
      this.tiles.push(tile);
      this.updatePlayerInfo();
    }

    removeTile(tileToRemove) {
      this.tiles = this.tiles.filter((tile) => tile !== tileToRemove);
      this.updatePlayerInfo();
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
      this.tilesEl.innerHTML = "";
      this.tiles.forEach((tile) => {
        const tileDiv = createTileElement(tile);
        this.tilesEl.appendChild(tileDiv);
      });
    }
  }

  class Tile {
    constructor(sign, color) {
      this.sign = sign;
      this.color = color;
      this.imagePath = `images/${sign}.png`; // Path to the PNG file
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
    } else {
      tileDiv.classList.add("face-down");
      // No image or text for face-down tiles, just the color
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
      "#ffadad", // red
      "#ffd6a5", // orange
      "#fdffb6", // yellow
      "#caffbf", // green
      "#9bf6ff", // blue
      "#a0c4ff", // purple
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
      Chien: "#caffbf", // green
      Dragon: "#caffbf", // green
      Cochon: "#ffadad", // red
      Serpent: "#ffadad", // red
      Rat: "#9bf6ff", // blue
      Cheval: "#9bf6ff", // blue
      Buffle: "#ffb3ff", // pink
      Chevre: "#ffb3ff", // pink
      Singe: "#fdffb6", // yellow
      Tigre: "#fdffb6", // yellow
      Coq: "#a0c4ff", // purple
      Chat: "#a0c4ff", // purple
    };

    path.forEach((p, i) => {
      const index = p[0] * 10 + p[1];
      cells[index].className = "cell path";
      cells[index].dataset.id = i;

      // Assign colors and special properties
      if (i === 1 || (i > 1 && (i - 1) % 3 === 0)) {
        cells[index].textContent = "€";
        cells[index].dataset.type = "money";
        cells[index].style.backgroundColor = "lightgreen";
      } else {
        const signIndex = Math.floor(i / 3) % SIGNS.length;
        const animalSign = SIGNS[signIndex];
        const animalColor = animalColors[animalSign];

        cells[index].style.backgroundColor = animalColor;
        cells[index].dataset.type = "color";
        cells[index].dataset.color = animalColor;
        cells[index].textContent = animalSign;
        cells[index].dataset.sign = animalSign;
      }
    });

    cells.forEach((cell) => board.appendChild(cell));
  }

  function setupUI() {
    playersPanel.innerHTML = "";
    players.forEach((player) => {
      // Player info panel
      const div = document.createElement("div");
      div.className = "player-info";
      div.style.borderColor = player.color;
      div.innerHTML = `
                <h4>${player.name}</h4>
                <p>Argent: <span class="money">${player.money}</span>€</p>
                <div class="player-tiles"></div>
            `;
      player.infoEl = div;
      player.tilesEl = div.querySelector(".player-tiles");
      playersPanel.appendChild(div);

      // Player pawn
      const pawn = document.createElement("div");
      pawn.className = "pawn";
      pawn.style.backgroundColor = player.color;
      player.pawn = pawn;
      board.appendChild(pawn);
      updatePawnPosition(player);
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
  }

  function endTurn() {
    if (checkForWinner(players[currentPlayerIndex])) return;

    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    startTurn();
  }

  // --- LOGIQUE DU JEU ---
  function rollDice() {
    rollDiceBtn.disabled = true;
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    diceResultEl.textContent = `Résultat : ${diceRoll}`;
    logMessage(`${players[currentPlayerIndex].name} a fait un ${diceRoll}.`);
    movePlayer(diceRoll);
  }

  function movePlayer(steps, isSecondRoll = false) {
    const player = players[currentPlayerIndex];
    const oldPosition = player.position;
    player.position = (player.position + steps) % BOARD_SIZE;
    updatePawnPosition(player);

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

      // Roll again after stealing
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
        };
      }, 2000);
    } else {
      // No overtaking, handle normal cell action
      setTimeout(() => handleCellAction(isSecondRoll), 1000);
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
        const rent = 50;
        logMessage(
          `${player.name} paie un loyer de ${rent}€ à ${owner.name} pour le signe ${cellSign}.`
        );
        player.money -= rent;
        owner.money += rent;
        owner.updatePlayerInfo();
        player.updatePlayerInfo();
      }
    }

    // Handle cell effects (no money or machine on second roll)
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
      // Start/other cells or second roll - just end turn
      if (isSecondRoll) {
        logMessage(`${player.name} termine son tour (second lancer).`);
      }
      endTurn();
    }
  }

  // Modified handleSteal to work with multiple victims
  function handleSteal(thief, victim) {
    if (victim.tiles.length === 0) {
      logMessage(`${victim.name} n'a pas de tuiles à voler.`);
      return;
    }

    // For multiple overtaking, automatically steal the first tile
    const stolenTile = victim.tiles[0];
    logMessage(
      `${thief.name} vole une tuile ${stolenTile.sign} à ${victim.name}.`
    );
    victim.removeTile(stolenTile);
    thief.addTile(stolenTile);
  }

  // Reset the roll dice button onclick for normal rolls
  function startTurn() {
    const currentPlayer = players[currentPlayerIndex];
    logMessage(`C'est au tour de ${currentPlayer.name}.`);
    playerTurnEl.textContent = `Tour de: ${currentPlayer.name}`;
    playerMoneyEl.textContent = `${currentPlayer.money}€`;
    rollDiceBtn.disabled = false;
    diceResultEl.textContent = "";

    // Reset to normal roll behavior
    rollDiceBtn.onclick = rollDice;
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

  // --- ENCHÈRES ---
  let auctionBidders,
    currentBidderIndex,
    highestBid,
    highestBidder,
    auctionPasses;
  function startAuction() {
    auctionBidders = [...players];
    currentBidderIndex = currentPlayerIndex;
    highestBid = 0;
    highestBidder = null;
    auctionPasses = 0;

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

    auctionModal.querySelector("#auction-info").textContent = `Au tour de ${
      bidder.name
    }. Enchère actuelle: ${highestBid}€ par ${
      highestBidder ? highestBidder.name : "personne"
    }.`;
    auctionModal.querySelector("#bid-amount").value = highestBid + 100;
    auctionModal.querySelector("#bid-amount").min = highestBid + 100;
    auctionModal.querySelector("#bid-amount").step = 100;
    auctionModal.querySelector("#bid-amount").max = bidder.money;
  }

  function handleBid(pass = false) {
    const bidder = auctionBidders[currentBidderIndex];

    if (pass) {
      logMessage(`${bidder.name} passe son tour.`);
      auctionBidders[currentBidderIndex] = null; // Mark as passed
      auctionPasses++;
    } else {
      const amount = parseInt(auctionModal.querySelector("#bid-amount").value);
      const minimumBid = highestBid + 100;

      if (
        amount >= minimumBid &&
        amount <= bidder.money &&
        amount % 100 === 0
      ) {
        highestBid = amount;
        highestBidder = bidder;
        logMessage(`${bidder.name} enchérit à ${amount}€.`);
        auctionPasses = 0; // Reset passes on a new bid
      } else {
        alert(
          `Votre offre doit être d'au moins ${minimumBid}€, par paliers de 100€, et dans les limites de votre argent.`
        );
        return;
      }
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
      machineOffer.forEach((offer) => highestBidder.addTile(offer.tile));
      highestBidder.updatePlayerInfo();
    } else {
      logMessage("Personne n'a enchéri. Les tuiles sont défaussées.");
    }

    hideModal(auctionModal);
    machineOffer = [];
    updateMachineUI();
    endTurn();
  }

  // --- VOL DE TUILES ---
  function handleSteal(thief, victim) {
    if (victim.tiles.length === 0) {
      logMessage(`${victim.name} n'a pas de tuiles à voler.`);
      return;
    }

    const stealOptions = stealModal.querySelector("#steal-options");
    stealOptions.innerHTML = "";

    victim.tiles.forEach((tile) => {
      const tileDiv = createTileElement(tile);
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
  rollDiceBtn.addEventListener("click", rollDice);
  takeTileBtn.addEventListener("click", playerTakesTiles);
  relaunchBtn.addEventListener("click", drawFromMachine);

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
