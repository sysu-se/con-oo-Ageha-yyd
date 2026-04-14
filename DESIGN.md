# DESIGN.md — HW1.1 领域对象设计与 Svelte 接入说明

## 一、领域对象结构

### `Sudoku`（通过 `createSudoku` 创建）

负责持有并操作棋盘数据。

| 方法 | 职责 |
|------|------|
| `getGrid()` | 返回当前 9×9 grid 的**防御性副本** |
| `guess({ row, col, value })` | 在指定格填入数字 |
| `clone()` | 返回独立的深拷贝 Sudoku |
| `toJSON()` | 序列化为可 JSON 化的普通对象 |
| `toString()` | 返回可读的文字棋盘字符串 |

创建时传入的原始 grid 会被立即深拷贝，外部修改不影响内部状态。

### `Game`（通过 `createGame` 创建）

持有当前 `Sudoku` 并管理 Undo/Redo 历史。

| 方法 | 职责 |
|------|------|
| `getSudoku()` | 返回当前 Sudoku 对象 |
| `guess(move)` | 记录历史快照后调用 `current.guess(move)` |
| `undo()` | 从 history 栈弹出前一状态，将当前状态压入 future 栈 |
| `redo()` | 从 future 栈弹出，将当前压入 history |
| `canUndo()` / `canRedo()` | 判断是否可以撤销/重做 |
| `toJSON()` | 序列化当前棋盘状态 |

新 `guess` 会清空 future 栈，保证分支一致性。

---

## 二、与 HW1 的改进对比

| 方面 | HW1（旧） | HW1.1（新） |
|------|-----------|-------------|
| grid 防御性复制 | 可能直接持有外部引用 | 创建和 `getGrid()` 时均深拷贝 |
| clone 策略 | 简单赋值，存在共享引用风险 | 每行 `row.slice()` 彻底解耦 |
| Undo 存储 | 历史存储方式不统一 | history/future 两个快照栈 |
| 序列化 | 未标准化 | `toJSON()` 返回普通对象，支持 `JSON.stringify` |
| 模块入口 | 无统一入口 | `src/domain/index.js` 统一导出四个工厂函数 |

---

## 三、View 层如何消费领域对象

### 推荐方案：Store Adapter（`createGameStore`）

在 Svelte 组件中，建议通过一个适配层连接领域对象与 UI：

```js
// src/domain/gameStore.js 示例
import { writable } from 'svelte/store';
import { createGame, createSudoku } from './index.js';

export function createGameStore(puzzle) {
  const game = createGame({ sudoku: createSudoku(puzzle) });
  const { subscribe, set } = writable(game.getSudoku().getGrid());

  function notify() {
    set(game.getSudoku().getGrid()); // 触发 Svelte 响应式更新
  }

  return {
    subscribe,
    guess(move) { game.guess(move); notify(); },
    undo()      { game.undo();       notify(); },
    redo()      { game.redo();       notify(); },
    canUndo()   { return game.canUndo(); },
    canRedo()   { return game.canRedo(); },
  };
}
```

组件中：

```svelte
<script>
  import { createGameStore } from '../domain/gameStore.js';
  const gameStore = createGameStore(puzzle);
</script>

{#each $gameStore as row, r}
  {#each row as cell, c}
    <Cell value={cell} on:click={() => gameStore.guess({ row: r, col: c, value: selected })} />
  {/each}
{/each}
<button on:click={gameStore.undo}>Undo</button>
<button on:click={gameStore.redo}>Redo</button>
```

---

## 四、Svelte 响应式机制说明

### 为什么 UI 会更新？

Svelte 的 `writable` store 实现了 **发布-订阅** 接口。当调用 `set(newValue)` 时，所有用 `$gameStore` 订阅该 store 的组件会收到新值并重新渲染。

关键点：**必须将新的值（引用不同的对象或数组）传给 `set()`**，Svelte 才能检测到变化并触发更新。

### 为什么不能直接 mutate 内部对象？

Svelte 3 的响应式依赖于**赋值操作**（assignment）检测变化。如果直接修改 store 内部数组的元素（如 `grid[0][0] = 5`），store 的引用不变，Svelte 不会触发重新渲染。

因此，`notify()` 调用 `game.getSudoku().getGrid()` —— 每次返回**新的数组**（深拷贝）—— 再传给 `set()`，保证 Svelte 能检测到变更。

### 响应式边界

| 数据 | 位置 | 响应式？ |
|------|------|---------|
| `grid` (当前棋盘) | store 暴露给 UI | ✅ 是 |
| `history` / `future` | `Game` 内部 | ❌ 不直接暴露 |
| `canUndo` / `canRedo` | 调用时计算 | 需要手动驱动更新 |

### `$:` reactive statement 的注意事项

`$: derived = game.canUndo()` 这类写法在 Svelte 中不会自动追踪 `game` 对象内部的变化，因为 Svelte 只追踪顶层变量的赋值。应使用 store 派生（`derived`）或在 `notify()` 时同时更新相关状态。

---

## 五、Trade-off

- **快照克隆**：每次 `guess` 都 clone 当前 Sudoku，内存开销与历史步数成正比。对于数独这种小规模棋盘（9×9 = 81 格）完全可接受。
- **序列化仅保存当前状态**：`toJSON()` 不保存 history/future，重载后无法 undo。若需完整状态持久化，可扩展为保存所有历史快照。
- **Store Adapter 层**：适配层职责单一，Svelte 升级到 v5 时只需修改 adapter，领域对象本身无需改动，稳定性好。
