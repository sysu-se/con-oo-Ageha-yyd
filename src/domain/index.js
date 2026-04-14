/**
 * Creates a Sudoku object from a 9x9 numeric grid.
 * @param {number[][]} grid
 */
export function createSudoku(grid) {
  let _grid = grid.map(row => [...row])

  return {
    getGrid() {
      return _grid.map(row => [...row])
    },

    guess({ row, col, value }) {
      _grid[row][col] = value
    },

    clone() {
      return createSudoku(_grid)
    },

    toJSON() {
      return { grid: _grid.map(row => [...row]) }
    },

    toString() {
      return _grid.map(row => row.join(' ')).join('\n')
    }
  }
}

/**
 * Creates a Sudoku object from a JSON representation produced by toJSON().
 * @param {{ grid: number[][] }} json
 */
export function createSudokuFromJSON(json) {
  return createSudoku(json.grid)
}

/**
 * Creates a Game object wrapping a Sudoku with undo/redo support.
 * @param {{ sudoku: ReturnType<createSudoku> }} options
 */
export function createGame({ sudoku }) {
  let _sudoku = sudoku
  const _undoStack = []
  const _redoStack = []

  return {
    getSudoku() {
      return _sudoku
    },

    guess(move) {
      const snapshot = _sudoku.clone()
      _sudoku.guess(move)
      _undoStack.push(snapshot)
      _redoStack.length = 0
    },

    canUndo() {
      return _undoStack.length > 0
    },

    undo() {
      if (_undoStack.length === 0) return
      _redoStack.push(_sudoku.clone())
      _sudoku = _undoStack.pop()
    },

    canRedo() {
      return _redoStack.length > 0
    },

    redo() {
      if (_redoStack.length === 0) return
      _undoStack.push(_sudoku.clone())
      _sudoku = _redoStack.pop()
    },

    toJSON() {
      return { grid: _sudoku.toJSON().grid }
    }
  }
}

/**
 * Creates a Game object from a JSON representation produced by toJSON().
 * @param {{ grid: number[][] }} json
 */
export function createGameFromJSON(json) {
  return createGame({ sudoku: createSudokuFromJSON(json) })
}
