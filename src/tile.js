import { RED, BLUE, GREEN, PINK, PURPLE, YELLOW } from "./const.js";

export class Tile {
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
export function createTileElement(tile, faceUp = true) {
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
