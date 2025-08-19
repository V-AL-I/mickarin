import { SIGNS, RED, PINK, YELLOW, GREEN, BLUE, PURPLE } from "./const.js";

export function createTileMachine() {
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
