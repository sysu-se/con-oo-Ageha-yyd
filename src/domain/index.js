/**
 * Domain objects for Sudoku game.
 * Pure JS, no Svelte dependencies.
 */

/**
 * Create a deep copy of a 9x9 grid.
 * @param {number[][]} grid
 * @returns {number[][]}
 */
function cloneGrid(grid) {
	return grid.map(row => [...row]);
}

/**
 * Create a Sudoku domain object.
 * @param {number[][]} inputGrid - 9x9 puzzle grid (0 = empty)
 * @returns {object} Sudoku object
 */
export function createSudoku(inputGrid) {
	// Defensive copy so the caller can't mutate our internal state
	let grid = cloneGrid(inputGrid);

	return {
		/**
		 * Get the current grid.
		 * @returns {number[][]} 9x9 grid (copy)
		 */
		getGrid() {
			return cloneGrid(grid);
		},

		/**
		 * Place a value in a cell.
		 * @param {{ row: number, col: number, value: number }} move
		 */
		guess({ row, col, value }) {
			grid[row][col] = value;
		},

		/**
		 * Create an independent copy of this Sudoku.
		 * @returns {object} new Sudoku object with same state
		 */
		clone() {
			return createSudoku(grid);
		},

		/**
		 * Serialize to plain JSON-compatible data.
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
			const lines = [];
			lines.push('╔═══════╤═══════╤═══════╗');
			for (let row = 0; row < 9; row++) {
				if (row !== 0 && row % 3 === 0) {
					lines.push('╟───────┼───────┼───────╢');
				}
				let line = '║ ';
				for (let col = 0; col < 9; col++) {
					if (col !== 0 && col % 3 === 0) line += '│ ';
					line += (grid[row][col] === 0 ? '·' : grid[row][col]) + ' ';
				}
				line += '║';
				lines.push(line);
			}
			lines.push('╚═══════╧═══════╧═══════╝');
			return lines.join('\n');
		},
	};
}

/**
 * Restore a Sudoku from serialized JSON data.
 * @param {{ grid: number[][] }} json
 * @returns {object} Sudoku object
 */
export function createSudokuFromJSON(json) {
	return createSudoku(json.grid);
}

/**
 * Create a Game domain object that manages a Sudoku with undo/redo history.
 * @param {{ sudoku: object, undoStack?: object[], redoStack?: object[] }} options
 * @returns {object} Game object
 */
export function createGame({ sudoku, undoStack: initialUndo = [], redoStack: initialRedo = [] }) {
	let current = sudoku;
	let undoStack = [...initialUndo];
	let redoStack = [...initialRedo];

	return {
		/**
		 * Get the current Sudoku.
		 * @returns {object} Sudoku object
		 */
		getSudoku() {
			return current;
		},

		/**
		 * Make a move. Saves the previous state for undo.
		 * @param {{ row: number, col: number, value: number }} move
		 */
		guess(move) {
			undoStack.push(current.clone());
			redoStack = [];
			current.guess(move);
		},

		/**
		 * Undo the last move.
		 */
		undo() {
			if (undoStack.length > 0) {
				redoStack.push(current.clone());
				current = undoStack.pop();
			}
		},

		/**
		 * Redo the last undone move.
		 */
		redo() {
			if (redoStack.length > 0) {
				undoStack.push(current.clone());
				current = redoStack.pop();
			}
		},

		/**
		 * Check whether undo is available.
		 * @returns {boolean}
		 */
		canUndo() {
			return undoStack.length > 0;
		},

		/**
		 * Check whether redo is available.
		 * @returns {boolean}
		 */
		canRedo() {
			return redoStack.length > 0;
		},

		/**
		 * Serialize to plain JSON-compatible data.
		 * Stores current board and full history for round-trip support.
		 * @returns {{ grid: number[][], undoStack: number[][][], redoStack: number[][][] }}
		 */
		toJSON() {
			return {
				grid: current.getGrid(),
				undoStack: undoStack.map(s => s.getGrid()),
				redoStack: redoStack.map(s => s.getGrid()),
			};
		},
	};
}

/**
 * Restore a Game from serialized JSON data.
 * @param {{ grid: number[][], undoStack?: number[][][], redoStack?: number[][][] }} json
 * @returns {object} Game object
 */
export function createGameFromJSON(json) {
	const sudoku = createSudoku(json.grid);
	const undoStack = Array.isArray(json.undoStack)
		? json.undoStack.map(g => createSudoku(g))
		: [];
	const redoStack = Array.isArray(json.redoStack)
		? json.redoStack.map(g => createSudoku(g))
		: [];
	return createGame({ sudoku, undoStack, redoStack });
}
