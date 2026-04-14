/**
 * Domain layer for Sudoku game.
 * Exports: createSudoku, createSudokuFromJSON, createGame, createGameFromJSON
 */

function deepCopyGrid(grid) {
  return grid.map((row) => row.slice())
}

export function createSudoku(grid) {
  let _grid = deepCopyGrid(grid)

  return {
    getGrid() {
      return deepCopyGrid(_grid)
    },

    guess({ row, col, value }) {
      _grid[row][col] = value
    },

    clone() {
      return createSudoku(_grid)
    },

    toJSON() {
      return { grid: deepCopyGrid(_grid) }
    },

    toString() {
      return _grid
        .map((row) => row.map((v) => (v === 0 ? '.' : String(v))).join(' '))
        .join('\n')
    },
  }
}

export function createSudokuFromJSON(json) {
  return createSudoku(json.grid)
}

export function createGame({ sudoku, past = [], future = [] }) {
  let _current = sudoku
  let _past = past.slice()
  let _future = future.slice()

  return {
    getSudoku() {
      return _current
    },

    guess(move) {
      _past.push(_current.clone())
      _future = []
      _current.guess(move)
    },

    canUndo() {
      return _past.length > 0
    },

    canRedo() {
      return _future.length > 0
    },

    undo() {
      if (_past.length === 0) return
      _future.push(_current.clone())
      _current = _past.pop()
    },

    redo() {
      if (_future.length === 0) return
      _past.push(_current.clone())
      _current = _future.pop()
    },

    toJSON() {
      return {
        sudoku: _current.toJSON(),
        past: _past.map((s) => s.toJSON()),
        future: _future.map((s) => s.toJSON()),
      }
    },
  }
}

export function createGameFromJSON(json) {
  const sudoku = createSudokuFromJSON(json.sudoku)
  const past = (json.past || []).map(createSudokuFromJSON)
  const future = (json.future || []).map(createSudokuFromJSON)
  return createGame({ sudoku, past, future })
}
