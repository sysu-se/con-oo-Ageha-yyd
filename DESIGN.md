# DESIGN.md — Homework 1.1

## 一、领域对象如何被消费

### 1. View 层直接消费的是什么？

View 层消费的是 **Store Adapter**（`domainGame`，位于 `src/node_modules/@sudoku/stores/domainGame.js`）。

组件不直接引用 `Sudoku` 或 `Game`，而是通过两个间接层：

```
Svelte 组件  →  userGrid / domainGame stores  →  Game (domain)  →  Sudoku (domain)
```

### 2. View 层拿到的数据是什么？

| 数据 | 来源 |
|------|------|
| `$userGrid` | `domainGame.subscribe`（当前 9×9 grid） |
| `$invalidCells` | 由 `userGrid` 派生的 `derived` store |
| `$gameWon` | 由 `userGrid` 和 `invalidCells` 派生 |
| `$canUndo` | `domainGame.canUndo`（独立 writable store） |
| `$canRedo` | `domainGame.canRedo`（独立 writable store） |

### 3. 用户操作如何进入领域对象？

**数字输入（Keyboard.svelte）：**
```
用户按键 → handleKeyButton(num)
         → userGrid.set($cursor, num)
         → domainGame.guess($cursor, num)
         → game.guess({ row, col, value })   // 领域对象
         → domainGame._notify()              // 触发 Svelte 更新
```

**撤销 / 重做（Actions.svelte）：**
```
点击 Undo → handleUndo() → domainGame.undo() → game.undo() → _notify()
点击 Redo → handleRedo() → domainGame.redo() → game.redo() → _notify()
```

**提示（Actions.svelte）：**
```
点击 Hint → userGrid.applyHint($cursor)
          → get(domainGame) 获取当前 grid
          → solveSudoku(currentGrid)
          → domainGame.guess($cursor, solvedValue)
```

### 4. 领域对象变化后，Svelte 为什么会更新？

每次领域对象状态改变（`guess` / `undo` / `redo`）后，`domainGame._notify()` 都会调用：

```javascript
_grid.set(_game.getSudoku().getGrid());   // 触发所有订阅了 userGrid 的组件重渲
_canUndo.set(_game.canUndo());
_canRedo.set(_game.canRedo());
```

`_grid` 是 Svelte `writable` store，调用 `set()` 会通知所有订阅者，从而触发 Svelte 响应式更新。

---

## 二、响应式机制说明

### 1. 依赖的机制

本方案使用 **Svelte writable store** 作为响应式边界：

- `domainGame` 内部持有三个 `writable`：`_grid`、`_canUndo`、`_canRedo`
- `userGrid` 将其 `subscribe` 直接代理到 `domainGame.subscribe`（即 `_grid.subscribe`）
- `invalidCells`、`gameWon` 使用 Svelte `derived` 从 `userGrid` 衍生
- 组件中用 `$userGrid`、`$canUndo`、`$canRedo` 自动订阅

### 2. 哪些数据是响应式暴露给 UI 的？

| 响应式数据 | 暴露方式 |
|-----------|---------|
| 当前 9×9 grid | `userGrid`（代理 `domainGame`） |
| 无效格子列表 | `invalidCells`（`derived`） |
| 游戏是否胜利 | `gameWon`（`derived`） |
| 是否可 Undo | `domainGame.canUndo`（writable） |
| 是否可 Redo | `domainGame.canRedo`（writable） |

### 3. 哪些状态留在领域对象内部？

- 历史栈（`past` / `future` 数组，存储 `Sudoku` 克隆）
- `Sudoku` 内部 grid（不直接对外暴露，只通过 `getGrid()` 返回副本）

### 4. 如果直接 mutate 内部对象会出什么问题？

Svelte 的响应式系统基于 **赋值触发通知**（store 的 `set()` / `update()`）。

如果直接 mutate 对象内部字段（如 `grid[row][col] = value` 而不调用 `store.set()`），Svelte **不会**检测到变化，订阅者也不会重新渲染。

具体来说：
- `Sudoku.guess()` 会直接修改其内部数组 —— 这是 OK 的，因为之后立刻调用 `_grid.set(newGrid)` 触发通知
- 如果跳过 `_notify()`，`userGrid` 的订阅者（Board 组件）就不会刷新
- `invalidCells` 和 `gameWon` 依赖 `userGrid` 的 `derived`，同样不会更新

---

## 三、改进说明

### 1. 相比 HW1，改进了什么？

HW1 中：
- 领域对象（Sudoku / Game）只存在于测试中，真实 UI 直接操作旧的数组 stores
- Undo / Redo 按钮没有连接任何逻辑

HW1.1 中：
- 引入 `src/domain/index.js`，包含完整的 `createSudoku` / `createGame` 实现
- 引入 Store Adapter（`domainGame.js`），作为领域层与 Svelte 响应式系统的桥接层
- `userGrid` 不再持有独立的状态，而是直接代理 `domainGame` 的输出
- 所有用户输入（输入数字、提示）都通过 `domainGame.guess()` 进入领域对象
- Undo / Redo 按钮真正接入 `game.undo()` / `game.redo()`，并通过 `canUndo` / `canRedo` store 控制按钮可用状态

### 2. 为什么 HW1 中的做法不足以支撑真实接入？

HW1 的 `userGrid` 是一个独立的 `writable` store，直接存储 9×9 数组。这意味着：
- 输入数字时直接修改数组，绕过了领域对象
- 没有历史记录，Undo / Redo 无法实现
- 领域对象与 UI 完全分离，测试通过但功能缺失

### 3. 新设计的 trade-off

| 优点 | 缺点 |
|------|------|
| 职责清晰：UI 只读 store，领域层管理状态 | 引入了额外的 adapter 层 |
| Undo / Redo 完整可用 | 每次 guess 都做 `getGrid()`（深复制），开销略增 |
| 领域对象纯粹，可独立测试 | 历史不序列化（只序列化当前状态） |
| Svelte 响应式机制无缝对接 | |

---

## 四、核心文件索引

| 文件 | 职责 |
|------|------|
| `src/domain/index.js` | 纯 JS 领域对象：`Sudoku`、`Game` |
| `src/node_modules/@sudoku/stores/domainGame.js` | Store Adapter：将 Game 包装为 Svelte 可消费的 store |
| `src/node_modules/@sudoku/stores/grid.js` | `userGrid` 代理 domainGame；`grid.generate()` 初始化 domainGame |
| `src/components/Controls/ActionBar/Actions.svelte` | Undo / Redo 按钮连接 domainGame |
| `src/components/Controls/Keyboard.svelte` | 数字输入通过 `userGrid.set()` → `domainGame.guess()` |
