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
