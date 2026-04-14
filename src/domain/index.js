/**
 * Domain layer: Sudoku and Game objects.
 * Exported API is consumed both by tests and by the Svelte UI via a store adapter.
 */

/**
 * Create a Sudoku domain object from a 9×9 numeric grid.
 * Zeros represent empty cells.
 *
 * @param {number[][]} grid
 * @returns {{ getGrid, guess, clone, toJSON, toString }}
 */
export function createSudoku(grid) {
  // Defensively deep-copy the input so external mutations don't affect us.
  let _grid = grid.map(row => [...row]);

  return {
    /** Return a deep copy of the current grid. */
    getGrid() {
      return _grid.map(row => [...row]);
    },

    /**
     * Place a value in the given cell.
     * @param {{ row: number, col: number, value: number }} move
     */
    guess({ row, col, value }) {
      _grid[row][col] = value;
    },

    /** Return an independent copy of this sudoku. */
    clone() {
      return createSudoku(_grid);
    },

    /** Return a plain-object snapshot suitable for JSON.stringify. */
    toJSON() {
      return { grid: _grid.map(row => [...row]) };
    },

    /** Human-readable board representation. */
    toString() {
      return _grid
        .map(row => row.map(v => (v === 0 ? '.' : v)).join(' '))
        .join('\n');
    },
  };
}

/**
 * Restore a Sudoku from a previously serialised snapshot.
 *
 * @param {{ grid: number[][] }} json
 */
export function createSudokuFromJSON({ grid }) {
  return createSudoku(grid);
}

/**
 * Create a Game that wraps a Sudoku and maintains full undo / redo history.
 *
 * @param {{ sudoku: ReturnType<typeof createSudoku> }} options
 */
export function createGame({ sudoku }) {
  let _current = sudoku;
  /** @type {ReturnType<typeof createSudoku>[]} */
  let _undoStack = [];
  /** @type {ReturnType<typeof createSudoku>[]} */
  let _redoStack = [];

  return {
    /** Return the current Sudoku. */
    getSudoku() {
      return _current;
    },

    /**
     * Apply a move, recording the previous state so it can be undone.
     * Any pending redo history is discarded.
     * @param {{ row: number, col: number, value: number }} move
     */
    guess(move) {
      _undoStack.push(_current.clone());
      _redoStack = [];
      _current.guess(move);
    },

    /** Undo the last move. No-op if there is nothing to undo. */
    undo() {
      if (_undoStack.length === 0) return;
      _redoStack.push(_current.clone());
      _current = _undoStack.pop();
    },

    /** Redo a previously undone move. No-op if there is nothing to redo. */
    redo() {
      if (_redoStack.length === 0) return;
      _undoStack.push(_current.clone());
      _current = _redoStack.pop();
    },

    /** @returns {boolean} */
    canUndo() {
      return _undoStack.length > 0;
    },

    /** @returns {boolean} */
    canRedo() {
      return _redoStack.length > 0;
    },

    /** Return a plain-object snapshot of the current board state. */
    toJSON() {
      return { sudoku: _current.toJSON() };
    },
  };
}

/**
 * Restore a Game from a previously serialised snapshot.
 * History is not preserved — only the current board state is restored.
 *
 * @param {{ sudoku: { grid: number[][] } }} json
 */
export function createGameFromJSON({ sudoku }) {
  return createGame({ sudoku: createSudokuFromJSON(sudoku) });
}
