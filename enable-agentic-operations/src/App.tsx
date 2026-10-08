import * as React from "react"

import { AppShell } from "@/app-shell"
import {
  FlowListPage,
  InsightsPage,
  NewRequestPage,
  NotFoundPage,
  RequestWorkspacePage,
  ToolkitPage,
  WorkListPage,
  type FlowEditInput,
} from "@/pages"
import {
  initialState,
  getReportFileName,
  getRunNumber,
  loadState,
  makeId,
  STORAGE_KEY,
  type DemoState,
  type Flow,
  type FlowVersion,
  type RequestRecord,
  type Schedule,
  type ToolkitConnection,
  type ToolkitPermission,
  type WorkItem,
} from "@/model"

const RESET_SIGNAL_KEY = `${STORAGE_KEY}:reset`

function cloneInitialState(): DemoState {
  return JSON.parse(JSON.stringify(initialState)) as DemoState
}

function RunInspectorRedirect({ item, onNavigate }: { item: WorkItem; onNavigate: (path: string) => void }) {
  React.useEffect(() => {
    onNavigate(`/runs?selected=${item.id}`)
  }, [item.id, onNavigate])

  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Opening run details…</div>
}

function LegacyRunsRedirect({ selectedId, onNavigate }: { selectedId?: string; onNavigate: (path: string) => void }) {
  React.useEffect(() => {
    onNavigate(selectedId ? `/runs?selected=${selectedId}` : "/runs")
  }, [selectedId, onNavigate])

  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Opening Runs…</div>
}

function FlowInspectorRedirect({ flow, onNavigate }: { flow: Flow; onNavigate: (path: string) => void }) {
  React.useEffect(() => {
    onNavigate(`/flows?selected=${flow.id}`)
  }, [flow.id, onNavigate])

  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Opening Flow…</div>
}

function ScheduleRedirect({ flowId, onNavigate }: { flowId?: string; onNavigate: (path: string) => void }) {
  React.useEffect(() => {
    onNavigate(flowId ? `/flows?selected=${flowId}` : "/flows")
  }, [flowId, onNavigate])

  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Opening Flow schedule…</div>
}

export default function App() {
  const [state, setState] = React.useState<DemoState>(loadState)
  const [route, setRoute] = React.useState(() => `${window.location.pathname}${window.location.search}`)

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  React.useEffect(() => {
    const handlePopState = () => setRoute(`${window.location.pathname}${window.location.search}`)
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const navigate = React.useCallback((next: string) => {
    window.history.pushState({}, "", next)
    setRoute(next)
  }, [])

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== RESET_SIGNAL_KEY) return
      setState(cloneInitialState())
      navigate("/requests/new")
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [navigate])

  const resetDemo = React.useCallback(() => {
    const nextState = cloneInitialState()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    window.localStorage.setItem(RESET_SIGNAL_KEY, String(Date.now()))
    setState(nextState)
    navigate("/requests/new")
  }, [navigate])

  const createRequest = React.useCallback((prompt: string, selectedFlowId?: string) => {
    const normalized = prompt.toLowerCase()
    if (normalized.includes("every month") || normalized.includes("schedule")) {
      createScheduleRequest(prompt, undefined, selectedFlowId)
      return
    }

    if (normalized.includes("create") && (normalized.includes("flow") || normalized.includes("automation"))) {
      const requestId = makeId("req-flow")
      const request: RequestRecord = {
        id: requestId,
        title: "Create a quarterly fee review Flow",
        status: "active",
        updatedAt: "4 Oct, 11:04",
        workItemIds: [],
        draftType: "flow",
        draftPrompt: prompt,
        agentStage: "thinking",
        messages: [
          { id: makeId("msg"), role: "user", content: prompt, createdAt: "4 Oct, 11:04" },
        ],
      }
      setState((current) => ({ ...current, requests: [request, ...current.requests] }))
      navigate(`/requests/${requestId}`)
      return
    }

    const requestId = makeId("req")
    const workItemId = makeId("wi")
    const flow = state.flows.find((entry) => entry.id === selectedFlowId)
      ?? state.flows.find((entry) => entry.id === "flow-mufg")!
    const isMufg = flow.id === "flow-mufg" || normalized.includes("mufg")
    const isBis = flow.id === "flow-bis" || normalized.includes("bis")
    const isCash = flow.id === "flow-cash" || normalized.includes("cash flow reconciliation")
    const runNumber = Math.max(0, ...state.workItems.filter((item) => item.flowId === flow.id).map(getRunNumber)) + 1
    const reportingPeriod = isMufg ? "April 2026" : "October 2026"
    const workItem: WorkItem = {
      id: workItemId,
      title: `${flow.name} · ${reportingPeriod}`,
      client: isMufg ? "MUFG" : isBis ? "BIS" : flow.owner,
      reportingPeriod,
      status: isCash ? "pending" : isMufg || isBis ? "needs_attention" : "working",
      trigger: "user",
      requestId,
      flowId: flow.id,
      sourceProfile: flow.sourceProfile,
      runNumber,
      runDate: "4 Oct 2026",
      runCount: runNumber,
      updatedAt: "4 Oct, 11:06",
      activities: isMufg
        ? [
            { id: makeId("act"), label: `Created Run #${runNumber}`, at: "11:04" },
            { id: makeId("act"), label: "Found 12 of 12 required inputs", at: "11:05" },
            { id: makeId("act"), label: "Renamed mufg-data-final2.xlsx using policy", at: "11:05" },
            { id: makeId("act"), label: "Paused for an AUM source decision", at: "11:06" },
          ]
        : isBis
          ? [
              { id: makeId("act"), label: `Created Run #${runNumber}`, at: "11:04" },
              { id: makeId("act"), label: "Validated 9 source files", at: "11:05" },
              { id: makeId("act"), label: "Paused for a risk asset value decision", at: "11:06" },
            ]
          : isCash
            ? [
                { id: makeId("act"), label: `Created Run #${runNumber}`, at: "11:04" },
                { id: makeId("act"), label: "Found 2 of 3 required source files", at: "11:05" },
                { id: makeId("act"), label: "Paused because Treasury_Adjustment_Approval.msg is missing", at: "11:06" },
              ]
        : [{ id: makeId("act"), label: `Created Run #${runNumber}`, at: "11:04" }],
      artifacts: [],
      decisions: [],
    }
    const request: RequestRecord = {
      id: requestId,
      title: selectedFlowId ? prompt : prompt.replace(/^Run\s+/i, "") || workItem.title,
      status: "active",
      updatedAt: "4 Oct, 11:06",
      workItemIds: [workItemId],
      agentStage: "thinking",
      dataConfirmationStage: isBis ? "required" : undefined,
      fileRecoveryStage: isCash ? "required" : undefined,
      messages: [
        { id: makeId("msg"), role: "user", content: prompt, createdAt: "4 Oct, 11:04" },
      ],
    }
    setState((current) => ({
      ...current,
      requests: [request, ...current.requests],
      workItems: [workItem, ...current.workItems],
    }))
    navigate(`/requests/${requestId}`)
  }, [navigate, state.flows])

  const createScheduleRequest = React.useCallback((prompt: string, targetScheduleId?: string, targetFlowId?: string) => {
    const requestId = makeId("req-schedule")
    const existingSchedule = state.schedules.find((schedule) => schedule.id === targetScheduleId)
    const flowId = targetFlowId ?? existingSchedule?.flowId ?? "flow-mufg"
    const flow = state.flows.find((entry) => entry.id === flowId)
    const request: RequestRecord = {
      id: requestId,
      title: `${targetScheduleId ? "Modify" : "Schedule"} ${flow?.name ?? "Flow"}`,
      status: "active",
      updatedAt: "4 Oct, 11:16",
      workItemIds: [],
      draftType: "schedule",
      draftPrompt: prompt,
      agentStage: "thinking",
      scheduleCreationStage: "preview",
      scheduleFlowId: flowId,
      createdScheduleId: targetScheduleId,
      messages: [
        { id: makeId("msg"), role: "user", content: prompt, createdAt: "4 Oct, 11:16" },
      ],
    }
    setState((current) => ({ ...current, requests: [request, ...current.requests] }))
    navigate(`/requests/${requestId}`)
  }, [navigate, state.flows, state.schedules])

  const confirmSchedule = React.useCallback((
    request: RequestRecord,
    input: { name: string; frequencyLabel: string; nextRunAt: string },
    workItemId?: string,
  ) => {
    setState((current) => {
      const flow = current.flows.find((entry) => entry.id === (request.scheduleFlowId ?? "flow-mufg"))
      if (!flow) return current
      const existing = request.createdScheduleId
        ? current.schedules.find((schedule) => schedule.id === request.createdScheduleId)
        : current.schedules.find((schedule) => schedule.flowId === flow.id)
      const scheduleId = existing?.id ?? makeId("schedule")
      const schedule: Schedule = {
        id: scheduleId,
        name: input.name,
        status: existing?.status ?? "active",
        flowId: flow.id,
        sourceProfile: flow.sourceProfile,
        frequencyLabel: input.frequencyLabel,
        nextRunAt: input.nextRunAt,
        lastResult: existing?.lastResult ?? "Not run yet",
        approvalPolicy: flow.approvalPolicy,
        owner: flow.owner,
        workItemIds: existing?.workItemIds ?? [],
        createdAt: existing?.createdAt ?? "4 Oct 2026",
      }

      return {
        ...current,
        schedules: existing
          ? current.schedules.map((entry) => entry.id === schedule.id ? schedule : entry)
          : [schedule, ...current.schedules],
        requests: current.requests.map((entry) => entry.id === request.id ? {
          ...entry,
          status: "active",
          scheduleCreationStage: "creating",
          createdScheduleId: scheduleId,
          scheduleDraftName: input.name,
          scheduleDraftFrequencyLabel: input.frequencyLabel,
          scheduleDraftNextRunAt: input.nextRunAt,
          updatedAt: "4 Oct, 11:17",
          messages: entry.messages.some((message) => message.action === "confirm_schedule")
            ? entry.messages
            : [
                ...entry.messages,
                {
                  id: makeId("msg-action"),
                  role: "user" as const,
                  content: `Confirm “${input.name}” — ${input.frequencyLabel}, first run ${input.nextRunAt}.`,
                  createdAt: "4 Oct, 11:17",
                  action: "confirm_schedule" as const,
                },
              ],
        } : entry),
        workItems: workItemId
          ? current.workItems.map((item) => item.id === workItemId ? { ...item, scheduleDraftVisible: false } : item)
          : current.workItems,
      }
    })
  }, [])

  const completeScheduleCreation = React.useCallback((requestId: string) => {
    setState((current) => ({
      ...current,
      requests: current.requests.map((entry) => entry.id === requestId && entry.scheduleCreationStage === "creating"
        ? { ...entry, status: "completed", scheduleCreationStage: "created", updatedAt: "4 Oct, 11:18" }
        : entry),
    }))
  }, [])

  const confirmFlow = React.useCallback((request: RequestRecord, name: string, description: string) => {
    const flowId = request.createdFlowId ?? makeId("flow")
    const flow: Flow = {
      id: flowId,
      name,
      status: "draft",
      description,
      owner: "Investment Operations",
      sourceProfile: "Fee Review Sources",
      inputs: ["Quarterly fee file", "Approved client schedules"],
      steps: ["Collect authorized files", "Compare fee rates", "Prepare exception summary"],
      outputs: ["Fee exception summary"],
      validationRules: ["Every exception references an approved schedule"],
      approvalPolicy: "Process Owner publishes before use",
      updatedAt: "4 Oct 2026",
    }
    setState((current) => ({
      ...current,
      flows: request.createdFlowId
        ? current.flows.map((entry) => entry.id === flowId ? flow : entry)
        : [flow, ...current.flows],
      requests: current.requests.map((entry) => entry.id === request.id ? {
        ...entry,
        flowCreationStage: "creating",
        flowDraftName: name,
        flowDraftDescription: description,
        createdFlowId: flowId,
        updatedAt: "4 Oct, 11:06",
        messages: entry.messages.some((message) => message.action === "create_flow")
          ? entry.messages
          : [
              ...entry.messages,
              {
                id: makeId("msg-action"),
                role: "user" as const,
                content: `Create Flow “${name}”. Description: ${description}`,
                createdAt: "4 Oct, 11:06",
                action: "create_flow" as const,
              },
            ],
      } : entry),
    }))
  }, [])

  const completeFlowCreation = React.useCallback((requestId: string) => {
    setState((current) => ({
      ...current,
      requests: current.requests.map((entry) => entry.id === requestId && entry.flowCreationStage === "creating"
        ? { ...entry, flowCreationStage: "preview", updatedAt: "4 Oct, 11:07" }
        : entry),
    }))
  }, [])

  const publishCreatedFlow = React.useCallback((request: RequestRecord) => {
    if (!request.createdFlowId) return
    const flowId = request.createdFlowId
    setState((current) => ({
      ...current,
      flows: current.flows.map((entry) => entry.id === flowId
        ? { ...entry, status: "active", updatedAt: "4 Oct 2026" }
        : entry),
      requests: current.requests.map((entry) => entry.id === request.id
        ? {
            ...entry,
            status: "completed",
            flowCreationStage: "published",
            updatedAt: "4 Oct, 11:08",
            messages: entry.messages.some((message) => message.action === "publish_flow")
              ? entry.messages
              : [
                  ...entry.messages,
                  {
                    id: makeId("msg-action"),
                    role: "user" as const,
                    content: `Publish Flow “${entry.flowDraftName ?? "this Flow"}”.`,
                    createdAt: "4 Oct, 11:08",
                    action: "publish_flow" as const,
                  },
                ],
          }
        : entry),
    }))
  }, [])

  const openWorkConversation = React.useCallback((item: WorkItem) => {
    const agentStage = item.status === "ready_for_approval"
      ? "awaiting_approval" as const
      : undefined
    const needsFileRecovery = (item.status === "pending" || item.status === "needs_attention") && item.flowId === "flow-cash"
    const needsDataConfirmation = item.status === "needs_attention" && !needsFileRecovery

    if (item.requestId) {
      setState((current) => ({
        ...current,
        requests: current.requests.map((entry) => entry.id === item.requestId ? {
          ...entry,
          status: item.status === "completed" ? "completed" : "active",
          agentStage: item.status === "completed" && entry.agentStage === "approved" ? "approved" : agentStage,
          dataConfirmationStage: needsDataConfirmation ? "required" : undefined,
          fileRecoveryStage: needsFileRecovery ? "required" : undefined,
          updatedAt: item.updatedAt,
        } : entry),
      }))
      navigate(`/requests/${item.requestId}?run=${item.id}`)
      return
    }

    const requestId = makeId("req-work")
    const request: RequestRecord = {
      id: requestId,
      title: item.title,
      status: item.status === "completed" ? "completed" : "active",
      updatedAt: "4 Oct, 11:24",
      workItemIds: [item.id],
      agentStage,
      dataConfirmationStage: needsDataConfirmation ? "required" : undefined,
      fileRecoveryStage: needsFileRecovery ? "required" : undefined,
      messages: [{
        id: makeId("msg"),
        role: "agent",
        content: item.status === "ready_for_approval"
          ? `${item.title} was started by its schedule and the report is ready for your review.`
          : item.status === "pending"
            ? `${item.title} is pending because a required source file is missing. Upload it or ask Enable to continue searching.`
          : item.status === "needs_attention"
            ? `${item.title} is paused and needs your decision before the run can continue.`
            : item.status === "completed"
              ? `${item.title} completed successfully. Its result and activity record remain available here.`
              : `${item.title} is running. You can ask a question or request a change here.`,
        createdAt: "4 Oct, 11:24",
        workItemId: item.id,
      }],
    }

    setState((current) => ({
      ...current,
      requests: [request, ...current.requests],
      workItems: current.workItems.map((entry) => entry.id === item.id ? { ...entry, requestId } : entry),
    }))
    navigate(`/requests/${requestId}?run=${item.id}`)
  }, [navigate])

  const sendRequestMessage = React.useCallback((request: RequestRecord, content: string) => {
    const reply = request.draftType
      ? "I kept the draft open and incorporated your message into the current review context."
      : "I added that to this Request. Any changes remain scoped to its related Runs."
    setState((current) => ({
      ...current,
      requests: current.requests.map((entry) => entry.id === request.id ? {
        ...entry,
        status: "active",
        updatedAt: "4 Oct, 11:22",
        messages: [
          ...entry.messages,
          { id: makeId("msg"), role: "user" as const, content, createdAt: "4 Oct, 11:21" },
          { id: makeId("msg"), role: "agent" as const, content: reply, createdAt: "4 Oct, 11:22" },
        ],
      } : entry),
    }))
  }, [])

  const completeRequestThinking = React.useCallback((requestId: string) => {
    setState((current) => ({
      ...current,
      requests: current.requests.map((entry) => entry.id === requestId && entry.agentStage === "thinking"
        ? { ...entry, agentStage: "awaiting_approval" }
        : entry),
    }))
  }, [])

  const confirmRequestData = React.useCallback((request: RequestRecord, value: string, source: string, overrideReason?: string) => {
    const isOverride = source !== "Approved Risk Ledger"
    const decisionValue = `${value} · ${source}`
    setState((current) => ({
      ...current,
      requests: current.requests.map((entry) => entry.id === request.id
        ? {
            ...entry,
            dataConfirmationStage: "confirmed",
            agentStage: "awaiting_approval",
            dataConfirmationValue: value,
            dataConfirmationSource: source,
            dataOverrideReason: isOverride ? overrideReason : undefined,
            updatedAt: "4 Oct, 11:07",
            messages: entry.messages.some((message) => message.action === "confirm_data")
              ? entry.messages
              : [
                  ...entry.messages,
                  {
                    id: makeId("msg-action"),
                    role: "user" as const,
                    content: isOverride
                      ? `Use ${value} from the ${source}. Override reason: ${overrideReason}.`
                      : `Use ${value} from the ${source}.`,
                    createdAt: "4 Oct, 11:07",
                    action: "confirm_data" as const,
                  },
                ],
          }
        : entry),
      workItems: current.workItems.map((item) => request.workItemIds.includes(item.id)
        ? {
            ...item,
            status: "ready_for_approval",
            updatedAt: "4 Oct, 11:07",
            decisions: [
              ...item.decisions,
              { id: makeId("decision"), label: item.flowId === "flow-bis" ? "Risk asset value" : "AUM value", value: decisionValue, decidedAt: "4 Oct, 11:07" },
              ...(isOverride && overrideReason
                ? [{ id: makeId("decision"), label: "Override reason", value: overrideReason, decidedAt: "4 Oct, 11:07" }]
                : []),
            ],
            activities: [
              ...item.activities,
              { id: makeId("act"), label: `${isOverride ? "Approved override" : "Confirmed"} ${value} from ${source}`, at: "11:07" },
            ],
          }
        : item),
    }))
  }, [])

  const requestReportChanges = React.useCallback((request: RequestRecord, comment: string) => {
    setState((current) => ({
      ...current,
      requests: current.requests.map((entry) => entry.id === request.id
        ? {
            ...entry,
            revisionStage: "thinking",
            revisionCount: (entry.revisionCount ?? 0) + 1,
            lastChangeRequest: comment,
            updatedAt: "4 Oct, 11:08",
            messages: [
              ...entry.messages,
              {
                id: makeId("msg-action"),
                role: "user" as const,
                content: `Request changes: ${comment}`,
                createdAt: "4 Oct, 11:08",
                action: "request_changes" as const,
              },
            ],
          }
        : entry),
      workItems: current.workItems.map((item) => request.workItemIds.includes(item.id)
        ? {
            ...item,
            status: "working",
            updatedAt: "4 Oct, 11:08",
            activities: [...item.activities, { id: makeId("act"), label: `Revision requested: ${comment}`, at: "11:08" }],
          }
        : item),
    }))
  }, [])

  const completeReportRevision = React.useCallback((request: RequestRecord) => {
    setState((current) => ({
      ...current,
      requests: current.requests.map((entry) => entry.id === request.id && entry.revisionStage === "thinking"
        ? { ...entry, revisionStage: "ready", updatedAt: "4 Oct, 11:09" }
        : entry),
      workItems: current.workItems.map((item) => request.workItemIds.includes(item.id)
        ? {
            ...item,
            status: "ready_for_approval",
            updatedAt: "4 Oct, 11:09",
            artifacts: [
              ...item.artifacts,
              {
                id: makeId("artifact"),
                name: getReportFileName(item),
                kind: "pdf" as const,
                version: Math.max(1, ...item.artifacts.filter((artifact) => artifact.kind === "pdf").map((artifact) => artifact.version)) + 1,
                createdAt: "4 Oct, 11:09",
              },
            ],
            activities: [...item.activities, { id: makeId("act"), label: `Prepared revised report v${(request.revisionCount ?? 0) + 1}`, at: "11:09" }],
          }
        : item),
    }))
  }, [])

  const uploadMissingFile = React.useCallback((request: RequestRecord, fileName: string) => {
    setState((current) => ({
      ...current,
      requests: current.requests.map((entry) => entry.id === request.id
        ? {
            ...entry,
            fileRecoveryStage: "resolved",
            agentStage: "awaiting_approval",
            fileRecoveryMethod: "upload",
            recoveredFileName: fileName,
            updatedAt: "4 Oct, 11:07",
            messages: entry.messages.some((message) => message.action === "upload_file")
              ? entry.messages
              : [
                  ...entry.messages,
                  {
                    id: makeId("msg-action"),
                    role: "user" as const,
                    content: `Uploaded ${fileName}.`,
                    createdAt: "4 Oct, 11:07",
                    action: "upload_file" as const,
                  },
                ],
          }
        : entry),
      workItems: current.workItems.map((item) => request.workItemIds.includes(item.id)
        ? {
            ...item,
            status: "ready_for_approval",
            updatedAt: "4 Oct, 11:07",
            activities: [...item.activities, { id: makeId("act"), label: `User uploaded ${fileName}`, at: "11:07" }],
          }
        : item),
    }))
  }, [])

  const continueMissingFileSearch = React.useCallback((request: RequestRecord) => {
    setState((current) => ({
      ...current,
      requests: current.requests.map((entry) => entry.id === request.id
        ? {
            ...entry,
            fileRecoveryStage: "searching",
            fileRecoveryMethod: "agent_search",
            updatedAt: "4 Oct, 11:07",
            messages: entry.messages.some((message) => message.action === "continue_search")
              ? entry.messages
              : [
                  ...entry.messages,
                  {
                    id: makeId("msg-action"),
                    role: "user" as const,
                    content: "Continue searching for the missing approval email.",
                    createdAt: "4 Oct, 11:07",
                    action: "continue_search" as const,
                  },
                ],
          }
        : entry),
    }))
  }, [])

  const completeMissingFileSearch = React.useCallback((request: RequestRecord) => {
    const fileName = "Treasury_Adjustment_Approval.msg"
    setState((current) => ({
      ...current,
      requests: current.requests.map((entry) => entry.id === request.id && entry.fileRecoveryStage === "searching"
        ? {
            ...entry,
            fileRecoveryStage: "resolved",
            agentStage: "awaiting_approval",
            recoveredFileName: fileName,
            updatedAt: "4 Oct, 11:08",
          }
        : entry),
      workItems: current.workItems.map((item) => request.workItemIds.includes(item.id)
        ? {
            ...item,
            status: "ready_for_approval",
            updatedAt: "4 Oct, 11:08",
            activities: [...item.activities, { id: makeId("act"), label: `Agent found ${fileName} in the Treasury mailbox`, at: "11:08" }],
          }
        : item),
    }))
  }, [])

  const recoverFailedRun = React.useCallback((item: WorkItem, method: "retry" | "resume" | "rerun") => {
    if (method === "rerun") {
      const workItemId = makeId("wi-rerun")
      setState((current) => {
        const nextRunNumber = Math.max(0, ...current.workItems.filter((entry) => entry.flowId === item.flowId).map(getRunNumber)) + 1
        const rerun: WorkItem = {
          ...item,
          id: workItemId,
          title: item.title,
          status: "working",
          trigger: "user",
          requestId: undefined,
          runNumber: nextRunNumber,
          runDate: "6 Oct 2026",
          runCount: nextRunNumber,
          updatedAt: "6 Oct, 10:34",
          activities: [{ id: makeId("act"), label: `Rerun started from failed Run #${getRunNumber(item)}`, at: "10:34" }],
          artifacts: [],
          decisions: [],
          failure: undefined,
          recoveryMethod: "rerun",
        }
        return { ...current, workItems: [rerun, ...current.workItems] }
      })
      navigate(`/runs?selected=${workItemId}`)
      return
    }

    setState((current) => ({
      ...current,
      workItems: current.workItems.map((entry) => entry.id === item.id
        ? {
            ...entry,
            status: "working",
            recoveryMethod: method,
            updatedAt: method === "resume" ? "6 Oct, 10:32" : "6 Oct, 10:33",
            activities: [
              ...entry.activities,
              {
                id: makeId("act"),
                label: method === "resume" ? "Resumed from the validated ledger checkpoint" : `Retried failed step: ${entry.failure?.step ?? "failed step"}`,
                at: method === "resume" ? "10:32" : "10:33",
              },
            ],
          }
        : entry),
      schedules: current.schedules.map((schedule) => schedule.id === item.scheduleId ? { ...schedule, lastResult: "Working" } : schedule),
    }))
  }, [navigate])

  const cancelRun = React.useCallback((item: WorkItem) => {
    const cancelledAt = "7 Oct, 16:40"
    setState((current) => ({
      ...current,
      workItems: current.workItems.map((entry) => entry.id === item.id
        ? {
            ...entry,
            status: "cancelled",
            updatedAt: cancelledAt,
            activities: [
              ...entry.activities,
              { id: makeId("act"), label: "Run cancelled by Erin Chen", at: "16:40" },
            ],
          }
        : entry),
      requests: item.requestId
        ? current.requests.map((request) => request.id === item.requestId
          ? {
              ...request,
              status: "completed",
              updatedAt: cancelledAt,
              agentStage: undefined,
              dataConfirmationStage: undefined,
              fileRecoveryStage: undefined,
              revisionStage: undefined,
              messages: [
                ...request.messages,
                {
                  id: makeId("msg-agent"),
                  role: "agent" as const,
                  content: "Run cancelled. Generated artifacts and the complete audit history were retained.",
                  createdAt: cancelledAt,
                  workItemId: item.id,
                },
              ],
            }
          : request)
        : current.requests,
      schedules: item.scheduleId
        ? current.schedules.map((schedule) => schedule.id === item.scheduleId ? { ...schedule, lastResult: "Cancelled" } : schedule)
        : current.schedules,
    }))
  }, [])

  const rollbackFlow = React.useCallback((flow: Flow, version: FlowVersion) => {
    setState((current) => ({
      ...current,
      flows: current.flows.map((entry) => {
        if (entry.id !== flow.id) return entry
        const currentVersion = entry.version ?? Math.max(1, ...(entry.versions ?? []).map((candidate) => candidate.version))
        const nextVersion = currentVersion + 1
        const restoredVersion: FlowVersion = {
          id: makeId("flow-version"),
          version: nextVersion,
          publishedAt: "6 Oct 2026, 10:35",
          publishedBy: "Erin Chen",
          changeSummary: `Restored the published definition from version ${version.version}.`,
          snapshot: {
            name: version.snapshot.name ?? entry.name,
            description: version.snapshot.description,
            sourceProfile: version.snapshot.sourceProfile,
            inputs: [...(version.snapshot.inputs ?? entry.inputs)],
            steps: [...version.snapshot.steps],
            outputs: [...(version.snapshot.outputs ?? entry.outputs)],
            validationRules: [...version.snapshot.validationRules],
            approvalPolicy: version.snapshot.approvalPolicy,
          },
        }
        return {
          ...entry,
          name: version.snapshot.name ?? entry.name,
          description: version.snapshot.description,
          sourceProfile: version.snapshot.sourceProfile,
          inputs: [...(version.snapshot.inputs ?? entry.inputs)],
          steps: [...version.snapshot.steps],
          outputs: [...(version.snapshot.outputs ?? entry.outputs)],
          validationRules: [...version.snapshot.validationRules],
          approvalPolicy: version.snapshot.approvalPolicy,
          version: nextVersion,
          versions: [...(entry.versions ?? []), restoredVersion],
          updatedAt: "6 Oct 2026",
        }
      }),
    }))
  }, [])

  const saveToolkitPermissions = React.useCallback((connection: ToolkitConnection, permissions: ToolkitPermission[]) => {
    const labels = { none: "No access", read: "Read only", use: "Use in Runs", approve: "Approval required" }
    const changes = permissions.flatMap((permission) => {
      const previous = connection.permissions?.find((entry) => entry.id === permission.id)
      return previous && previous.level !== permission.level
        ? [`${permission.label}: ${labels[previous.level]} → ${labels[permission.level]}`]
        : []
    })
    if (changes.length === 0) return
    setState((current) => ({
      ...current,
      toolkit: current.toolkit.map((entry) => entry.id === connection.id
        ? {
            ...entry,
            permissions,
            audit: [
              {
                id: makeId("toolkit-audit"),
                action: "Permissions updated",
                detail: changes.join("; "),
                actor: "Erin Chen",
                at: "6 Oct, 10:36",
              },
              ...(entry.audit ?? []),
            ],
          }
        : entry),
    }))
  }, [])

  const publishFlowEdit = React.useCallback((flow: Flow, input: FlowEditInput) => {
    setState((current) => ({
      ...current,
      flows: current.flows.map((entry) => {
        if (entry.id !== flow.id) return entry
        const currentVersion = entry.version ?? Math.max(1, ...(entry.versions ?? []).map((version) => version.version))
        const nextVersion = currentVersion + 1
        const changedFields = [
          entry.name !== input.name ? "name" : null,
          entry.description !== input.description ? "description" : null,
          entry.sourceProfile !== input.sourceProfile ? "source profile" : null,
          JSON.stringify(entry.inputs) !== JSON.stringify(input.inputs) ? "inputs" : null,
          JSON.stringify(entry.steps) !== JSON.stringify(input.steps) ? "steps" : null,
          JSON.stringify(entry.outputs) !== JSON.stringify(input.outputs) ? "outputs" : null,
          JSON.stringify(entry.validationRules) !== JSON.stringify(input.validationRules) ? "validation rules" : null,
          entry.approvalPolicy !== input.approvalPolicy ? "approval policy" : null,
        ].filter((field): field is string => field !== null)
        const publishedVersion: FlowVersion = {
          id: makeId("flow-version"),
          version: nextVersion,
          publishedAt: "7 Oct 2026, 10:12",
          publishedBy: "Erin Chen",
          changeSummary: `Updated ${changedFields.join(", ")}.`,
          snapshot: {
            name: input.name,
            description: input.description,
            sourceProfile: input.sourceProfile,
            inputs: [...input.inputs],
            steps: [...input.steps],
            outputs: [...input.outputs],
            validationRules: [...input.validationRules],
            approvalPolicy: input.approvalPolicy,
          },
        }
        return {
          ...entry,
          ...input,
          status: "active",
          version: nextVersion,
          versions: [...(entry.versions ?? []), publishedVersion],
          updatedAt: "7 Oct 2026",
        }
      }),
    }))
  }, [])

  const path = route.split("?")[0]
  const query = new URLSearchParams(route.includes("?") ? route.split("?")[1] : "")
  let page: React.ReactNode

  if (path === "/" || path === "/requests/new") {
    page = <NewRequestPage flows={state.flows} preselectedFlowId={query.get("flow") ?? undefined} onSubmit={createRequest} />
  } else if (path.startsWith("/requests/")) {
    const request = state.requests.find((entry) => entry.id === path.split("/")[2])
    const focusedWorkId = query.get("run") ?? query.get("work") ?? undefined
    const actionRequest = request && focusedWorkId && request.workItemIds.includes(focusedWorkId)
      ? { ...request, workItemIds: [focusedWorkId] }
      : request
    page = request ? (
      <RequestWorkspacePage
        request={request}
        state={state}
        focusedWorkId={focusedWorkId}
        onNavigate={navigate}
        onToggleSummary={() => setState((current) => ({ ...current, requests: current.requests.map((entry) => entry.id === request.id ? { ...entry, isSummaryOpen: !entry.isSummaryOpen } : entry) }))}
        onConfirmSchedule={(entry, input) => confirmSchedule(entry, input)}
        onScheduleCreationComplete={() => completeScheduleCreation(request.id)}
        onConfirmFlow={confirmFlow}
        onFlowCreationComplete={() => completeFlowCreation(request.id)}
        onPublishFlow={() => publishCreatedFlow(request)}
        onRunFlow={(flow) => createRequest(`Run “${flow.name}”`, flow.id)}
        onMessage={(message) => sendRequestMessage(request, message)}
        onThinkingComplete={() => completeRequestThinking(request.id)}
        onConfirmData={(value, source, overrideReason) => confirmRequestData(actionRequest!, value, source, overrideReason)}
        onUploadMissingFile={(fileName) => uploadMissingFile(actionRequest!, fileName)}
        onContinueFileSearch={() => continueMissingFileSearch(actionRequest!)}
        onFileSearchComplete={() => completeMissingFileSearch(actionRequest!)}
        onRequestChanges={(comment) => requestReportChanges(actionRequest!, comment)}
        onRevisionComplete={() => completeReportRevision(actionRequest!)}
        onApproveGenerated={(approvalComment) => setState((current) => ({
          ...current,
          requests: current.requests.map((entry) => entry.id === request.id
            ? {
                ...entry,
                agentStage: "approved",
                status: "completed",
                updatedAt: "4 Oct, 11:10",
                approvalComment,
                messages: entry.messages.some((message) => message.action === "approve_execution")
                  ? entry.messages
                  : [
                      ...entry.messages,
                      {
                        id: makeId("msg-action"),
                        role: "user" as const,
                        content: `Approved this run. Comment: ${approvalComment}`,
                        createdAt: "4 Oct, 11:10",
                        action: "approve_execution" as const,
                      },
                    ],
              }
            : entry),
          workItems: current.workItems.map((item) => actionRequest!.workItemIds.includes(item.id)
            ? {
                ...item,
                status: "completed",
                updatedAt: "4 Oct, 11:10",
                artifacts: item.artifacts.length > 0 ? item.artifacts : [{
                  id: makeId("artifact"),
                  name: getReportFileName(item),
                  kind: "pdf" as const,
                  version: (request.revisionCount ?? 0) + 1,
                  createdAt: "4 Oct, 11:10",
                }],
                activities: [
                  ...item.activities,
                  { id: makeId("act"), label: "Generated, validated, and approved the final report", at: "11:10" },
                ],
              }
            : item),
          schedules: current.schedules.map((schedule) => current.workItems.some((item) => (
            actionRequest!.workItemIds.includes(item.id) && item.scheduleId === schedule.id
          )) ? { ...schedule, lastResult: "Completed" } : schedule),
        }))}
      />
    ) : <NotFoundPage onNavigate={navigate} />
  } else if (path === "/work") {
    page = <LegacyRunsRedirect selectedId={query.get("selected") ?? undefined} onNavigate={navigate} />
  } else if (path === "/runs") {
    const selectedItem = state.workItems.find((entry) => entry.id === query.get("selected"))
    page = (
      <WorkListPage
        state={state}
        selectedItem={selectedItem}
        onNavigate={navigate}
        onOpenConversation={openWorkConversation}
        onRetry={(item) => recoverFailedRun(item, "retry")}
        onResume={(item) => recoverFailedRun(item, "resume")}
        onRerun={(item) => recoverFailedRun(item, "rerun")}
        onCancel={cancelRun}
      />
    )
  } else if (path.startsWith("/runs/") || path.startsWith("/work/")) {
    const item = state.workItems.find((entry) => entry.id === path.split("/")[2])
    page = item ? <RunInspectorRedirect item={item} onNavigate={navigate} /> : <NotFoundPage onNavigate={navigate} />
  } else if (path === "/flows") {
    const selectedFlow = state.flows.find((entry) => entry.id === query.get("selected"))
    page = (
      <FlowListPage
        state={state}
        selectedFlow={selectedFlow}
        onNavigate={navigate}
        onCreate={() => createRequest("Create an automation Flow for quarterly management fee review")}
        onPublish={(flow) => setState((current) => ({
          ...current,
          flows: current.flows.map((entry) => entry.id === flow.id ? { ...entry, status: "active", updatedAt: "4 Oct 2026" } : entry),
        }))}
        onRun={(flow) => createRequest(`Run “${flow.name}”`, flow.id)}
        onAddSchedule={(flow, input) => setState((current) => ({
          ...current,
          schedules: [
            {
              id: makeId("schedule"),
              name: `${flow.name} schedule`,
              status: "active",
              flowId: flow.id,
              sourceProfile: flow.sourceProfile,
              frequencyLabel: input.frequencyLabel,
              nextRunAt: input.nextRunAt,
              lastResult: "Not run yet",
              approvalPolicy: flow.approvalPolicy,
              owner: flow.owner,
              workItemIds: [],
              createdAt: "6 Oct 2026",
            },
            ...current.schedules,
          ],
        }))}
        onRollback={rollbackFlow}
        onPublishEdit={publishFlowEdit}
        onSchedule={(flow, schedule) => createScheduleRequest(
          schedule ? `Modify the schedule for “${flow.name}”.` : `Create a schedule for “${flow.name}”.`,
          schedule?.id,
          flow.id,
        )}
      />
    )
  } else if (path.startsWith("/flows/")) {
    const flow = state.flows.find((entry) => entry.id === path.split("/")[2])
    page = flow ? <FlowInspectorRedirect flow={flow} onNavigate={navigate} /> : <NotFoundPage onNavigate={navigate} />
  } else if (path === "/toolkit") {
    const selectedConnection = state.toolkit.find((entry) => entry.id === query.get("selected"))
    page = (
      <ToolkitPage
        state={state}
        selectedConnection={selectedConnection}
        onNavigate={navigate}
        onSavePermissions={saveToolkitPermissions}
      />
    )
  } else if (path === "/schedules" || path.startsWith("/schedules/")) {
    const schedule = path.startsWith("/schedules/") ? state.schedules.find((entry) => entry.id === path.split("/")[2]) : undefined
    page = <ScheduleRedirect flowId={schedule?.flowId} onNavigate={navigate} />
  } else if (path === "/insights") {
    page = <InsightsPage />
  } else {
    page = <NotFoundPage onNavigate={navigate} />
  }

  return (
    <AppShell
      path={path}
      state={state}
      onNavigate={navigate}
      onReset={resetDemo}
      onToggleRequestPin={(requestId) => setState((current) => ({
        ...current,
        requests: current.requests.map((request) => request.id === requestId ? { ...request, pinned: !request.pinned } : request),
      }))}
      onRenameRequest={(requestId, title) => setState((current) => ({
        ...current,
        requests: current.requests.map((request) => request.id === requestId ? { ...request, title } : request),
      }))}
      onArchiveRequest={(requestId) => setState((current) => ({
        ...current,
        requests: current.requests.map((request) => request.id === requestId ? { ...request, archived: true, pinned: false } : request),
      }))}
      onDeleteRequest={(requestId) => setState((current) => ({
        ...current,
        requests: current.requests.filter((request) => request.id !== requestId),
        workItems: current.workItems.map((item) => item.requestId === requestId ? { ...item, requestId: undefined } : item),
      }))}
    >
      {page}
    </AppShell>
  )
}
