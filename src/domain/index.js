/**
 * Domain objects for Sudoku game.
 * Provides createSudoku, createSudokuFromJSON, createGame, createGameFromJSON.
 */

/**
 * Deep-copy a 9x9 grid.
 * @param {number[][]} grid
 * @returns {number[][]}
 */
function cloneGrid(grid) {
  return grid.map(row => row.slice());
}

/**
 * Create a Sudoku domain object.
 * @param {number[][]} inputGrid - 9x9 grid of numbers (0 = empty)
 * @returns {object} Sudoku
 */
export function createSudoku(inputGrid) {
  // Defensive copy so external mutations don't affect us
  let grid = cloneGrid(inputGrid);

  return {
    /**
     * Return a copy of the current grid.
     * @returns {number[][]}
     */
    getGrid() {
      return cloneGrid(grid);
    },

    /**
     * Place a value at the given position.
     * @param {{ row: number, col: number, value: number }} move
     */
    guess({ row, col, value }) {
      grid[row][col] = value;
    },

    /**
     * Create an independent deep copy of this Sudoku.
     * @returns {object} cloned Sudoku
     */
    clone() {
      return createSudoku(grid);
    },

    /**
     * Serialize to a plain JSON-compatible object.
     * @returns {{ grid: number[][] }}
     */
    toJSON() {
      return { grid: cloneGrid(grid) };
    },

    /**
     * Human-readable string representation.
     * @returns {string}
     */
    toString() {
      return grid
        .map(row => row.map(v => (v === 0 ? '·' : v)).join(' '))
        .join('\n');
    },
  };
}

/**
 * Restore a Sudoku from serialized JSON data.
 * @param {{ grid: number[][] }} json
 * @returns {object} Sudoku
 */
export function createSudokuFromJSON(json) {
  return createSudoku(json.grid);
}

/**
 * Create a Game domain object that manages a Sudoku with undo/redo.
 * @param {{ sudoku: object }} options
 * @returns {object} Game
 */
export function createGame({ sudoku }) {
  // History is a stack of Sudoku snapshots (past states, not including current)
  let history = [];
  let future = [];
  let current = sudoku;

  return {
    /**
     * Get the current Sudoku.
     * @returns {object}
     */
    getSudoku() {
      return current;
    },

    /**
     * Apply a move to the current Sudoku, pushing prior state to history.
     * @param {{ row: number, col: number, value: number }} move
     */
    guess(move) {
      history.push(current.clone());
      future = [];
      current.guess(move);
    },

    /**
     * Undo the last move.
     */
    undo() {
      if (history.length === 0) return;
      future.push(current.clone());
      current = history.pop();
    },

    /**
     * Redo the previously undone move.
     */
    redo() {
      if (future.length === 0) return;
      history.push(current.clone());
      current = future.pop();
    },

    /**
     * Whether undo is available.
     * @returns {boolean}
     */
    canUndo() {
      return history.length > 0;
    },

    /**
     * Whether redo is available.
     * @returns {boolean}
     */
    canRedo() {
      return future.length > 0;
    },

    /**
     * Serialize to a plain JSON-compatible object (current board state only).
     * @returns {{ sudoku: object }}
     */
    toJSON() {
      return { sudoku: current.toJSON() };
    },
  };
}

/**
 * Restore a Game from serialized JSON data.
 * @param {{ sudoku: object }} json
 * @returns {object} Game
 */
export function createGameFromJSON(json) {
  return createGame({ sudoku: createSudokuFromJSON(json.sudoku) });
}
