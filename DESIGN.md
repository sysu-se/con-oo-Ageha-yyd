# DESIGN.md — Homework 1.1

## A. 领域对象如何被消费

### 1. View 层直接消费的是什么？

View 层（Svelte 组件）消费的是一个**Store Adapter**（适配层），而不是直接消费 `Game` 或 `Sudoku`。

具体来说，`src/node_modules/@sudoku/stores/grid.js` 中的 `userGrid` 自定义 store 就是这个适配层。它在内部持有一个 `Game` 实例（来自 `src/domain/index.js`），对外向 Svelte 组件暴露：
- 可订阅的响应式 grid 状态（`$userGrid`）
- 可订阅的 undo/redo 可用性状态（`$canUndo`、`$canRedo`）
- 供 UI 调用的命令方法（`set`、`applyHint`、`undo`、`redo`）

### 2. View 层拿到的数据是什么？

| 响应式状态 | 来源 store | 说明 |
|---|---|---|
| `$userGrid` | `userGrid` store（来自 `grid.js`）| 当前完整棋盘（9×9 数组），包含题目给定值和用户填入值 |
| `$grid` | `grid` store（来自 `grid.js`）| 题目初始棋盘，用于判断哪些格是给定格（不可编辑） |
| `$invalidCells` | `invalidCells` derived store | 冲突格坐标列表，由 `userGrid` 派生 |
| `$canUndo` | `canUndo` store（来自 `grid.js`）| 当前是否可以撤销 |
| `$canRedo` | `canRedo` store（来自 `grid.js`）| 当前是否可以重做 |
| `$gameWon` | `gameWon` derived store | 是否已赢得游戏，由 `userGrid` + `invalidCells` 派生 |

### 3. 用户操作如何进入领域对象？

**填入数字（guess）：**

```
用户点击键盘按钮 / 按下键盘
  → Keyboard.svelte 的 handleKeyButton(num)
  → userGrid.set({ x, y }, num)         ← Store Adapter 方法
  → _game.guess({ row, col, value })     ← 调用领域 Game 对象
  → _game 内部：_undoStack.push(clone); _current.guess(move)
  → _syncFromGame()                      ← 将 Game 状态同步到 writable store
  → userGrid.set(newGrid)                ← 触发 Svelte 响应式更新
```

**Undo / Redo：**

```
用户点击 Undo 按钮
  → Actions.svelte 的 handleUndo()
  → userGrid.undo()                      ← Store Adapter 方法
  → _game.undo()                         ← 调用领域 Game 对象
  → _game 内部：_redoStack.push(clone); _current = _undoStack.pop()
  → _syncFromGame()
  → userGrid.set(newGrid)                ← 触发 Svelte 响应式更新
```

**开始新游戏：**

```
用户在 Welcome 弹窗选择难度
  → game.startNew(difficulty) （@sudoku/game.js）
  → grid.generate(difficulty)            ← grid store 更新
  → userGrid 内部的 grid.subscribe 回调触发
  → _game = createGame({ sudoku: createSudoku($grid) })  ← 全新 Game
  → _syncFromGame()
```

### 4. 领域对象变化后，Svelte 为什么会更新？

每次领域对象（`_game`）的状态变化后，适配层都会调用 `_syncFromGame()`：

```javascript
function _syncFromGame() {
    userGrid.set(_game.getSudoku().getGrid()); // 重新赋值给 writable store
    _canUndo.set(_game.canUndo());
    _canRedo.set(_game.canRedo());
}
```

`userGrid.set(...)` 会调用 Svelte `writable` store 的 `set` 方法，将新的 grid 数组作为**全新引用**写入 store，触发所有订阅者的重新渲染。这是 Svelte 的标准响应式机制：store 值的引用发生变化 → 订阅该 store 的组件重新运行。

---

## B. 响应式机制说明

### 1. 依赖的是哪种机制？

本方案使用 **Svelte Writable Store + `$store` 语法**，这是 Svelte 3 的标准响应式机制。具体依赖点：

- `writable(...)` 创建可写 store
- 组件中用 `$userGrid`、`$canUndo`、`$canRedo` 自动订阅 store
- `derived(...)` 用于从 `userGrid` 派生 `invalidCells`、`gameWon`

### 2. 哪些数据是响应式暴露给 UI 的？

| 响应式暴露的数据 | 类型 | 消费方 |
|---|---|---|
| `$userGrid` | `number[][]` — 当前完整棋盘 | `Board/index.svelte`（渲染每个格子） |
| `$canUndo` | `boolean` | `Actions.svelte`（Undo 按钮 disabled 状态） |
| `$canRedo` | `boolean` | `Actions.svelte`（Redo 按钮 disabled 状态） |
| `$invalidCells` | `string[]` — 冲突格坐标 | `Board/index.svelte`（高亮冲突格） |
| `$gameWon` | `boolean` | `App.svelte`（触发 gameover 弹窗） |

### 3. 哪些状态留在领域对象内部？

以下状态对 UI **不直接可见**，只在领域对象内部维护：

- `_undoStack`：撤销栈（Sudoku 快照数组）
- `_redoStack`：重做栈（Sudoku 快照数组）
- `_current`：当前 Sudoku 对象本身（UI 只看到它 `getGrid()` 返回的副本）
- Sudoku 内部的 `_grid` 二维数组（UI 通过 `getGrid()` 拿到的是副本）

### 4. 如果直接 mutate 内部对象，会出什么问题？

Svelte 的响应式更新依赖于**赋值操作（assignment）**触发的信号，而不是检测对象内部字段的变化。例如：

```javascript
// ❌ 错误做法：直接修改数组元素
$userGrid[3][4] = 5;
// Svelte 不知道数组内容变了，界面不会刷新

// ✅ 正确做法：通过 store 的 set/update 方法赋予新引用
userGrid.set(newGrid);  // 新数组引用 → 触发订阅者
```

同理，如果直接操作 `_game.getSudoku()` 返回的 Sudoku 对象内部字段，而不调用 `_syncFromGame()`，writable store 的值不会更新，Svelte 的 `$userGrid` 也不会改变，界面静止不动。

本方案通过将所有变更都路由到 `_syncFromGame()` 来避免这个问题，确保每次领域状态变化都会触发一次完整的 `userGrid.set(newGrid)`，即新数组引用，从而触发 Svelte 更新。

---

## C. 改进说明

### 1. 相比 HW1，改进了什么？

HW1 中，`Sudoku` / `Game` 领域对象存在于 `src/domain/index.js`，且通过了所有单元测试，但 UI 完全没有使用它们：

- `userGrid` store 直接操作二维数组，不经过 `Game`
- Undo/Redo 按钮没有任何点击处理逻辑（`on:click` 缺失）
- `Game` 只在测试中可用，真实界面中不存在领域层

HW1.1 做了以下实质性改进：

| 改进点 | HW1 | HW1.1 |
|---|---|---|
| `userGrid.set()` 如何工作 | 直接修改数组 | 调用 `_game.guess()`，领域对象接管 |
| Undo / Redo | 按钮无功能 | 通过 `_game.undo()` / `_game.redo()` 实现，完整联动界面 |
| 历史管理 | 无 | 由 `Game` 的 `_undoStack` / `_redoStack` 管理，基于 Sudoku clone |
| 开始新游戏 | `grid.generate()` 直接写数组 | 同时创建新的 `Game` 实例，清空历史 |
| 响应式 | 直接 writable，无领域层 | Store Adapter 包裹 Game，同步 canUndo/canRedo 状态 |

### 2. 为什么 HW1 的做法不足以支撑真实接入？

HW1 的 `userGrid` store 直接使用 `userGrid.update($g => { $g[y][x] = v; return $g; })` 操作数组，这绕过了 `Game` 对象，意味着：
- 修改历史无法被 `Game` 追踪（`_undoStack` 永远为空）
- Undo/Redo 无从实现
- `Game` 成为"只在测试中存在的装饰品"

### 3. 新设计的 trade-off

**优点：**
- 领域逻辑（历史管理、状态演进）完全在 `Game` 内部，UI 层零逻辑
- Svelte 组件只做两件事：渲染 store 数据，调用 store 方法
- `Game` 与 UI 框架解耦，可独立单元测试，也可替换 UI 框架

**代价：**
- 每次操作后都调用 `_game.getSudoku().getGrid()` 返回整个 9×9 数组的深拷贝，有轻微内存分配开销（但对于 81 个格子的棋盘可忽略不计）
- `_syncFromGame()` 每次都全量替换 store，而非增量更新，可能触发更多子组件重渲染（同样对此规模影响不大）
- Undo/Redo 历史基于 Sudoku clone（快照策略），每个历史项复制整个 9×9 网格，空间复杂度为 O(操作次数)

---

## 课堂讨论准备

1. **你的 view 层直接消费的是谁？**
   `userGrid` Store Adapter（内部持有 `Game`），以及由它派生的 `invalidCells`、`canUndo`、`canRedo` stores。

2. **为什么你的 UI 在领域对象变化后会刷新？**
   每次领域对象变化后，`_syncFromGame()` 都会调用 `userGrid.set(newGrid)`，传入一个新数组引用，触发 Svelte 对所有 `$userGrid` 订阅者的重新执行。

3. **你的方案中，响应式边界在哪里？**
   领域对象（`Game`/`Sudoku`）是**纯 JavaScript 对象，没有响应式能力**。Store Adapter (`userGrid`, `canUndo`, `canRedo`) 是**响应式边界**：进入领域层时脱离响应式，`_syncFromGame()` 是出口，将领域状态同步回 Svelte 的响应式世界。

4. **你的 `Sudoku` / `Game` 哪些状态对 UI 可见，哪些不可见？**
   可见：`getGrid()` 返回的 9×9 数字数组、`canUndo()`/`canRedo()` 返回的布尔值。  
   不可见：`_undoStack`、`_redoStack`、`_current` 对象引用、`_grid` 内部二维数组。

5. **如果将来迁移到 Svelte 5，哪一层最稳定，哪一层最可能改动？**
   最稳定：`src/domain/index.js`（纯 JS，无框架依赖，不需要改动）。  
   最可能改动：Store Adapter 层（`grid.js`）——需将 `writable`/`derived` 替换为 Svelte 5 的 `$state`/`$derived`，但改动范围局限在适配层，领域层和组件层改动最小。
