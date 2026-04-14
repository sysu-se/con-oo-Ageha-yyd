/**
 * Domain layer: Sudoku + Game
 *
 * Sudoku  – holds the current 9×9 grid, supports guess / clone / serialisation
 * Game    – wraps a Sudoku and manages undo / redo history
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepCopyGrid(grid) {
	return grid.map(row => [...row]);
}

// ---------------------------------------------------------------------------
// Sudoku
// ---------------------------------------------------------------------------

/**
 * @param {number[][]} inputGrid  9×9 array (0 = empty)
 */
export function createSudoku(inputGrid) {
	let grid = deepCopyGrid(inputGrid);   // defensive copy on creation

	return {
		/** Returns an independent copy of the current grid */
		getGrid() {
			return deepCopyGrid(grid);
		},

		/**
		 * Place a number in a cell.
		 * @param {{ row: number, col: number, value: number }} move
		 */
		guess({ row, col, value }) {
			grid[row][col] = value;
		},

		/** Creates an independent clone of this Sudoku */
		clone() {
			return createSudoku(grid);
		},

		/** Serialisable plain object */
		toJSON() {
			return { grid: deepCopyGrid(grid) };
		},

		/** Human-readable text representation */
		toString() {
			const LINE = '+-------+-------+-------+';
			const rows = grid.map((row, r) => {
				const cells = row.map((v, c) => {
					const sep = (c % 3 === 0) ? '| ' : ' ';
					return sep + (v || '.');
				}).join('') + ' |';
				return (r % 3 === 0 ? LINE + '\n' : '') + cells;
			});
			return rows.join('\n') + '\n' + LINE;
		},
	};
}

/**
 * Restore a Sudoku from the plain object produced by `toJSON()`.
 * @param {{ grid: number[][] }} json
 */
export function createSudokuFromJSON(json) {
	return createSudoku(json.grid);
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

/**
 * @param {{ sudoku: ReturnType<createSudoku> }} options
 */
export function createGame({ sudoku }) {
	let current = sudoku;
	let past    = [];   // stack of Sudoku snapshots (before each move)
	let future  = [];   // stack of Sudoku snapshots (for redo)

	return {
		/** Returns the current Sudoku */
		getSudoku() {
			return current;
		},

		/**
		 * Make a move.  Saves a clone for undo and clears the redo stack.
		 * @param {{ row: number, col: number, value: number }} move
		 */
		guess(move) {
			past.push(current.clone());
			future = [];
			current.guess(move);
		},

		/** Undo the last move */
		undo() {
			if (past.length === 0) return;
			future.push(current.clone());
			current = past.pop();
		},

		/** Redo the last undone move */
		redo() {
			if (future.length === 0) return;
			past.push(current.clone());
			current = future.pop();
		},

		canUndo() { return past.length > 0; },
		canRedo() { return future.length > 0; },

		/** Serialisable plain object (current board state only) */
		toJSON() {
			return { grid: current.getGrid() };
		},
	};
}

/**
 * Restore a Game from the plain object produced by `toJSON()`.
 * History is not preserved (only the current board state).
 * @param {{ grid: number[][] }} json
 */
export function createGameFromJSON(json) {
	return createGame({ sudoku: createSudoku(json.grid) });
}
