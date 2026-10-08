export type WorkItemStatus =
  | "queued"
  | "working"
  | "pending"
  | "needs_attention"
  | "ready_for_approval"
  | "delivering"
  | "completed"
  | "cancelled"
  | "failed"

export type Trigger = "user" | "scheduled" | "event"

export interface Message {
  id: string
  role: "user" | "agent" | "system"
  content: string
  createdAt: string
  workItemId?: string
  action?: "approve_execution" | "request_changes" | "create_flow" | "publish_flow" | "confirm_schedule" | "confirm_data" | "upload_file" | "continue_search"
}

export interface RequestRecord {
  id: string
  title: string
  pinned?: boolean
  archived?: boolean
  status: "active" | "completed"
  updatedAt: string
  messages: Message[]
  workItemIds: string[]
  draftType?: "schedule" | "flow"
  draftPrompt?: string
  isSummaryOpen?: boolean
  agentStage?: "thinking" | "awaiting_approval" | "approved"
  approvalComment?: string
  flowCreationStage?: "form" | "creating" | "preview" | "published"
  flowDraftName?: string
  flowDraftDescription?: string
  createdFlowId?: string
  scheduleCreationStage?: "form" | "preview" | "creating" | "created"
  createdScheduleId?: string
  scheduleFlowId?: string
  scheduleDraftName?: string
  scheduleDraftFrequencyLabel?: string
  scheduleDraftNextRunAt?: string
  dataConfirmationStage?: "required" | "confirmed"
  dataConfirmationValue?: string
  dataConfirmationSource?: string
  dataOverrideReason?: string
  fileRecoveryStage?: "required" | "searching" | "resolved"
  fileRecoveryMethod?: "upload" | "agent_search"
  recoveredFileName?: string
  revisionStage?: "thinking" | "ready"
  revisionCount?: number
  lastChangeRequest?: string
}

export interface Activity {
  id: string
  label: string
  at: string
}

export interface Artifact {
  id: string
  name: string
  kind: "docx" | "pdf"
  version: number
  createdAt: string
}

export interface Decision {
  id: string
  label: string
  value: string
  decidedAt: string
}

export interface WorkItem {
  id: string
  title: string
  client: string
  reportingPeriod: string
  status: WorkItemStatus
  trigger: Trigger
  requestId?: string
  flowId?: string
  scheduleId?: string
  sourceProfile: string
  runNumber?: number
  runDate?: string
  runCount: number
  updatedAt: string
  activities: Activity[]
  artifacts: Artifact[]
  decisions: Decision[]
  scheduleDraftVisible?: boolean
  failure?: {
    step: string
    reason: string
    checkpoint: string
    failedAt: string
  }
  recoveryMethod?: "retry" | "resume" | "rerun"
}

export interface FlowVersion {
  id: string
  version: number
  publishedAt: string
  publishedBy: string
  changeSummary: string
  snapshot: {
    name?: string
    description: string
    sourceProfile: string
    inputs?: string[]
    steps: string[]
    outputs?: string[]
    validationRules: string[]
    approvalPolicy: string
  }
}

export interface Flow {
  id: string
  name: string
  status: "draft" | "active" | "paused"
  description: string
  owner: string
  sourceProfile: string
  inputs: string[]
  steps: string[]
  outputs: string[]
  validationRules: string[]
  approvalPolicy: string
  updatedAt: string
  version?: number
  versions?: FlowVersion[]
}

export interface Schedule {
  id: string
  name: string
  status: "active" | "paused"
  flowId: string
  sourceProfile: string
  frequencyLabel: string
  nextRunAt: string
  lastResult: string
  approvalPolicy: string
  owner: string
  workItemIds: string[]
  createdAt: string
}

export interface ToolkitConnection {
  id: string
  name: string
  description: string
  status: "connected" | "permission_required" | "error"
  scope: string
  lastUsed: string
  permissions?: ToolkitPermission[]
  audit?: ToolkitAuditEvent[]
}

export type ToolkitPermissionLevel = "none" | "read" | "use" | "approve"

export interface ToolkitPermission {
  id: string
  label: string
  description: string
  level: ToolkitPermissionLevel
}

export interface ToolkitAuditEvent {
  id: string
  action: string
  detail: string
  actor: string
  at: string
}

export interface DemoState {
  requests: RequestRecord[]
  workItems: WorkItem[]
  flows: Flow[]
  schedules: Schedule[]
  toolkit: ToolkitConnection[]
}

export const STORAGE_KEY = "enable-agentic-operations-demo-v3"

export const initialState: DemoState = {
  requests: [
    {
      id: "req-quarterly-client-reporting",
      title: "Run “MUFG Monthly Investment Report” for April 2026",
      status: "active",
      updatedAt: "30 Apr, 10:18",
      workItemIds: ["wi-client-mufg"],
      agentStage: "awaiting_approval",
      dataConfirmationStage: "required",
      messages: [
        {
          id: "msg-q1",
          role: "user",
          content: "Run “MUFG Monthly Investment Report” for April 2026",
          createdAt: "30 Apr, 09:04",
        },
      ],
    },
    {
      id: "req-create-fee-flow",
      title: "Create a quarterly management fee review Flow",
      status: "active",
      updatedAt: "29 Apr, 14:09",
      workItemIds: [],
      draftType: "flow",
      draftPrompt: "Create a quarterly management fee review Flow",
      flowCreationStage: "preview",
      flowDraftName: "Quarterly Management Fee Review",
      flowDraftDescription: "Compare quarterly management fees against approved client schedules.",
      createdFlowId: "flow-draft-fee",
      messages: [
        {
          id: "msg-flow-default-1",
          role: "user",
          content: "Create a quarterly management fee review Flow",
          createdAt: "29 Apr, 13:52",
        },
      ],
    },
    {
      id: "req-create-mufg-schedule",
      title: "Create a monthly schedule for “MUFG Monthly Investment Report”",
      status: "completed",
      updatedAt: "28 Apr, 10:14",
      workItemIds: [],
      draftType: "schedule",
      draftPrompt: "Create a monthly schedule for “MUFG Monthly Investment Report”",
      scheduleCreationStage: "created",
      createdScheduleId: "schedule-mufg-existing",
      scheduleFlowId: "flow-mufg",
      scheduleDraftName: "MUFG Client Reporting",
      scheduleDraftFrequencyLabel: "Last business day, 09:00",
      scheduleDraftNextRunAt: "30 Oct 2026, 09:00",
      messages: [
        {
          id: "msg-schedule-default-1",
          role: "user",
          content: "Create a monthly schedule for “MUFG Monthly Investment Report”",
          createdAt: "28 Apr, 10:02",
        },
      ],
    },
  ],
  workItems: [
    {
      id: "wi-client-mufg",
      title: "MUFG Monthly Investment Report · April 2026",
      client: "MUFG",
      reportingPeriod: "April 2026",
      status: "needs_attention",
      trigger: "user",
      requestId: "req-quarterly-client-reporting",
      flowId: "flow-mufg",
      sourceProfile: "MUFG Reporting Sources",
      runNumber: 1,
      runDate: "30 Apr 2026",
      runCount: 1,
      updatedAt: "30 Apr, 10:18",
      activities: [
        { id: "act-m1", label: "Found 12 of 12 required inputs", at: "09:16" },
        { id: "act-m2", label: "Renamed mufg-data-final2.xlsx using the approved naming rule", at: "09:17" },
        { id: "act-m3", label: "Paused for an AUM source decision", at: "10:18" },
      ],
      artifacts: [],
      decisions: [],
    },
    {
      id: "wi-client-bis",
      title: "BIS Risk Asset Report · April 2026",
      client: "BIS",
      reportingPeriod: "April 2026",
      status: "working",
      trigger: "user",
      flowId: "flow-bis",
      sourceProfile: "BIS Reporting Sources",
      runNumber: 1,
      runDate: "30 Apr 2026",
      runCount: 1,
      updatedAt: "30 Apr, 10:12",
      activities: [
        { id: "act-b1", label: "Validated 9 source files", at: "10:08" },
        { id: "act-b2", label: "Preparing the report package", at: "10:12" },
      ],
      artifacts: [],
      decisions: [],
    },
    {
      id: "wi-scheduled-mufg",
      title: "MUFG Monthly Investment Report · September 2026",
      client: "MUFG",
      reportingPeriod: "September 2026",
      status: "ready_for_approval",
      trigger: "scheduled",
      flowId: "flow-mufg",
      scheduleId: "schedule-mufg-existing",
      sourceProfile: "MUFG Reporting Sources",
      runNumber: 2,
      runDate: "30 Sep 2026",
      runCount: 2,
      updatedAt: "30 Sep, 10:28",
      activities: [
        { id: "act-sm1", label: "Schedule started Run #2", at: "09:00" },
        { id: "act-sm2", label: "Report package generated", at: "10:22" },
        { id: "act-sm3", label: "Prepared report v2 after source validation", at: "10:28" },
      ],
      artifacts: [
        { id: "art-sm-1", name: "MUFG-September-2026-Report.docx", kind: "docx", version: 1, createdAt: "30 Sep, 10:22" },
        { id: "art-sm-2", name: "MUFG-September-2026-Report.pdf", kind: "pdf", version: 1, createdAt: "30 Sep, 10:22" },
        { id: "art-sm-3", name: "MUFG-September-2026-Report.pdf", kind: "pdf", version: 2, createdAt: "30 Sep, 10:28" },
      ],
      decisions: [],
    },
    {
      id: "wi-cash",
      title: "Daily Cash Flow Reconciliation · 2 October 2026",
      client: "Investment Operations",
      reportingPeriod: "2 October 2026",
      status: "completed",
      trigger: "scheduled",
      flowId: "flow-cash",
      scheduleId: "schedule-cash",
      sourceProfile: "Daily Cash Sources",
      runNumber: 1,
      runDate: "2 Oct 2026",
      runCount: 1,
      updatedAt: "2 Oct, 09:08",
      activities: [
        { id: "act-c1", label: "Reconciled 2,184 transactions", at: "09:06" },
        { id: "act-c2", label: "Completed with no unresolved breaks", at: "09:08" },
      ],
      artifacts: [],
      decisions: [],
    },
    {
      id: "wi-cash-failed",
      title: "Daily Cash Flow Reconciliation · 5 October 2026",
      client: "Investment Operations",
      reportingPeriod: "5 October 2026",
      status: "failed",
      trigger: "scheduled",
      flowId: "flow-cash",
      scheduleId: "schedule-cash",
      sourceProfile: "Daily Cash Sources",
      runNumber: 2,
      runDate: "5 Oct 2026",
      runCount: 2,
      updatedAt: "5 Oct, 09:04",
      activities: [
        { id: "act-cf1", label: "Schedule started Run #2", at: "09:00" },
        { id: "act-cf2", label: "Validated the internal ledger checkpoint", at: "09:02" },
        { id: "act-cf3", label: "Run failed while reading the custodian statement", at: "09:04" },
      ],
      artifacts: [],
      decisions: [],
      failure: {
        step: "Load custodian statement",
        reason: "Custodian_Statement_2026-10-05.xlsx could not be read.",
        checkpoint: "Internal ledger validation completed; the validated checkpoint is available.",
        failedAt: "5 Oct, 09:04",
      },
    },
    {
      id: "wi-cash-pending-upload",
      title: "Daily Cash Flow Reconciliation · 6 October 2026",
      client: "Investment Operations",
      reportingPeriod: "6 October 2026",
      status: "pending",
      trigger: "user",
      flowId: "flow-cash",
      sourceProfile: "Daily Cash Sources",
      runNumber: 3,
      runDate: "6 Oct 2026",
      runCount: 3,
      updatedAt: "6 Oct, 09:06",
      activities: [
        { id: "act-cp1", label: "Found 2 of 3 required source files", at: "09:04" },
        { id: "act-cp2", label: "Waiting for Treasury_Adjustment_Approval.msg", at: "09:06" },
      ],
      artifacts: [],
      decisions: [],
    },
    {
      id: "wi-risk",
      title: "Weekly Risk Summary · Week 40, 2026",
      client: "Investment Risk",
      reportingPeriod: "Week 40, 2026",
      status: "working",
      trigger: "scheduled",
      flowId: "flow-risk",
      scheduleId: "schedule-risk",
      sourceProfile: "Risk Reporting Sources",
      runNumber: 1,
      runDate: "2 Oct 2026",
      runCount: 1,
      updatedAt: "2 Oct, 08:54",
      activities: [{ id: "act-r1", label: "Collecting regional risk inputs", at: "08:54" }],
      artifacts: [],
      decisions: [],
    },
  ],
  flows: [
    {
      id: "flow-mufg",
      name: "MUFG Monthly Investment Report",
      status: "active",
      description: "Collect approved inputs and prepare the monthly Word and PDF report.",
      owner: "Investment Reporting",
      sourceProfile: "MUFG Reporting Sources",
      inputs: ["Outlook attachments", "SharePoint reporting files"],
      steps: ["Collect and classify inputs", "Validate approved figures", "Generate Word and PDF", "Request delivery approval"],
      outputs: ["Word report", "PDF report", "Email preview"],
      validationRules: ["All 12 required inputs present", "AUM matched to an authorized source", "Workbook AUM requires an explicit override", "External delivery requires approval"],
      approvalPolicy: "Required before external delivery",
      updatedAt: "24 Apr 2026",
      version: 3,
      versions: [
        {
          id: "flow-mufg-v1",
          version: 1,
          publishedAt: "16 Jan 2026, 14:20",
          publishedBy: "Maya Patel",
          changeSummary: "Initial monthly reporting Flow.",
          snapshot: {
            name: "MUFG Monthly Investment Report",
            description: "Collect client inputs and prepare the monthly report.",
            sourceProfile: "MUFG Reporting Sources",
            inputs: ["Outlook attachments", "SharePoint reporting files"],
            steps: ["Collect inputs", "Generate Word and PDF", "Request delivery approval"],
            outputs: ["Word report", "PDF report"],
            validationRules: ["All required inputs present", "External delivery requires approval"],
            approvalPolicy: "Required before external delivery",
          },
        },
        {
          id: "flow-mufg-v2",
          version: 2,
          publishedAt: "12 Mar 2026, 11:08",
          publishedBy: "Erin Chen",
          changeSummary: "Added authorized-source validation for AUM.",
          snapshot: {
            name: "MUFG Monthly Investment Report",
            description: "Collect approved inputs and prepare the monthly Word and PDF report.",
            sourceProfile: "MUFG Reporting Sources",
            inputs: ["Outlook attachments", "SharePoint reporting files"],
            steps: ["Collect and classify inputs", "Validate approved figures", "Generate Word and PDF", "Request delivery approval"],
            outputs: ["Word report", "PDF report", "Email preview"],
            validationRules: ["All 12 required inputs present", "AUM matched to an authorized source", "External delivery requires approval"],
            approvalPolicy: "Required before external delivery",
          },
        },
        {
          id: "flow-mufg-v3",
          version: 3,
          publishedAt: "24 Apr 2026, 09:42",
          publishedBy: "Erin Chen",
          changeSummary: "Required an explicit override when workbook AUM differs from the approved ledger.",
          snapshot: {
            name: "MUFG Monthly Investment Report",
            description: "Collect approved inputs and prepare the monthly Word and PDF report.",
            sourceProfile: "MUFG Reporting Sources",
            inputs: ["Outlook attachments", "SharePoint reporting files"],
            steps: ["Collect and classify inputs", "Validate approved figures", "Generate Word and PDF", "Request delivery approval"],
            outputs: ["Word report", "PDF report", "Email preview"],
            validationRules: ["All 12 required inputs present", "AUM matched to an authorized source", "Workbook AUM requires an explicit override", "External delivery requires approval"],
            approvalPolicy: "Required before external delivery",
          },
        },
      ],
    },
    {
      id: "flow-cash",
      name: "Daily Cash Flow Reconciliation",
      status: "active",
      description: "Reconcile daily cash transactions and flag unresolved breaks.",
      owner: "Cash Operations",
      sourceProfile: "Daily Cash Sources",
      inputs: ["Custodian statement", "Internal ledger"],
      steps: ["Collect daily files", "Match transactions", "Classify breaks"],
      outputs: ["Reconciliation result"],
      validationRules: ["All accounts represented"],
      approvalPolicy: "Approval required for write-offs",
      updatedAt: "18 Apr 2026",
    },
    {
      id: "flow-bis",
      name: "BIS Risk Asset Report",
      status: "active",
      description: "Prepare the recurring BIS risk asset reporting package.",
      owner: "Regulatory Reporting",
      sourceProfile: "BIS Reporting Sources",
      inputs: ["Risk extracts", "Approved adjustments"],
      steps: ["Collect inputs", "Validate adjustments", "Prepare report"],
      outputs: ["BIS reporting package"],
      validationRules: ["Adjustments have an approver"],
      approvalPolicy: "Required before submission",
      updatedAt: "21 Apr 2026",
    },
    {
      id: "flow-risk",
      name: "Weekly Risk Summary",
      status: "active",
      description: "Consolidate weekly risk inputs and generate the review summary.",
      owner: "Investment Risk",
      sourceProfile: "Risk Reporting Sources",
      inputs: ["Regional risk extracts"],
      steps: ["Collect inputs", "Compare limits", "Generate summary"],
      outputs: ["Weekly risk summary"],
      validationRules: ["All regions submitted"],
      approvalPolicy: "No approval for internal delivery",
      updatedAt: "17 Apr 2026",
    },
    {
      id: "flow-draft-fee",
      name: "Quarterly Management Fee Review",
      status: "draft",
      description: "Compare quarterly management fees against approved client schedules.",
      owner: "Investment Operations",
      sourceProfile: "Fee Review Sources",
      inputs: ["Quarterly fee file", "Approved client schedules"],
      steps: ["Collect files", "Compare fee rates", "Prepare exception summary"],
      outputs: ["Fee exception summary"],
      validationRules: ["Every exception includes an approved schedule reference"],
      approvalPolicy: "Process Owner publishes this Flow",
      updatedAt: "29 Apr 2026",
    },
  ],
  schedules: [
    {
      id: "schedule-mufg-existing",
      name: "MUFG Client Reporting",
      status: "active",
      flowId: "flow-mufg",
      sourceProfile: "MUFG Reporting Sources",
      frequencyLabel: "Last business day, 09:00",
      nextRunAt: "30 Oct 2026, 09:00",
      lastResult: "Ready for approval",
      approvalPolicy: "Required before external delivery",
      owner: "Investment Reporting",
      workItemIds: ["wi-scheduled-mufg"],
      createdAt: "16 Jan 2026",
    },
    {
      id: "schedule-cash",
      name: "Daily Cash Reconcile",
      status: "active",
      flowId: "flow-cash",
      sourceProfile: "Daily Cash Sources",
      frequencyLabel: "Weekdays, 09:00",
      nextRunAt: "5 Oct 2026, 09:00",
      lastResult: "Failed",
      approvalPolicy: "Approval only for write-offs",
      owner: "Cash Operations",
      workItemIds: ["wi-cash", "wi-cash-failed"],
      createdAt: "4 Feb 2026",
    },
    {
      id: "schedule-risk",
      name: "Weekly Risk Summary",
      status: "paused",
      flowId: "flow-risk",
      sourceProfile: "Risk Reporting Sources",
      frequencyLabel: "Every Friday, 08:30",
      nextRunAt: "—",
      lastResult: "Working",
      approvalPolicy: "Internal delivery only",
      owner: "Investment Risk",
      workItemIds: ["wi-risk"],
      createdAt: "12 Mar 2026",
    },
  ],
  toolkit: [
    {
      id: "outlook", name: "Outlook", description: "Retrieve approved reporting emails and attachments.", status: "connected", scope: "Investment Reporting mailbox", lastUsed: "30 Apr, 09:16",
      permissions: [
        { id: "read-mail", label: "Read reporting mail", description: "Find messages and attachments in the governed mailbox.", level: "read" },
        { id: "download-attachments", label: "Use attachments", description: "Download matched attachments into an active Run.", level: "use" },
        { id: "send-mail", label: "Send email", description: "Send messages or reports from the governed mailbox.", level: "approve" },
      ],
      audit: [
        { id: "audit-outlook-2", action: "Permission updated", detail: "Send email changed from No access to Approval required.", actor: "Maya Patel", at: "18 Sep, 15:42" },
        { id: "audit-outlook-1", action: "Connection authorized", detail: "Investment Reporting mailbox access granted.", actor: "IT Administrator", at: "16 Jan, 10:05" },
      ],
    },
    {
      id: "sharepoint", name: "SharePoint", description: "Retrieve governed files from reporting libraries.", status: "connected", scope: "Investment Operations / Client Reporting", lastUsed: "30 Apr, 09:16",
      permissions: [
        { id: "read-files", label: "Read files", description: "Search and retrieve files from the approved library.", level: "read" },
        { id: "write-files", label: "Save generated files", description: "Write generated artifacts into the reporting workspace.", level: "approve" },
      ],
      audit: [{ id: "audit-sp-1", action: "Scope restricted", detail: "Access limited to Investment Operations / Client Reporting.", actor: "IT Administrator", at: "20 Feb, 09:30" }],
    },
    {
      id: "excel", name: "Excel", description: "Inspect workbooks and validate approved figures.", status: "connected", scope: "Files used by active Runs", lastUsed: "30 Apr, 10:17",
      permissions: [
        { id: "inspect-workbook", label: "Inspect workbooks", description: "Read workbook sheets, formulas, and values.", level: "use" },
        { id: "edit-workbook", label: "Edit workbooks", description: "Write values or formulas back to a source workbook.", level: "none" },
      ],
      audit: [{ id: "audit-excel-1", action: "Write access removed", detail: "Edit workbooks changed to No access.", actor: "Erin Chen", at: "28 Apr, 14:09" }],
    },
    {
      id: "word-pdf", name: "Word / PDF", description: "Create controlled report versions and final PDFs.", status: "connected", scope: "Generated reporting workspace", lastUsed: "30 Sep, 10:22",
      permissions: [
        { id: "create-documents", label: "Create report artifacts", description: "Generate versioned Word and PDF outputs.", level: "use" },
      ],
      audit: [{ id: "audit-pdf-1", action: "Permission granted", detail: "Artifact generation enabled for active Runs.", actor: "Maya Patel", at: "16 Jan, 10:12" }],
    },
    {
      id: "email-delivery", name: "Email Delivery", description: "Send approved output to permitted recipients.", status: "permission_required", scope: "Internal test recipients only", lastUsed: "Not used",
      permissions: [
        { id: "internal-delivery", label: "Internal delivery", description: "Send approved reports to internal test recipients.", level: "approve" },
        { id: "external-delivery", label: "External delivery", description: "Send approved reports to external recipients.", level: "none" },
      ],
      audit: [{ id: "audit-email-1", action: "External delivery blocked", detail: "External delivery remains unavailable until permission review.", actor: "Compliance", at: "1 Oct, 16:20" }],
    },
  ],
}

function hydrateDefaultRequestContent(state: DemoState): DemoState {
  const defaultRequests = new Map(initialState.requests.map((request) => [request.id, request]))
  const defaultRuns = new Map(initialState.workItems.map((item) => [item.id, item]))
  const savedRunIds = new Set(state.workItems.map((item) => item.id))
  const runsWithNewDefaults = [
    ...state.workItems,
    ...initialState.workItems.filter((item) => !savedRunIds.has(item.id)),
  ]
  const hydratedWorkItems = runsWithNewDefaults.map((item) => {
    const template = defaultRuns.get(item.id)
    const shortDate = item.updatedAt.split(",")[0]
    return {
      ...item,
      runNumber: item.runNumber ?? template?.runNumber ?? item.runCount,
      runDate: item.runDate ?? template?.runDate ?? (/^\d{1,2} [A-Z][a-z]{2}$/.test(shortDate) ? `${shortDate} 2026` : item.reportingPeriod),
    }
  })
  const correctedRunNumbers = new Map<string, number>()
  const flowIds = new Set(hydratedWorkItems.map((item) => item.flowId ?? "ad-hoc"))
  flowIds.forEach((flowId) => {
    const runs = hydratedWorkItems.filter((item) => (item.flowId ?? "ad-hoc") === flowId)
    if (new Set(runs.map((item) => item.runNumber)).size === runs.length) return
    const parseUpdatedAt = (value: string) => {
      const [date, time = "00:00"] = value.split(", ")
      return Date.parse(`${date}${/\d{4}/.test(date) ? "" : " 2026"} ${time}`)
    }
    runs
      .slice()
      .sort((a, b) => parseUpdatedAt(a.updatedAt) - parseUpdatedAt(b.updatedAt))
      .forEach((item, index) => correctedRunNumbers.set(item.id, index + 1))
  })

  return {
    ...state,
    workItems: hydratedWorkItems.map((item) => ({ ...item, runNumber: correctedRunNumbers.get(item.id) ?? item.runNumber })),
    flows: state.flows.map((flow) => {
      const template = initialState.flows.find((entry) => entry.id === flow.id)
      const version = flow.version ?? template?.version ?? 1
      const versions = flow.versions ?? template?.versions ?? []
      const publishedDefinition = versions.find((entry) => entry.version === version)?.snapshot
      return {
        ...flow,
        ...(publishedDefinition ? {
          name: publishedDefinition.name ?? flow.name,
          description: publishedDefinition.description,
          sourceProfile: publishedDefinition.sourceProfile,
          inputs: publishedDefinition.inputs ?? flow.inputs,
          steps: publishedDefinition.steps,
          outputs: publishedDefinition.outputs ?? flow.outputs,
          validationRules: publishedDefinition.validationRules,
          approvalPolicy: publishedDefinition.approvalPolicy,
        } : {}),
        version,
        versions,
      }
    }),
    toolkit: state.toolkit.map((connection) => {
      const template = initialState.toolkit.find((entry) => entry.id === connection.id)
      return {
        ...connection,
        permissions: connection.permissions ?? template?.permissions ?? [],
        audit: connection.audit ?? template?.audit ?? [],
      }
    }),
    requests: state.requests.map((request) => {
      const template = defaultRequests.get(request.id)
      if (!template) return request

      const shouldHydrate = request.id === "req-quarterly-client-reporting"
        || request.messages.length === 0
      if (!shouldHydrate) return request

      const templateMessageIds = new Set(template.messages.map((message) => message.id))
      const additionalMessages = request.messages.filter((message) => !templateMessageIds.has(message.id))
      return { ...request, messages: [...template.messages, ...additionalMessages] }
    }),
  }
}

export function loadState(): DemoState {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? hydrateDefaultRequestContent(JSON.parse(saved) as DemoState) : initialState
  } catch {
    return initialState
  }
}

let idSequence = 0

export function makeId(prefix: string) {
  idSequence += 1
  return `${prefix}-${Date.now().toString(36)}-${idSequence.toString(36)}`
}

export function getReportFileName(item: WorkItem) {
  if (item.flowId === "flow-bis") return "BIS-Risk-Asset-Report-October-2026.pdf"
  if (item.flowId === "flow-cash") return "Daily-Cash-Flow-Reconciliation-October-2026-Report.pdf"
  if (item.flowId === "flow-mufg") return "MUFG-April-2026-Report.pdf"
  return `${item.title.replaceAll(" · ", " ").replaceAll(" ", "-")}-Report.pdf`
}

export function getRunNumber(item: WorkItem) {
  return item.runNumber ?? item.runCount
}

export function getRunDate(item: WorkItem) {
  return item.runDate ?? item.updatedAt.split(",")[0] ?? item.reportingPeriod
}

export function getRunName(item: WorkItem, flowName?: string) {
  const period = item.reportingPeriod || getRunDate(item)
  const name = flowName ?? item.title
  return name.toLocaleLowerCase().includes(period.toLocaleLowerCase()) ? name : `${name} · ${period}`
}

export function getRunTechnicalLabel(item: WorkItem) {
  return `Run #${getRunNumber(item)} · ${item.trigger}`
}
