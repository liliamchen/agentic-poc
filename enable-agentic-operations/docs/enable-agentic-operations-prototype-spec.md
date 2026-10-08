# Enable Agentic Operations Prototype Spec

**版本：** 0.30（与当前 Prototype 同步）  
**更新时间：** 2026-10-08  
**项目目录：** `enable-agentic-operations`  
**交付物：** 可交互的高保真前端 Prototype  
**产品方向：** Operation Automation Platform 的 Agentic Experience  
**核心场景：** MUFG Monthly Investment Report、Daily Cash Flow Reconciliation、BIS Risk Asset Report  
**目标读者：** Product、UX、Coding Agent、Frontend、AI / Backend

---

## 1. 产品定位

### 1.1 产品描述

Enable 是一个面向金融运营团队的 Agent-driven Operations Automation Platform。

用户不应被要求先理解自动化定义、技术步骤或工具调用。用户只需要说明希望完成的业务结果；Enable 负责选择或创建 Flow、从授权来源获取资料、启动 Run、处理可自动解决的问题，并仅在缺少输入、发生数据冲突、需要业务判断或需要审批时请求用户介入。

产品体验从：

```text
找文件 → 上传 → 选择流程 → 启动 → 监控步骤 → 处理失败 → 下载结果
```

转变为：

```text
表达目标 → Agent 执行 → 必要时介入 → 检查并批准结果
```

### 1.2 核心设计原则

1. **Agent first**：自然语言是发起、调整和恢复工作的统一入口。
2. **Outcome oriented**：优先展示业务状态、需要用户处理的事项和最终结果。
3. **Run as the execution record**：每次手动、定时或事件触发的执行都形成一个 Run。
4. **Retrieve before upload**：先搜索授权来源，上传文件只是缺失资料时的 fallback。
5. **Human in the loop by exception**：正常执行不打扰用户；判断、权限和审批节点才出现 Gen UI。
6. **Trust through evidence**：来源、权限、决定、审批、版本、恢复操作和结果都可追踪。
7. **Progressive disclosure**：默认隐藏工具调用和技术步骤，需要时再展开 Run details 或 Audit log。
8. **Conversation continuity**：所有 Agent 回复、用户操作和生成式 UI 结果保留在同一 Request 对话中。
9. **Minimal interface**：界面风格接近 Codex、ChatGPT、Gemini；不增加无任务价值的卡片、说明或装饰元素。

### 1.3 Prototype 要证明的价值

- 用户可以从首页直接运行 Flow、创建 Schedule 或创建 Flow。
- 用户不需要预先上传文件或理解技术执行步骤。
- 手动触发和 Schedule 触发使用同一个 Run 模型。
- Agent 可以发现缺失文件、数据冲突和需要审批的结果，并给出结构化处理界面。
- Flow 可以由 Agent 创建，也可以人工编辑、预览、发布、比较和回滚版本。
- Run 可以取消；失败后可以 Retry、Resume 或 Rerun。
- Toolkit 权限、数据决定、审批和 Artifact 版本具有清晰审计记录。

---

## 2. 统一产品模型

### 2.1 用户可见对象

| 对象 | 定义 | 示例 |
| --- | --- | --- |
| **Request** | 用户与 Enable 的一次持续协作对话 | “Run MUFG Monthly Investment Report for April 2026” |
| **Flow** | 可重复、可编辑、可发布的业务自动化定义 | MUFG Monthly Investment Report |
| **Run** | Flow 在某个业务周期、客户和触发上下文中的一次实际执行 | MUFG Monthly Investment Report · April 2026 |
| **Schedule** | Flow 的定时触发配置；到时创建新的 Run | Last business day, 09:00 |
| **Artifact** | Run 使用或生成的版本化文件 | PDF v1、PDF v2、Word report |
| **Toolkit** | Enable 可使用的连接、工具及其权限边界 | Outlook、SharePoint、Excel、Word / PDF |
| **Decision** | 用户对冲突数据、缺失资料或业务例外做出的选择 | 使用 Approved Risk Ledger 的 1.241B |
| **Approval** | 用户对当前 Artifact 版本做出的受审计批准 | Erin Chen 批准 PDF v2 |

### 2.2 对象关系

```text
Request ──创建或操作──> Flow
Request ──创建或修改──> Flow.Schedule
Request ──启动或处理──> Run

Flow 1 ───────────────> N Runs
Flow 1 ──可配置────────> 0..1 Active Schedule（Prototype 范围）
Schedule 每次触发──────> 1 个新 Run
Run 1 ────────────────> N Artifact versions
Run 1 ────────────────> N Decisions / Approvals / Audit events
Run 1 ──失败恢复───────> Retry attempt / Resume checkpoint，或新的 Rerun
```

### 2.3 Run 命名规则

- Flow 表示可重复定义，不带具体执行周期。
- Run 使用 `Flow name + period/date`。
- 示例：
  - Flow：`MUFG Monthly Investment Report`
  - Run：`MUFG Monthly Investment Report · April 2026`
  - Run：`Daily Cash Flow Reconciliation · 6 October 2026`
- 不使用缺乏业务含义的 `Run #1` 作为主名称。
- Run number 仅作为技术标识，显示在 Run details 中。

### 2.4 Schedule 的产品边界

- Schedule 不是一级导航，也不是独立的日常工作视图。
- Schedule 是 Flow 的触发配置，在 Flow 右侧 Detail Panel 中查看和管理。
- 没有 Schedule 的 Flow 显示 `+ Add`。
- 用户可直接设置 Frequency / Time，也可选择 `Create with Agent`。
- Schedule 到时只负责创建 Run；创建后的执行统一进入 Runs。
- Runs 页面通过 `Scheduled` trigger filter 查看定时触发的执行，不增加 Schedules tab。
- 旧 `/schedules` 路由仅作兼容跳转，返回对应 Flow。

### 2.5 Request 与 Run 的关系

- Request 是对话和协作记录；Run 是实际执行记录。
- 从 Flow Detail 点击 `Run Flow` 时，先进入 Agent Workspace，并保留自然语言输入，例如 `Run “MUFG Monthly Investment Report”`。
- 点击 Flow、Schedule、Approve、Request changes 等 Gen UI 操作时，用户选择会作为一条自然的 User input 保留在对话中。
- 一个 Request 可以创建或处理多个对象，但每个 Run、Flow、Schedule 和 Artifact 仍有独立的长期管理入口。
- Run Inspector 中可 `Open conversation`；Agent Workspace 顶部可 `View Run`，形成双向跳转。

### 2.6 Prototype 实现映射

当前代码中的 `WorkItem` / `workItems` 是早期实现命名，产品 UI 已统一显示为 `Run` / `Runs`。在后续工程化中建议迁移为 `RunRecord` / `runs`；在迁移完成前，二者语义一一对应，不应在用户界面继续显示 “Work Item” 或 “Work”。

---

## 3. 信息架构

### 3.1 左侧导航

```text
Enable

[ + New Request ]

Runs                  [attention count]
Flows
Toolkit
Insights

Pinned Requests       （有 pinned item 时出现）
Recent Requests

Reset demo

Erin Chen              （底部 sticky）
```

### 3.2 导航规则

- 顶部 `Enable` 只显示文字，不显示 Logo 图标。
- `Enable` 与 `New Request` 保持顶部 sticky。
- 中部导航、Pinned Requests、Recent Requests 可滚动。
- User avatar 和名称固定在底部，保持紧凑高度和较小 avatar。
- 一级导航使用 `Runs`，不使用 `Work`。
- 不提供独立的 `Schedules` 一级导航。
- 当前选中的一级导航使用更明确的灰色背景。
- `New Request` 使用 outlined button。

### 3.3 Recent Requests

- 显示最近 5 条未归档 Request。
- 正在运行的 Request 显示旋转 loading indicator。
- 等待数据决定、文件、Flow 确认、Schedule 确认或审批的 Request 显示蓝色 attention dot。
- 打开 Request 但未完成需要的操作时，蓝点不应消失；只有对应 checkpoint 被解决后才移除。
- Hover 时显示 `More` 和 `Pin`，顺序为 More 在左、Pin 在右。
- More menu 包含 Rename、Archive、Delete。
- Pinned Request 移入 `Pinned Requests` section。
- Recent Requests 的标题应保留用户实际输入，尤其从 Flow Detail 发起 Run 时必须一致。

---

## 4. 页面与交互职责

### 4.1 New Request 首页

**目标：** 让用户在页面中央快速表达希望 Enable 完成的工作。

布局：

- 标题：`What would you like Enable to handle?`
- 简短说明。
- 三个胶囊快捷入口：
  - `Run Flow`
  - `Schedule`
  - `Create Flow`
- 居中的 Chat Composer。
- 不增加额外 Dashboard、推荐卡片或底部 bar。

Prompt 行为：

- 空闲状态每 3 秒切换一个真实业务 Prompt。
- Prompt 切换使用轻微渐隐渐现。
- 鼠标 hover / focus 时 Prompt 显示为更明确的选中态。
- focus 后停止自动轮换。
- focus 时将当前 Prompt 带入编辑状态，Send 变为 active。

快捷入口行为：

- 点击胶囊只将意图带入 Composer 并聚焦输入框，不直接执行。
- `Run Flow` 打开已发布 Flow picker。
- `Schedule` 打开 Flow picker，选择要配置 Schedule 的 Flow。
- `Create Flow` 带入 `Create a Flow for ...`。
- 用户仍需要点击 Send，避免误触发执行或创建。

Slash commands：

| Command | 用途 |
| --- | --- |
| `/run` | 选择已发布 Flow 并创建 Run 请求 |
| `/schedule` | 选择 Flow 并创建或修改 Schedule |
| `/create-flow` | 开始创建 Flow |

### 4.2 Agent Workspace

**目标：** 保留完整对话，并在需要判断或操作时提供最小、明确的 Generative UI。

布局：

- 顶部：Request 或当前 Run 名称、状态、`View Run`、Summary toggle。
- 中部：连续对话与 Agent 输出。
- 底部：悬浮 Composer，不增加承载 Composer 的整条底栏。
- 右侧 full-height Artifact Panel 仅用于 PDF / Artifact preview。

对话保留规则：

- Run Flow、Create Flow、Create Schedule、确认数据、上传文件、继续搜索、Request changes、Approve 等操作都保留在对话记录中。
- 用户点击按钮产生的选择以自然语言 User message 表达。
- Agent 的结构化结果保留为 flex card，不因状态完成而消失。
- Create Flow 完成后仍保留表单、tool execution summary、Flow preview 和 publish result。
- Thinking 与正式 Agent response 分开，但视觉距离较近。

Thinking chain：

- 不使用灰色背景卡片。
- 不使用完成勾 icon。
- 使用较浅的灰色文字。
- 运行中可展示必要步骤；完成后折叠为简短摘要，例如 `Thinking complete`。
- `Flow created · 3 tools called`、`File found · 2 tools called` 等属于 Thinking / tool chain 摘要，不放入主要 Gen UI 内容。

Generative UI 原则：

- 使用受控组件，不生成任意 React 或 HTML。
- 表单字段以统一的 key-value / form element 样式展示。
- Flow、Sources、Report to approve、Comment 使用统一字段语言。
- 减少分割线、嵌套 Card 和重复说明。
- 只显示用户做决定所需的信息，不展示无关 control 元数据。
- 需要批准的动作必须包含 Comment textarea。

### 4.3 Agent Workspace Summary

- Summary 不是右侧 Artifact Panel。
- 点击 Summary icon 后，在内容布局中出现一张占据实际页面空间的 Card；主对话宽度相应收窄。
- 再次点击或关闭 Card 后恢复完整对话宽度。
- Summary 只包含：
  - Selected run
  - Other runs in this request（仅多 Run 时）
  - Sources
  - Output
- Sources 可点击并打开 Toolkit。
- Output 与 Sources 分开；PDF 可点击并打开 Artifact Panel。
- 不显示重复或低价值字段，例如 Flow、Execution definition、Governed source profile。
- `Selected run` 取代含义不清的 `Current run / Related run`。

### 4.4 PDF Artifact Panel

- 从 Agent Workspace 或 Run Inspector 点击 PDF 时，打开 full-height 右侧 Artifact Panel。
- Panel 必须显示真实 PDF preview，不使用普通详情卡模拟 PDF。
- Panel 包含文件名、版本和生成时间。
- Artifact Panel 占据内容区完整高度。
- 关闭后恢复原页面宽度和上下文。

### 4.5 Runs

**目标：** 统一管理所有实际执行，无论由用户、Schedule 或 Event 触发。

列表：

- 页面名称为 `Runs`。
- Trigger tabs / segmented filter：All runs、Requested、Scheduled、Event。
- 支持搜索 Flow 和 Run。
- 支持 Status filter。
- 使用 Flow tree table：Flow 为父行，下面展开对应 Runs。
- Flow 行不显示 description，避免信息噪音。
- Run 名称使用 Flow name + period/date。
- 每个 Run 显示 Status、Trigger、Updated 和 View。
- 不提供单独的 Schedules tab；Scheduled 只是 Trigger filter。

状态：

```ts
type RunStatus =
  | 'queued'
  | 'working'
  | 'pending'
  | 'needs_attention'
  | 'ready_for_approval'
  | 'delivering'
  | 'completed'
  | 'cancelled'
  | 'failed';
```

### 4.6 Run Inspector

点击 Run 后在右侧打开 full-height Inspector，不跳到独立详情页。

Inspector 从上到下包含：

1. Run name 和技术标识。
2. Current status 与业务说明。
3. 需要处理的 Decision / Missing file / Approval。
4. 当前 Report。
5. Previous report versions。
6. 可折叠 Run details。
7. 可折叠 Audit log。
8. 底部 Run actions。

交互：

- `Open conversation` 返回带当前 Run context 的 Agent Workspace。
- Working、Pending、Needs attention、Ready for approval 等未结束状态可 `Cancel run`。
- Cancel 必须二次确认，并说明已有 Artifact 与 Audit 保留。
- 需要用户介入时，从 Inspector 跳转 Agent Workspace 完成，不在列表或 Inspector 中塞入完整审批表单。

### 4.7 Missing file / Pending case

Daily Cash Flow Reconciliation 必须覆盖缺失文件场景：

```text
已找到：
- Daily_Cash_Ledger_2026-10-04.xlsx
- Custodian_Cash_Confirmation.msg

缺失：
- Treasury_Adjustment_Approval.msg
```

- Run 状态为 `pending`。
- 用户可上传 `.msg` 文件。
- 用户也可选择 `Continue searching`，由 Agent 在授权邮件来源中继续查找。
- 搜索过程显示 Thinking / tool chain；完成后显示找到的文件结果。
- 无论上传或 Agent 找到文件，处理记录都写入对话与 Audit log。

### 4.8 Data conflict case

MUFG Monthly Investment Report 必须覆盖冲突数据确认：

- Email AUM：`1.238B`。
- Approved worksheet / Risk Ledger：`1.241B`。
- Agent 明确展示来源、更新时间、授权级别和推荐值。
- 用户可接受推荐值，也可选择另一个值并填写 override reason。
- 决定作为 User input、Decision 和 Audit event 保留。
- 确认后同一 Run 继续，不创建新的 Run。

### 4.9 Approval

- 报告生成后进入 `ready_for_approval`。
- Approval Gen UI 内即可点击并预览 PDF。
- 表单只保留 Flow、Sources、Report to approve 和 Comment 等必要字段。
- Comment 必填。
- 操作为：
  - `Request changes`
  - `Approve report and complete`
- 主批准按钮颜色为 `#001aff`。
- Request changes 后保留原 Artifact，生成新版本后再次等待审批。
- Approval 只针对当前 Artifact version。
- Prototype 中审批完成 Run 并保存报告，不启动真实 external delivery。
- 完成后显示 completion hint、批准人、时间、评论和生成的 Report。

### 4.10 Artifact version history and comparison

- Run Inspector 的 `Report` 只显示当前版本。
- 旧版本放在 `Previous versions`，避免 `Latest result` 与 `Report versions` 重复。
- 每个旧版本可 `Compare with current`。
- 比较视图显示 Baseline、Current 和业务变化，例如：
  - AUM source
  - Validation evidence
  - Review status
- 可分别 Preview baseline 与 current PDF。
- 版本比较不覆盖或删除任何 Artifact。

### 4.11 Run Audit Log

所有 Run 使用统一 Audit log，记录：

- Run 启动与 Trigger。
- Agent 活动与 checkpoint。
- Source retrieval 与 missing file resolution。
- Data decision、选择值、理由和用户。
- Artifact 创建与版本。
- Approval comment、审批人和时间。
- Retry / Resume / Rerun / Cancel。

每条记录至少包含 `title`、`detail`、`actor` 和 `timestamp`。

### 4.12 Failed Run recovery

失败 Run 显示 Failure reason、Failed step 和已保留 Checkpoint，并提供：

| 操作 | 行为 |
| --- | --- |
| **Retry failed step** | 在当前 Run 中只重试失败步骤 |
| **Resume from checkpoint** | 在当前 Run 中从最近有效 checkpoint 继续 |
| **Rerun from start** | 使用最新 Flow 版本和输入创建新的 Run |

所有恢复操作写入 Audit log。Rerun 不覆盖原失败 Run。

### 4.13 Flows

**目标：** 管理重复、受治理的自动化定义。

Flow list：

- 显示 Name、Status、Owner、Runs、Updated。
- 点击 Flow 在右侧 full-height Panel 打开 Detail。
- 页面主操作为 `Create with Agent`。
- Flow 状态包含 Draft、Active、Paused。

Flow Detail Panel 顺序：

1. Status、Owner、Description。
2. Source 与 Approval policy。
3. Schedule。
4. Inputs。
5. Output。
6. How it runs。
7. Checks before approval。
8. Flow versions。
9. Recent runs。

Schedule 放在靠前位置，因为它是 Flow 的常用运行配置。

底部操作：

- Draft：`Edit Flow`、`Publish Flow`。
- Active：`Edit Flow`、`Run Flow`。

### 4.14 Create Flow with Agent

```text
Flows → Create with Agent
→ Agent thinking
→ Gen UI 表单：Flow name、Flow description
→ 用户确认
→ Agent 调用工具创建 Draft
→ Flow preview
→ Publish
→ View Flow / Run Flow
```

规则：

- 点击 Create with Agent 作为一条 User input 保留。
- 表单使用简单 form elements，不做多步骤 Wizard。
- Agent 创建过程作为 Thinking chain，完成后折叠。
- Draft 创建后必须先 Preview，再 Publish。
- Publish 后显示 `View Flow` 和 `Run Flow`。
- 所有 Agent 回复和用户操作都保留，不能只剩 `Thinking complete`。

### 4.15 Edit Flow

- Flow 可编辑，不只允许 Agent 创建。
- `Edit Flow` 打开 full-height editor panel。
- 可编辑 Name、Description、Source、Inputs、Steps、Outputs、Validation rules、Approval policy。
- 保存前先进入 Change Preview。
- Preview 展示当前版本与 Draft 的 changed fields。
- Publish 后创建新的 Flow version，不覆盖旧版本。

### 4.16 Flow version history, comparison and rollback

- Flow Detail 显示 `vN current` 和 previous published versions。
- 每个旧版本显示 change summary，并可 Compare。
- Comparison 对比旧版本与 current 的 Definition fields。
- Rollback 文案使用 `Restore vN as new version`。
- Restore 不删除历史；以旧版本 snapshot 创建新的版本 `vCurrent+1`。
- 已有 Runs 始终保留它们当时使用的 Flow version 与历史。

### 4.17 Flow Schedule

- 已配置 Schedule 时显示 Status、Frequency、Next run 和 `Modify with Agent`。
- 未配置时显示 `+ Add`。
- Add dialog 支持：
  - Every weekday
  - Every Monday
  - Last business day of the month
  - Start time
- 用户可直接 `Add schedule`，也可 `Create with Agent`。
- Agent 创建 Schedule 时使用统一表单风格，确认后调用工具并显示创建结果。
- 创建成功后返回 Flow Detail；后续定时执行作为 Run 出现在 Runs 和 Recent runs。

### 4.18 Toolkit permissions and change audit

Toolkit 页面显示 Connection、Description、Scope、Last used 和 Status。

点击连接后打开右侧 full-height Panel，包含：

- Connection status 与 governed scope。
- 每项能力的最大权限：
  - No access
  - Read only
  - Use in Runs
  - Approval required
- Save permission changes。
- Change audit。

每次保存必须追加审计，记录 before / after、actor 和 timestamp。权限由应用控制，Agent 不能越权或自行提升权限。

### 4.19 Insights

Prototype 展示：

- Runs completed。
- Automation completion rate。
- Human intervention rate。
- Average processing time。
- Uploads avoided。
- Estimated time saved。

---

## 5. Trust & Control 设计框架

金融运营场景中的信任不通过增加说明文字建立，而通过可验证的控制点建立。

| 层级 | 产品体现 |
| --- | --- |
| **Scope** | Toolkit 明确连接范围和可执行权限 |
| **Source** | 决定和审批展示输入来源、时间和授权状态 |
| **Control** | 高风险动作必须由用户批准；Comment 必填 |
| **Evidence** | Run Audit log 保留 Agent、Scheduler 和 User 行为 |
| **Versioning** | Flow 与 Artifact 都可查看、比较且不覆盖历史 |
| **Recovery** | 失败支持 Retry、Resume、Rerun，原记录保留 |
| **Transparency** | 技术细节默认折叠，但可从 Run details 和 Audit 展开 |
| **Accountability** | Decision、Approval、Permission change 都记录 actor 和时间 |

原则：

- 不把大量 “governed / controlled / trusted” 文案重复显示在 UI 中。
- Trust 应由来源链接、权限状态、审批表单、版本和审计事实证明。
- 正常执行保持安静；风险点使用明确的 attention 状态和下一步操作。

---

## 6. 核心用户故事

### US-01：自然语言运行已有 Flow

**目标：** 生成某个周期的正式报告。

```text
New Request
→ 输入目标或点击 Run Flow
→ 选择 MUFG Monthly Investment Report
→ 补充 April 2026
→ Send
→ 创建 Request 和 Run
→ Agent 自动取数和执行
```

### US-02：处理数据冲突

**目标：** 在两个值冲突时做出可审计判断。

```text
Recent Request 蓝点
→ 打开 Agent Workspace
→ 查看来源比较和推荐
→ 选择 1.241B / 或 override
→ 决定进入对话和 Audit
→ 原 Run 继续
```

### US-03：补充缺失文件

**目标：** 让 Pending Run 继续。

```text
Runs → Scheduled / Pending
→ 打开 Daily Cash Flow Reconciliation Run
→ Open conversation
→ Upload missing file 或 Continue searching
→ Agent 找到或接收文件
→ Run 继续
```

### US-04：审批报告

**目标：** 预览并批准当前 PDF 版本。

```text
Recent Request 蓝点 / Runs Ready for approval
→ Agent Workspace
→ 点击 Report 预览 PDF
→ 输入 Comment
→ Approve report and complete
→ Completion receipt + final report
```

### US-05：要求修改报告

**目标：** 在批准前让 Agent 修改结果。

```text
Approval Gen UI
→ 输入修改 Comment
→ Request changes
→ 保留 User input 与旧 Artifact
→ Agent thinking
→ 生成 PDF v2
→ 再次审批
```

### US-06：创建并发布 Flow

**目标：** 把重复业务保存为受治理自动化。

```text
Flows → Create with Agent
→ 填 Flow name / description
→ Confirm
→ Agent creates draft
→ Preview
→ Publish
→ View Flow 或 Run Flow
```

### US-07：编辑和回滚 Flow

**目标：** 安全修改业务自动化，同时保留历史。

```text
Flows → Select Flow
→ Edit Flow
→ Preview changes
→ Publish new version
→ Flow versions → Compare
→ Restore old version as a new version（可选）
```

### US-08：配置 Schedule

**目标：** 让 Flow 自动定时运行。

```text
Flows → Select Flow
→ Schedule + Add
→ Manual config 或 Create with Agent
→ Confirm
→ Schedule active
→ 到时创建新的 Scheduled Run
```

### US-09：恢复失败 Run

**目标：** 在不丢失证据的前提下恢复执行。

```text
Runs → Failed Run
→ 查看 failure reason / checkpoint
→ Retry failed step / Resume / Rerun
→ 恢复动作写入 Audit
```

### US-10：治理 Toolkit 权限

**目标：** 控制 Agent 对外部系统能做什么。

```text
Toolkit → Select connection
→ 修改 permission level
→ Save
→ Change audit 记录 actor、时间和变化
```

---

## 7. Demo Fixtures

### 7.1 Flows

| Flow | Status | 关键场景 |
| --- | --- | --- |
| MUFG Monthly Investment Report | Active | 数据冲突、PDF 审批、Artifact versions |
| Daily Cash Flow Reconciliation | Active | 缺失文件、Scheduled Run、Failed recovery |
| BIS Risk Asset Report | Active | Working 状态与数据确认 |
| Weekly Risk Summary | Active | Scheduled Working Run |
| Quarterly Management Fee Review | Draft | Create Flow、Preview、Publish |

### 7.2 默认 Recent Requests

1. `Run “MUFG Monthly Investment Report” for April 2026` — Needs attention。
2. `Create a quarterly management fee review Flow` — Flow preview / publish。
3. `Create a monthly schedule for “MUFG Monthly Investment Report”` — Completed。

### 7.3 关键 Runs

- MUFG April 2026 — needs_attention。
- BIS April 2026 — working。
- MUFG September 2026 — scheduled / ready_for_approval / PDF v1-v2。
- Daily Cash 2 October — completed。
- Daily Cash 5 October — failed，带 checkpoint。
- Daily Cash 6 October — pending missing file。
- Weekly Risk Week 40 — scheduled / working。

### 7.4 Toolkit

- Outlook。
- SharePoint。
- Excel。
- Word / PDF。
- Email Delivery。

---

## 8. Route Map

```text
/requests/new
/requests/:requestId
/requests/:requestId?run=:runId
/runs
/runs?selected=:runId
/flows
/flows?selected=:flowId
/toolkit
/toolkit?selected=:connectionId
/insights
```

兼容路由：

```text
/work               → /runs
/work/:id           → /runs?selected=:id
/runs/:id           → /runs?selected=:id
/flows/:id          → /flows?selected=:id
/schedules/:id      → 对应 Flow panel
```

---

## 9. 最小数据模型

```ts
interface Request {
  id: string;
  title: string;
  status: 'active' | 'completed';
  pinned?: boolean;
  archived?: boolean;
  messages: Message[];
  runIds: string[];
  agentStage?: 'thinking' | 'awaiting_approval' | 'approved';
  updatedAt: string;
}

interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  runId?: string;
  action?: string;
  createdAt: string;
}

interface Run {
  id: string;
  name: string;
  flowId?: string;
  flowVersion?: number;
  requestId?: string;
  scheduleId?: string;
  trigger: 'user' | 'scheduled' | 'event';
  status: RunStatus;
  client: string;
  period: string;
  sourceProfile: string;
  activities: Activity[];
  artifacts: Artifact[];
  decisions: Decision[];
  approval?: Approval;
  failure?: FailureContext;
  createdAt: string;
  updatedAt: string;
}

interface Flow {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused';
  description: string;
  owner: string;
  sourceProfile: string;
  inputs: string[];
  steps: string[];
  outputs: string[];
  validationRules: string[];
  approvalPolicy: string;
  version: number;
  versions: FlowVersion[];
  scheduleId?: string;
  updatedAt: string;
}

interface Schedule {
  id: string;
  flowId: string;
  status: 'active' | 'paused';
  frequencyLabel: string;
  nextRunAt: string;
  owner: string;
  createdAt: string;
}

interface Artifact {
  id: string;
  runId: string;
  name: string;
  kind: 'docx' | 'pdf';
  version: number;
  createdAt: string;
}

interface ToolkitPermission {
  id: string;
  label: string;
  level: 'none' | 'read' | 'use' | 'approve';
}
```

实现注记：当前 Prototype 暂时使用 `WorkItem`、`workItems` 和 `workItemIds` 字段承载 `Run` 语义；更新实现时必须保持数据迁移与 localStorage 兼容。

---

## 10. 状态与数据规则

- 所有操作更新统一的 app-level state。
- 状态持久化到 `localStorage`。
- 刷新、切页、打开或关闭 Panel 不丢失记录。
- 只有 `Reset demo` 恢复初始 fixture。
- Reset 后必须恢复 Recent Requests 标题、默认 Runs、Flows、Schedules、Toolkit permissions 和版本历史。
- Request Messages、Run Activities、Artifacts、Decisions、Approvals、Flow versions 和 Audit events 只能增量追加或有意更新，不得被新响应整体覆盖。
- 新建对象使用稳定唯一 ID。
- Flow picker 只显示 Active Flow，不显示 Draft。
- Schedule 触发、手动运行和事件触发必须调用同一 Run 创建逻辑。
- Cancel、Retry、Resume、Rerun 和 Approval 都需要更新 Run 状态并追加 Audit。

---

## 11. Generative UI Catalog

| Block type | 组件 | 场景 |
| --- | --- | --- |
| `flow_draft_form` | FlowDraftForm | 收集 Flow name / description |
| `flow_draft_preview` | FlowDraftPreview | Publish 前检查 Flow |
| `schedule_draft` | ScheduleDraft | 创建或修改 Schedule |
| `source_summary` | SourceSummary | 展示找到和缺失的输入 |
| `missing_file_resolution` | MissingFileResolution | 上传文件或继续搜索 |
| `source_comparison` | SourceComparison | 处理数据冲突 |
| `artifact_review` | ExecutionApproval | PDF 预览、评论、修改或批准 |
| `completion_receipt` | RequestCompletionResult | 显示完成证据和最终报告 |

所有 Gen UI 必须由 schema 驱动，通过受信任的 Renderer Registry 映射到 React 组件；Agent 不生成或执行任意 HTML、React 或 JavaScript。

---

## 12. MVP 优先级

### P0：核心执行闭环 — Prototype 已覆盖

- New Request。
- Run Flow。
- Manual / Scheduled Run 统一。
- Working / Pending / Needs attention / Ready for approval / Completed。
- Missing file upload 或 Agent search。
- Conflicting data decision。
- PDF preview。
- Approval comment、Request changes、Approve complete。
- Completion receipt。
- Recent Request loading / attention indication。
- Run 与 Agent Conversation 双向跳转。

### P1：自动化管理 — Prototype 已覆盖

- Create Flow with Agent。
- Flow preview and publish。
- Edit Flow and publish changes。
- Add / Modify Schedule from Flow。
- Scheduled Run management。
- Run cancellation。
- Flow tree Runs table。

### P2：治理能力 — Prototype 已覆盖核心演示

- Unified Run Audit Log。
- Artifact version history and comparison。
- Flow version history, comparison and rollback。
- Failed Run Retry / Resume / Rerun。
- Toolkit permission configuration and change audit。

### 仍属于后续 Productionization

- 真实连接器授权和 token lifecycle。
- 细粒度 RBAC 与多角色审批链。
- 完整事件触发规则。
- Production scheduler 和队列。
- 真正的文件转换、邮件发送和外部写入。
- 大规模审计查询、导出和合规 retention policy。

---

## 13. 技术与视觉要求

- React、TypeScript、Vite。
- Tailwind CSS、shadcn/ui、Lucide Icons。
- 使用 CloudAI 语义 token 与既有 AI 组件。
- Desktop-first，重点支持 1280px 和 1440px。
- 左侧固定导航 + 右侧内容区。
- Detail、Inspector 和 Artifact preview 使用 full-height 右侧 panel。
- Agent Workspace Composer 悬浮在内容底部。
- 中性色、轻边框、适度留白；避免重型 Dashboard 和大面积品牌色。
- 主品牌蓝仅用于高价值主操作、focus 和 attention，例如 `#001aff` approval button。
- 页面不出现无业务价值的 tip、重复 badge、嵌套 card 或纯装饰元素。
- 支持键盘操作、focus visible、ARIA label 和 reduced motion。
- Prototype 不调用真实 LLM、邮箱、SharePoint 或发送服务。
- Agent response 使用 deterministic scripted state 与 delay。
- `npm run build` 必须成功且无 console error。

---

## 14. Primary Demo Path

```text
New Request
→ Run Flow
→ 选择 MUFG Monthly Investment Report
→ 输入 April 2026 并 Send
→ Agent 获取 12 个输入并自动修复文件名
→ 发现 AUM 数据冲突
→ 用户确认 1.241B 和来源
→ Agent 生成 PDF
→ 用户打开 full-height PDF preview
→ 填写 Comment
→ Approve report and complete
→ 显示 completion receipt 与 final report
→ View Run
→ 查看 Report versions 与 Audit log
```

治理扩展示范：

```text
Runs → Failed Daily Cash Flow Reconciliation
→ Resume from checkpoint

Flows → MUFG Monthly Investment Report
→ Edit Flow → Preview → Publish v4
→ Compare v3 → v4
→ Restore previous version as v5

Toolkit → Outlook
→ 修改 permission → Save
→ 查看 Change audit
```

---

## 15. 验收标准

### 产品模型

- 一级导航只包含 Runs、Flows、Toolkit、Insights。
- Schedule 在 Flow 内配置；不存在独立 Schedule 工作视图。
- Manual、Scheduled、Event 都创建相同类型的 Run。
- Run 名称为 Flow name + period/date。
- UI 不再使用 Work Item 作为用户可见术语。

### Agent Experience

- 首页 Chat 与标题居中。
- 三个胶囊快捷入口可用，且选择后不自动执行。
- Prompt 每 3 秒轮换，focus 后停止并激活 Send。
- 所有 Agent 和 User 操作记录保留。
- Thinking chain 与 Agent response 分离，样式轻量且完成后折叠。
- Gen UI 使用统一 form / key-value 样式。
- Composer 悬浮，不存在额外底部 bar。

### Run 闭环

- Runs 使用 Flow tree table。
- Scheduled Run 通过 trigger filter 查找。
- Pending missing-file case 可上传或继续搜索。
- Data conflict case 可确认推荐值或 override。
- Approval 前可预览 PDF，Comment 必填。
- Request changes 生成新 Artifact 版本并保留旧版本。
- 完成后显示 completion hint 和最终 Report。
- Run 可 Cancel。
- Failed Run 支持 Retry、Resume、Rerun。

### 治理

- Run Audit log 统一记录 Agent、Scheduler 和 User 行为。
- Artifact 可查看历史并与 current 比较。
- Flow 可编辑、预览、发布、比较和回滚。
- Toolkit 权限可修改，变更进入 Audit。
- 所有高风险动作由应用控制，不由模型自行批准。

### 状态与质量

- 刷新页面后 Demo state 保留。
- Reset demo 恢复完整初始 fixture。
- 路由切换不丢失 Request、Run、Artifact、Decision、Approval 或版本记录。
- 1280px 和 1440px 无关键内容截断。
- 主操作支持键盘访问。
- Build 成功且无 console error。

---

## 16. 最终实现原则

> Request 是用户与 Agent 的协作入口；Flow 定义重复业务如何执行；Schedule 定义 Flow 何时自动启动；Run 是每一次真实执行及其结果、决定、审批和审计记录。

> 对用户而言，Enable 不是一个让人手动编排步骤的自动化工具，而是一个可委派、可介入、可验证、可恢复的金融运营 Agent Workspace。
