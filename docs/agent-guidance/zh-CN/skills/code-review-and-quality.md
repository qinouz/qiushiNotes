# Code Review and Quality

## 何时使用

- 完成一个功能切片后。
- 合并前。
- 改动跨越 renderer/preload/main/db 多层。
- 涉及数据安全、安全边界、性能或未来同步。

## 五维审查

### 1. 正确性

- 是否满足设计文档和验收标准？
- 空值、空列表、边界值、错误路径是否处理？
- 自动保存、软删除、恢复、搜索是否会出现状态不一致？
- 测试是否真的证明了目标行为？

### 2. 可读性

- 命名是否贴合本项目领域语言？
- 控制流是否清楚？
- 注释是否解释“为什么”，尤其是本地优先、同步字段、迁移理由？

### 3. 架构

- 是否保持 Electron 分层：renderer -> preload -> IPC -> main service -> SQLite/filesystem？
- 是否遵循现有目录和服务边界？
- 是否引入了不必要抽象或跨层耦合？

### 4. 安全

- renderer 输入是否在 main/service 边界重新校验？
- SQL、路径、HTML、附件文件名是否安全？
- 是否有秘密、敏感内容或本地路径泄露？

### 5. 性能

- 是否有无界查询、无界文件读取、同步阻塞主流程？
- 列表、搜索、自动保存是否可能因数据量变大而卡顿？
- UI 是否产生不必要的重复渲染？

## 输出格式

```markdown
## Review Summary
Verdict: APPROVE | REQUEST CHANGES

### Critical
- [file:line] 问题和修复建议

### Important
- [file:line] 问题和修复建议

### Suggestions
- [file:line] 可选改进

### Verification
- Tests:
- Typecheck:
- Build:
- Manual:
```

## 验收清单

- [ ] 先看设计文档和测试，再看实现。
- [ ] Critical/Important 问题都有具体修复建议。
- [ ] 有 Critical 时不能批准。
- [ ] 明确说明已执行或未执行的验证。
