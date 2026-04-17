# con-oo-Ageha-yyd - Review

## Review 结论

代码已经把 `Game`/`Sudoku` 接入到真实的输入、开局和 Undo/Redo 流程里，但领域层目前更像“带历史的二维数组包装器”，关键数独规则、题面元数据和部分游戏语义仍散落在 Svelte store / 组件中，因此整体上只能算“已接入，但尚未以领域对象为核心”。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | fair |
| JS Convention | fair |
| Sudoku Business | poor |
| OOD | poor |

## 缺点

### 1. 核心数独规则没有沉淀到领域层

- 严重程度：core
- 位置：src/domain/index.js:13-29, src/node_modules/@sudoku/stores/grid.js:115-159, src/node_modules/@sudoku/stores/game.js:7-18
- 原因：`Sudoku` 只保存并写入二维数组，`guess()` 不校验坐标、数字范围、固定题面或冲突合法性，也没有领域级的完成态/非法态接口；重复检查和胜负判断被放在 `invalidCells`、`gameWon` 这些 Svelte store 中完成，导致业务规则没有被 `Game`/`Sudoku` 真正拥有。

### 2. 题面状态被拆成 domain 与旧 grid store 两套事实来源

- 严重程度：core
- 位置：src/node_modules/@sudoku/game.js:13-30, src/node_modules/@sudoku/stores/grid.js:24-30,63-67, src/components/Board/index.svelte:4,48-51, src/node_modules/@sudoku/stores/keyboard.js:1-10
- 原因：开局和载入自定义题目时，先修改旧 `grid` store，再靠 `grid.subscribe(...)` 的副作用重建 `_game`；同时 UI 仍直接读取 `$grid` 来判断 givens、可编辑性和用户数字样式。这说明题面原始信息没有进入领域对象，`Game` 也不是唯一真相源，OOD 边界被拆散了。

### 3. Game 暴露了可变 Sudoku，Undo/Redo 边界可被绕过

- 严重程度：major
- 位置：src/domain/index.js:72-85
- 原因：`getSudoku()` 返回的对象仍带有 `guess()`，调用方可以绕过 `Game.guess()` 直接改棋盘而不记录历史。当前实现虽然没有在主要 UI 路径里这么做，但设计上已经把聚合根的约束打穿，历史一致性依赖使用者自觉。

### 4. 笔记模式仍会写入 Game 历史，产生无效撤销步

- 严重程度：major
- 位置：src/components/Controls/Keyboard.svelte:12-19, src/domain/index.js:82-85
- 原因：notes 模式下先更新 `candidates`，随后无条件执行 `userGrid.set($cursor, 0)`。当该格本来就是空格时，`Game.guess()` 仍会压入 undo 快照，但棋盘没有任何实际变化，Undo/Redo 历史会被“空操作”污染，这与数独游戏的业务语义不一致。

### 5. 单元格点击处理不符合 Svelte 事件绑定惯例

- 严重程度：major
- 位置：src/components/Board/Cell.svelte:39
- 原因：`on:click={cursor.set(cellX - 1, cellY - 1)}` 按 Svelte 3 的静态语义会先求值表达式，再把返回值当 handler；这里更合理的写法应是传函数而不是直接调用。即使暂未运行验证，这种写法本身已经偏离 Svelte 事件编程惯例，并且可能影响选格流程的可靠性。

## 优点

### 1. 使用 Store Adapter 承接了领域对象与 Svelte 响应式之间的边界

- 位置：src/node_modules/@sudoku/stores/grid.js:45-107
- 原因：`createUserGrid()` 在内部持有 `_game`，再通过 `_syncFromGame()` 把当前棋盘和 `canUndo`/`canRedo` 同步到 Svelte store，整体方向符合“领域对象 + 响应式适配层”的推荐方案。

### 2. 真实输入与撤销/重做已经通过领域入口进入游戏流程

- 位置：src/components/Controls/Keyboard.svelte:18-24, src/components/Controls/ActionBar/Actions.svelte:23-29
- 原因：数字输入走 `userGrid.set(...)`，提示走 `userGrid.applyHint(...)`，撤销重做走 `userGrid.undo()/redo()`，组件没有再直接改 `userGrid` 二维数组本身，说明领域接入不是只停留在测试里。

### 3. 快照式历史实现简单直接且可读性好

- 位置：src/domain/index.js:14-20,31-39,82-99
- 原因：`Sudoku` 对输入和输出都做了深拷贝，`Game` 在新操作时清空 redo，并通过 clone 快照完成 undo/redo，逻辑直白、容易验证，也不依赖框架。

### 4. 领域对象提供了基础外表化接口

- 位置：src/domain/index.js:36-45,112-126
- 原因：`Sudoku` 提供 `toJSON()` / `toString()`，`Game` 提供 `toJSON()` / `createGameFromJSON()`，至少把领域对象从纯运行时状态推进到了可展示、可序列化的层次。

## 补充说明

- 本次结论仅基于静态阅读 `src/domain/*` 及其接入链路代码，未运行测试，也未启动浏览器实际点击验证。
- 关于 `src/components/Board/Cell.svelte:39` 的判断，来自对 Svelte 3 事件绑定语义的静态分析，而非运行时复现。
- 评审范围已按要求限制在 `src/domain/*` 及关联的 Svelte 接入代码（主要是 `@sudoku/stores/grid.js`、`@sudoku/game.js`、Board/Controls/Header/Modal 相关组件），未扩展到无关目录。
