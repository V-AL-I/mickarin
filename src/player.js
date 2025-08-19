import { STARTING_MONEY } from "./const.js";

export class Player {
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
