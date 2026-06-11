# Agent 工作流增强包

本目录保存从 `addyosmani/agent-skills` 思路中提取并按“秋实笔记”项目裁剪后的工作流和角色提示。它们不是新的产品需求，而是给后续 AI 协作开发使用的工程纪律。

来源参考：

- `addyosmani/agent-skills`：https://github.com/addyosmani/agent-skills
- 原项目许可证：MIT

## 使用原则

- 不把所有内容一次性塞进上下文。根据任务类型，只读取当前需要的 workflow 或 persona。
- 本项目规则优先级更高：本地优先、功能前先写中文设计文档、数据安全、Electron 安全边界、SQLite 本地事实源。
- workflow 是“怎么做”，persona 是“用什么视角审查”。不要让 persona 互相调用。
- 小修小补可以不启用完整流程，但涉及数据、存储、导入导出、附件、搜索、同步、安全边界时必须提高验证强度。

## 推荐的 6 个 Workflow

| 文件 | 用途 |
| --- | --- |
| `skills/spec-driven-development.md` | 功能前先明确设计、验收标准和边界 |
| `skills/doubt-driven-development.md` | 对高风险决策做反向质疑 |
| `skills/security-and-hardening.md` | 处理输入、附件、导入、同步、账号等安全面 |
| `skills/test-driven-development.md` | 用测试证明本地数据行为和边界条件 |
| `skills/code-review-and-quality.md` | 合并前做五维质量检查 |
| `skills/source-driven-development.md` | 框架/API/依赖结论必须查官方来源 |

## 推荐的 4 个 Persona

| 文件 | 角色 |
| --- | --- |
| `personas/code-reviewer.md` | 代码审查者 |
| `personas/test-engineer.md` | 测试工程师 |
| `personas/security-auditor.md` | 安全审计员 |
| `personas/web-performance-auditor.md` | Web 性能审计员 |

## 常用组合

- 新功能：`spec-driven-development` -> `source-driven-development` -> `test-driven-development` -> `code-review-and-quality`
- 数据安全相关功能：再加入 `doubt-driven-development` 和 `security-and-hardening`
- 附件、导入导出、同步：必须加入 `security-and-hardening`，并用 `doubt-driven-development` 检查数据丢失和路径安全风险
- UI 性能或启动速度：使用 `web-performance-auditor`；没有实测数据时只报告“潜在影响”，不能伪造指标
