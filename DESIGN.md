# DESIGN.md — Homework 1.1

## A. 领域对象如何被消费

### 1. View 层直接消费的是什么？

View 层直接消费的是一个 **Store Adapter**（`domainGame`），而不是裸露的 `Game` 或 `Sudoku` 对象。

架构层次如下：

```
UI 组件（.svelte）
    ↓  订阅 / 调用方法
@sudoku/stores/grid.js  +  @sudoku/stores/domainGame.js
    ↓  调用 guess / undo / redo
src/domain/index.js（纯领域对象：createGame / createSudoku）
```

具体来说：

- `Board/index.svelte` 订阅 `$userGrid`（来自 `@sudoku/stores/grid`，该 store 的 subscribe 代理到 `domainGame.userGrid`）和 `$invalidCells`（由 `userGrid` 派生）。
- `Controls/ActionBar/Actions.svelte` 订阅 `$canUndo` / `$canRedo`，点击按钮时调用 `domainGame.undo()` / `domainGame.redo()`。
- `Controls/Keyboard.svelte` 调用 `userGrid.set(pos, value)`，该调用内部转发给 `domainGame.guess(pos, value)`。
- `Modal/Types/Welcome.svelte` 调用 `startNew(difficulty)` / `startCustom(sencode)`，最终调用 `domainGame.init(puzzleGrid)`。

### 2. View 层拿到的数据是什么？

| 数据 | 来源 |
|---|---|
| `$userGrid` | `domainGame.userGrid` store → 由 `Game.getSudoku().getGrid()` 填充 |
| `$invalidCells` | 由 `userGrid` 派生的 derived store（冲突格子的坐标列表） |
| `$canUndo` | `domainGame.canUndo` store → 由 `Game.canUndo()` 填充 |
| `$canRedo` | `domainGame.canRedo` store → 由 `Game.canRedo()` 填充 |
| `$grid` | 初始谜题格（`@sudoku/stores/grid`），用于区分给定数字与用户输入 |

### 3. 用户操作如何进入领域对象？

**输入数字 / 删除数字：**

```
Keyboard.svelte → userGrid.set(pos, value)
    → domainGame.guess(pos, value)
    → game.guess({ row, col, value })   [domain Game]
    → sudoku.guess({ row, col, value }) [domain Sudoku]
    → _sync()  →  _userGrid.set(newGrid)
```

**Undo / Redo：**

```
Actions.svelte on:click → domainGame.undo() / domainGame.redo()
    → game.undo() / game.redo()   [domain Game]
    → _sync()  →  _userGrid.set(newGrid) + _canUndo.set(...) + _canRedo.set(...)
```

**Hint（提示）：**

```
Actions.svelte → userGrid.applyHint(pos)
    → solveSudoku(currentGrid)
    → domainGame.applyHint(pos, hintValue)
    → game.guess({ row, col, value: hintValue })
    → _sync()
```

### 4. 领域对象变化后，Svelte 为什么会更新？

每次领域对象状态改变后，store adapter 的 `_sync()` 方法会被调用：

```js
function _sync() {
    _userGrid.set(_game.getSudoku().getGrid()); // 新数组引用
    _canUndo.set(_game.canUndo());
    _canRedo.set(_game.canRedo());
}
```

`_userGrid.set(...)` 传入的是 `getGrid()` 返回的**全新数组**（`createSudoku` 内部每次都做深拷贝）。Svelte 检测到 store 值变化（引用发生变化）后，自动通知所有订阅该 store 的组件重新渲染。

---

## B. 响应式机制说明

### 1. 依赖的 Svelte 机制

本方案依赖 **Svelte 3 custom store** 机制：

- `writable(initialValue)` 创建可写 store。
- 组件使用 `$storeName` 订阅 store。
- 调用 `store.set(newValue)` 或 `store.update(fn)` 触发响应式更新。
- `derived(store, fn)` 从已有 store 派生新 store（用于 `invalidCells`）。

### 2. 哪些数据是响应式暴露给 UI 的？

| Store | 类型 | 说明 |
|---|---|---|
| `domainGame.userGrid` | `writable` | 当前棋盘状态（9×9 数组） |
| `domainGame.canUndo` | `writable` | 是否可撤销 |
| `domainGame.canRedo` | `writable` | 是否可重做 |
| `grid` | `writable` | 初始谜题格（由 `generate` / `decodeSencode` 设置） |
| `invalidCells` | `derived` | 由 `userGrid` 派生，列出冲突格子坐标 |

### 3. 哪些状态留在领域对象内部？

| 状态 | 位置 | 说明 |
|---|---|---|
| 内部 grid 数组 | `Sudoku` 对象 | 不直接暴露给 UI |
| undo 栈 | `Game` 对象 | 每个元素是 `Sudoku.clone()` 的快照 |
| redo 栈 | `Game` 对象 | 同上 |

### 4. 如果直接 mutate 内部对象，会出现什么问题？

如果不通过 store adapter、而是直接修改 `game.getSudoku().getGrid()` 返回的数组（例如 `grid[0][2] = 4`），会发生：

1. **Svelte 不会刷新**。因为 Svelte 的响应式依赖于 store 的 `set()` / `update()` 被调用。直接修改数组元素不触发任何 store 通知。
2. **UI 显示与领域对象状态不同步**。用户在界面上看不到任何变化，但内部数据已经被修改了。
3. **undo/redo 历史被破坏**。`Game` 的 undo 栈保存的是 `Sudoku.clone()` 的快照。如果直接 mutate 当前 `Sudoku`，可能会同时污染快照（若 `getGrid()` 没有做防御性拷贝）。

本方案通过以下两点避免该问题：
- `getGrid()` 每次返回新数组（防御性拷贝），避免外部持有引用后误修改内部状态。
- 所有写入操作均通过 `domainGame.guess()` → `_sync()` 进行，保证 Svelte store 始终收到通知。

---

## C. 改进说明

### 1. 相比 HW1，改进了什么？

HW1 中领域对象（`Sudoku` / `Game`）与 Svelte UI 是脱离的：UI 直接操作 `@sudoku/stores/grid.js` 中的 writable store，领域对象只在测试中被使用。

HW1.1 的改进：

1. **创建了 `src/domain/index.js`** —— 纯 JS 领域对象，不依赖任何 Svelte API，可独立测试。
2. **创建了 `domainGame` store adapter** —— 桥接领域层与 Svelte 响应式系统。
3. **`userGrid.set()` 现在路由到 `domainGame.guess()`** —— 用户输入真正经过领域对象，而不是直接操作数组。
4. **Undo / Redo 按钮真正接入了领域对象** —— 之前按钮无效，现在点击会调用 `game.undo()` / `game.redo()`，并响应式刷新 UI。
5. **`canUndo` / `canRedo` 响应式暴露给 UI** —— 按钮在没有历史时自动禁用。

### 2. 为什么 HW1 的做法不足以支撑真实接入？

HW1 的 `userGrid` 直接用 writable store 存储数组，`set()` 方法直接 mutate 数组元素：

```js
// HW1 做法（有问题）
userGrid.update($userGrid => {
    $userGrid[pos.y][pos.x] = value;
    return $userGrid; // 返回同一引用，Svelte 有时不会刷新
});
```

问题：
- 返回同一数组引用时，Svelte 可能不触发重渲染（浅比较）。
- 没有 undo/redo 历史记录。
- 领域逻辑（校验、历史管理）散落在 store 和组件中。

### 3. 新设计的 trade-off

| 优点 | 缺点 |
|---|---|
| 领域对象纯粹，可独立测试 | `_sync()` 每次调用都分配新数组（性能开销，对 9×9 棋盘可忽略） |
| Svelte 更新可靠（新引用） | 需要维护 store adapter 额外层 |
| undo/redo 历史存在领域层，逻辑清晰 | 每次 guess 都克隆整个棋盘（9×9=81 格，开销小） |
| UI 组件只负责读取和触发，无业务逻辑 | |

如果将来迁移到 Svelte 5，`domainGame` store adapter 层最可能改动（改用 runes），而 `src/domain/index.js` 的纯领域对象层完全不需要改动，稳定性最高。

---

## 附：文件结构

```
src/
  domain/
    index.js              ← 纯领域对象（createSudoku, createGame, ...）
  node_modules/@sudoku/
    stores/
      domainGame.js       ← Svelte store adapter，桥接领域层与 UI
      grid.js             ← 更新：userGrid 代理到 domainGame，暴露 canUndo/canRedo
    game.js               ← 不变（startNew / startCustom 通过 grid.generate 触发 domainGame.init）
  components/
    Controls/ActionBar/
      Actions.svelte      ← 更新：Undo/Redo 按钮接入 domainGame
tests/
  hw1/                    ← 测试纯领域对象（全部通过）
```
