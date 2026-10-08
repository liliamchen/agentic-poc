import * as React from "react"
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  List,
  Mail,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Share2,
  Sparkles,
  Upload,
  X,
} from "lucide-react"

import { AiChain, AiChainNode, AiChainTaskBar } from "@/components/ui/ai-chain"
import { AiAttachmentCard } from "@/components/ui/ai-attachment"
import {
  AiQuickCommand,
  AiQuickCommandEmpty,
  AiQuickCommandFooter,
  AiQuickCommandGroup,
  AiQuickCommandHint,
  AiQuickCommandItem,
  AiQuickCommandItemIcon,
  AiQuickCommandList,
} from "@/components/ui/ai-quick-command"
import {
  AiPromptInput,
  AiPromptInputSubmit,
  AiPromptInputToolbar,
  AiPromptInputTextarea,
  type AiPromptInputTextareaHandle,
} from "@/components/ui/ai-prompt-input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SimpleTooltip } from "@/components/ui/simple-tooltip"
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/status-badge"
import { Textarea } from "@/components/ui/textarea"
import type {
  Artifact,
  DemoState,
  Flow,
  FlowVersion,
  RequestRecord,
  Schedule,
  ToolkitConnection,
  ToolkitPermission,
  WorkItem,
  WorkItemStatus,
} from "@/model"
import { getReportFileName, getRunDate, getRunName, getRunNumber, getRunTechnicalLabel } from "@/model"
import { cn } from "@/lib/utils"

type Navigate = (path: string) => void
export type ManualScheduleInput = { frequencyLabel: string; nextRunAt: string }
export type FlowEditInput = {
  name: string
  description: string
  sourceProfile: string
  inputs: string[]
  steps: string[]
  outputs: string[]
  validationRules: string[]
  approvalPolicy: string
}

const statusConfig: Record<WorkItemStatus, { label: string; tone: StatusBadgeStatus }> = {
  queued: { label: "Queued", tone: "unknown" },
  working: { label: "Working", tone: "normal" },
  pending: { label: "Pending", tone: "warning-medium" },
  needs_attention: { label: "Needs attention", tone: "warning-medium" },
  ready_for_approval: { label: "Ready for approval", tone: "warning-low" },
  delivering: { label: "Delivering", tone: "normal" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "unknown" },
  failed: { label: "Failed", tone: "warning-high" },
}

export function WorkStatus({ status }: { status: WorkItemStatus }) {
  const config = statusConfig[status]
  return <StatusBadge status={config.tone}>{config.label}</StatusBadge>
}

function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

function Composer({
  value,
  onValueChange,
  onSubmit,
  placeholder,
  placeholderClassName,
  className,
  collapsible = false,
  submitDisabled = false,
  onFocus,
  onBlur,
  onKeyDown,
  textareaRef,
}: {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (value: string) => void
  placeholder: string
  placeholderClassName?: string
  className?: string
  collapsible?: boolean
  submitDisabled?: boolean
  onFocus?: React.FocusEventHandler<HTMLDivElement>
  onBlur?: React.FocusEventHandler<HTMLDivElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
  textareaRef?: React.Ref<AiPromptInputTextareaHandle>
}) {
  return (
    <AiPromptInput
      className={className}
      value={value}
      onValueChange={onValueChange}
      onSubmit={onSubmit}
      collapsible={collapsible}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <AiPromptInputTextarea ref={textareaRef} placeholder={placeholder} placeholderClassName={placeholderClassName} onKeyDown={onKeyDown} />
      <AiPromptInputToolbar>
        <AiPromptInputSubmit className="ml-auto" disabled={submitDisabled} />
      </AiPromptInputToolbar>
    </AiPromptInput>
  )
}

const HOME_PROMPTS = [
  "Run the MUFG monthly report for April 2026",
  "Create a Flow for quarterly management fee review",
  "Schedule Daily Cash Flow Reconciliation every business day",
  "Prepare the BIS Risk Asset Report",
] as const

export function NewRequestPage({
  flows,
  preselectedFlowId,
  onSubmit,
}: {
  flows: Flow[]
  preselectedFlowId?: string
  onSubmit: (prompt: string, selectedFlowId?: string) => void
}) {
  const preselected = flows.find((flow) => flow.id === preselectedFlowId)
  const [value, setValue] = React.useState(preselected ? `Run [${preselected.name}] ` : "")
  const [promptIndex, setPromptIndex] = React.useState(0)
  const [promptVisible, setPromptVisible] = React.useState(true)
  const [promptFocused, setPromptFocused] = React.useState(false)
  const commandPanelRef = React.useRef<HTMLDivElement>(null)
  const composerRef = React.useRef<AiPromptInputTextareaHandle>(null)
  const activeFlows = flows.filter((flow) => flow.status === "active")
  const trimmedValue = value.trimStart()
  const commandMenuOpen = /^\/[^\s]*$/.test(trimmedValue)
  const commandQuery = commandMenuOpen ? trimmedValue.slice(1).toLowerCase() : ""
  const flowPickerMode = /^\/run\s/i.test(trimmedValue)
    ? "run"
    : /^\/schedule\s/i.test(trimmedValue)
      ? "schedule"
      : null
  const flowQuery = flowPickerMode
    ? trimmedValue.replace(/^\/(run|schedule)\s*/i, "").toLowerCase()
    : ""
  const pickerOpen = commandMenuOpen || Boolean(flowPickerMode)
  const commands = [
    {
      id: "run",
      label: "Run a Flow",
      description: "Start a governed run from a published Flow",
      icon: Play,
    },
    {
      id: "create-flow",
      label: "Create a Flow",
      description: "Turn recurring operational work into a reusable Flow",
      icon: Plus,
    },
    {
      id: "schedule",
      label: "Create a Schedule",
      description: "Configure when a published Flow should run",
      icon: CalendarClock,
    },
  ] as const
  const filteredCommands = commands.filter((command) =>
    `${command.id} ${command.label} ${command.description}`.toLowerCase().includes(commandQuery),
  )
  const filteredFlows = activeFlows.filter((flow) =>
    `${flow.name} ${flow.description}`.toLowerCase().includes(flowQuery),
  )

  React.useEffect(() => {
    if (value.trim()) {
      setPromptVisible(false)
      return
    }

    setPromptVisible(true)
    if (promptFocused) return

    let fadeTimer: number | undefined
    let frame: number | undefined
    const interval = window.setInterval(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setPromptIndex((current) => (current + 1) % HOME_PROMPTS.length)
        return
      }

      setPromptVisible(false)
      fadeTimer = window.setTimeout(() => {
        setPromptIndex((current) => (current + 1) % HOME_PROMPTS.length)
        frame = window.requestAnimationFrame(() => setPromptVisible(true))
      }, 200)
    }, 3000)

    return () => {
      window.clearInterval(interval)
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer)
      if (frame !== undefined) window.cancelAnimationFrame(frame)
    }
  }, [promptFocused, value])

  const selectCommand = (command: (typeof commands)[number]["id"]) => {
    if (command === "run") {
      setValue("/run ")
      return
    }
    if (command === "schedule") {
      setValue("/schedule ")
      return
    }
    setValue("Create a Flow for ")
  }

  const selectQuickAction = (command: (typeof commands)[number]["id"]) => {
    selectCommand(command)
    window.requestAnimationFrame(() => composerRef.current?.focus())
  }

  const selectFlow = (flow: Flow) => {
    setValue(flowPickerMode === "schedule"
      ? `Create a Schedule for [${flow.name}] `
      : `Run [${flow.name}] `)
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="flex min-h-full p-5">
        <section className="relative mx-auto my-auto w-full max-w-2xl">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">What would you like Enable to handle?</h1>
            <p className="mt-2 text-sm text-muted-foreground">Describe the outcome. Enable will find the right Flow and authorized sources.</p>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2" aria-label="Quick actions">
            <Button type="button" variant="outline" size="sm" className="rounded-full bg-background" onClick={() => selectQuickAction("run")}>
              <Play aria-hidden="true" />Run Flow
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-full bg-background" onClick={() => selectQuickAction("schedule")}>
              <CalendarClock aria-hidden="true" />Schedule
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-full bg-background" onClick={() => selectQuickAction("create-flow")}>
              <Plus aria-hidden="true" />Create Flow
            </Button>
          </div>
          <div className="relative mt-4">
          {commandMenuOpen ? (
            <AiQuickCommand ref={commandPanelRef} className="mb-2">
              <AiQuickCommandList>
                <AiQuickCommandGroup heading="Actions">
                  {filteredCommands.map((command) => {
                    const Icon = command.icon
                    return (
                      <AiQuickCommandItem
                        key={command.id}
                        value={command.id}
                        variant="rich"
                        description={command.description}
                        onSelect={() => selectCommand(command.id)}
                      >
                        <AiQuickCommandItemIcon><Icon /></AiQuickCommandItemIcon>
                        <span className="flex min-w-0 items-center gap-2">
                          <span>{command.label}</span>
                          <span className="font-mono text-xs font-normal text-muted-foreground">/{command.id}</span>
                        </span>
                      </AiQuickCommandItem>
                    )
                  })}
                  <AiQuickCommandEmpty>No matching action</AiQuickCommandEmpty>
                </AiQuickCommandGroup>
              </AiQuickCommandList>
              <AiQuickCommandFooter>
                <AiQuickCommandHint keys={["↑", "↓"]}>Navigate</AiQuickCommandHint>
                <AiQuickCommandHint keys={["↵"]} className="ml-auto">Select</AiQuickCommandHint>
              </AiQuickCommandFooter>
            </AiQuickCommand>
          ) : flowPickerMode ? (
            <AiQuickCommand ref={commandPanelRef} className="mb-2">
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Search className="size-4" aria-hidden="true" />
                {flowPickerMode === "schedule" ? "Choose a Flow to schedule" : "Choose a published Flow"}
              </div>
              <AiQuickCommandList>
                <AiQuickCommandGroup>
                  {filteredFlows.map((flow) => (
                    <AiQuickCommandItem
                      key={flow.id}
                      value={flow.id}
                      variant="rich"
                      description={flow.description}
                      onSelect={() => selectFlow(flow)}
                    >
                      <AiQuickCommandItemIcon><Play /></AiQuickCommandItemIcon>
                      <span>{flow.name}</span>
                    </AiQuickCommandItem>
                  ))}
                  <AiQuickCommandEmpty>No published Flow found</AiQuickCommandEmpty>
                </AiQuickCommandGroup>
              </AiQuickCommandList>
              <AiQuickCommandFooter>
                <AiQuickCommandHint keys={["↑", "↓"]}>Navigate</AiQuickCommandHint>
                <AiQuickCommandHint keys={["↵"]} className="ml-auto">Choose</AiQuickCommandHint>
              </AiQuickCommandFooter>
            </AiQuickCommand>
          ) : null}
          <Composer
            textareaRef={composerRef}
            value={value}
            onValueChange={setValue}
            onSubmit={(prompt) => {
              const selected = activeFlows.find((flow) => prompt.includes(`[${flow.name}]`))
              onSubmit(prompt, selected?.id)
            }}
            className="group pointer-fine:hover:border-brand pointer-fine:hover:ring-2 pointer-fine:hover:ring-brand-2"
            placeholder={HOME_PROMPTS[promptIndex]}
            placeholderClassName={cn(
              "transition-[color,opacity] duration-200 ease-standard pointer-fine:group-hover:text-foreground motion-reduce:transition-none",
              promptVisible ? "opacity-100" : "opacity-0",
            )}
            submitDisabled={pickerOpen}
            onFocus={() => {
              setPromptFocused(true)
              if (!value.trim()) setValue(HOME_PROMPTS[promptIndex])
            }}
            onBlur={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
              setPromptFocused(false)
            }}
            onKeyDown={(event) => {
              if (!pickerOpen) return
              if (event.key === "Escape") {
                event.preventDefault()
                setValue(flowPickerMode ? "/" : "")
                return
              }
              if (["ArrowDown", "ArrowUp", "Enter"].includes(event.key) && !event.shiftKey) {
                event.preventDefault()
                commandPanelRef.current?.dispatchEvent(
                  new KeyboardEvent("keydown", { key: event.key, bubbles: true }),
                )
              }
            }}
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">Type / for actions</p>
          </div>
        </section>
      </div>
    </div>
  )
}

export function RequestWorkspacePage({
  request,
  state,
  focusedWorkId,
  onNavigate,
  onToggleSummary,
  onConfirmSchedule,
  onScheduleCreationComplete,
  onConfirmFlow,
  onFlowCreationComplete,
  onPublishFlow,
  onRunFlow,
  onMessage,
  onThinkingComplete,
  onConfirmData,
  onUploadMissingFile,
  onContinueFileSearch,
  onFileSearchComplete,
  onRequestChanges,
  onRevisionComplete,
  onApproveGenerated,
}: {
  request: RequestRecord
  state: DemoState
  focusedWorkId?: string
  onNavigate: Navigate
  onToggleSummary: () => void
  onConfirmSchedule: (request: RequestRecord, input: { name: string; frequencyLabel: string; nextRunAt: string }) => void
  onScheduleCreationComplete: () => void
  onConfirmFlow: (request: RequestRecord, name: string, description: string) => void
  onFlowCreationComplete: () => void
  onPublishFlow: () => void
  onRunFlow: (flow: Flow) => void
  onMessage: (message: string) => void
  onThinkingComplete: () => void
  onConfirmData: (value: string, source: string, overrideReason?: string) => void
  onUploadMissingFile: (fileName: string) => void
  onContinueFileSearch: () => void
  onFileSearchComplete: () => void
  onRequestChanges: (comment: string) => void
  onRevisionComplete: () => void
  onApproveGenerated: (comment: string) => void
}) {
  const [message, setMessage] = React.useState("")
  const [previewArtifact, setPreviewArtifact] = React.useState<string | null>(null)
  const relatedWork = request.workItemIds
    .map((id) => state.workItems.find((item) => item.id === id))
    .filter((item): item is WorkItem => Boolean(item))
  const current = relatedWork.find((item) => item.id === focusedWorkId)
    ?? relatedWork.find((item) => item.status !== "completed")
    ?? relatedWork[0]
  const focusedFlow = current?.flowId ? state.flows.find((flow) => flow.id === current.flowId) : undefined
  const isFocusedRun = Boolean(focusedWorkId && current?.id === focusedWorkId)
  const showFocusedWorkingState = Boolean(isFocusedRun && current?.status === "working")
  const canShowRunDecision = !isFocusedRun || current?.status === "pending" || current?.status === "needs_attention"
  const canShowRunApproval = !isFocusedRun || current?.status === "ready_for_approval" || current?.status === "completed"
  const showSummary = Boolean(request.isSummaryOpen)
  const createdFlow = state.flows.find((entry) => entry.id === request.createdFlowId)
  const createdSchedule = state.schedules.find((entry) => entry.id === request.createdScheduleId)
  const needsAttention = isFocusedRun && current
    ? current.status === "pending" || current.status === "needs_attention" || current.status === "ready_for_approval"
    : relatedWork.some((item) => item.status === "pending" || item.status === "needs_attention" || item.status === "ready_for_approval")
  const conversationMessages = request.messages.filter((entry) => !entry.action)
  const openingMessages = request.agentStage ? conversationMessages.slice(0, 1) : conversationMessages
  const followUpMessages = request.agentStage ? conversationMessages.slice(1) : []
  const createFlowActionMessages = request.messages.filter((entry) => entry.action === "create_flow")
  const publishFlowActionMessages = request.messages.filter((entry) => entry.action === "publish_flow")
  const scheduleActionMessages = request.messages.filter((entry) => entry.action === "confirm_schedule")
  const dataConfirmationActionMessages = request.messages.filter((entry) => entry.action === "confirm_data")
  const fileRecoveryActionMessages = request.messages.filter((entry) => entry.action === "upload_file" || entry.action === "continue_search")
  const requestChangeActionMessages = request.messages.filter((entry) => entry.action === "request_changes")
  const approvalActionMessages = request.messages.filter((entry) => entry.action === "approve_execution")
  const visibleApprovalActionMessages = approvalActionMessages.length > 0
    ? approvalActionMessages
    : request.agentStage === "approved"
      ? [{
          id: "approved-action-fallback",
          role: "user" as const,
          content: request.approvalComment
            ? `Approved this run. Comment: ${request.approvalComment}`
            : "Approved this run.",
          createdAt: "4 Oct, 11:08",
          action: "approve_execution" as const,
        }]
      : []

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium">{isFocusedRun && current ? getRunName(current, focusedFlow?.name) : request.title}</h1>
          <p className="text-xs text-muted-foreground">
            {isFocusedRun && current
              ? `${statusConfig[current.status].label} · ${getRunTechnicalLabel(current)}`
              : request.status === "completed" ? `Completed · ${request.updatedAt}` : `Active · Updated ${request.updatedAt}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {current ? (
            <Button variant="outline" size="sm" onClick={() => onNavigate(`/runs?selected=${current.id}`)}>
              View Run
              <ChevronRight aria-hidden="true" />
            </Button>
          ) : null}
          <SimpleTooltip title={showSummary ? "Hide summary" : "Show summary"}>
            <Button variant="ghost" size="icon" className="relative size-8" onClick={onToggleSummary} aria-label={showSummary ? "Hide summary" : "Show summary"}>
              <List aria-hidden="true" />
              {needsAttention && !showSummary ? <span className="absolute right-1 top-1 size-1.5 rounded-full bg-brand" aria-label="Summary has items that need attention" /> : null}
            </Button>
          </SimpleTooltip>
        </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-28 pt-10">
            <div className={cn(
              "mx-auto grid w-full gap-6",
              showSummary ? "max-w-6xl lg:grid-cols-[minmax(0,1fr)_20rem]" : "max-w-3xl",
            )}>
              <div className="flex min-w-0 flex-col gap-8">
              {isFocusedRun && current ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Viewing {getRunName(current, focusedFlow?.name)}</span>
                  <span aria-hidden="true">·</span>
                  <span>Conversation from “{request.title}” is retained below</span>
                </div>
              ) : null}

              {openingMessages.length > 0 ? openingMessages.map((requestMessage) => (
                <Message key={requestMessage.id} role={requestMessage.role} content={requestMessage.content} />
              )) : (
                <Message role="agent" content="No conversation history is available for this request." />
              )}

              {request.agentStage === "thinking" ? (
                <ThinkingSequence onComplete={onThinkingComplete} />
              ) : request.agentStage ? (
                <CollapsedThinkingSummary />
              ) : null}

              {showFocusedWorkingState && current ? (
                <WorkingRunUpdate item={current} flow={focusedFlow} />
              ) : null}

              {request.agentStage !== "thinking" && request.draftType === "schedule" ? (
                <ScheduleDraft
                  prompt={request.draftPrompt ?? request.title}
                  flow={state.flows.find((entry) => entry.id === request.scheduleFlowId)}
                  schedule={createdSchedule}
                  initialName={request.scheduleDraftName}
                  initialFrequencyLabel={request.scheduleDraftFrequencyLabel}
                  initialNextRunAt={request.scheduleDraftNextRunAt}
                  resolved={request.scheduleCreationStage === "creating" || request.scheduleCreationStage === "created"}
                  onConfirm={(input) => onConfirmSchedule(request, input)}
                />
              ) : null}

              {scheduleActionMessages.map((requestMessage) => (
                <Message key={requestMessage.id} role={requestMessage.role} content={requestMessage.content} action={requestMessage.action} />
              ))}

              {request.draftType === "schedule" && request.scheduleCreationStage === "creating" ? (
                <ScheduleCreationSequence onComplete={onScheduleCreationComplete} />
              ) : null}

              {request.draftType === "schedule" && request.scheduleCreationStage === "created" && createdSchedule ? (
                <>
                  <CollapsedScheduleTools />
                  <ScheduleCreatedResult schedule={createdSchedule} onOpen={() => onNavigate(`/flows?selected=${createdSchedule.flowId}`)} />
                </>
              ) : null}

              {request.agentStage !== "thinking" && request.draftType === "flow" ? (
                <FlowDraftForm
                  prompt={request.draftPrompt ?? request.title}
                  initialName={request.flowDraftName}
                  initialDescription={request.flowDraftDescription}
                  resolved={Boolean(request.flowCreationStage && request.flowCreationStage !== "form")}
                  onConfirm={(name, description) => onConfirmFlow(request, name, description)}
                />
              ) : null}

              {createFlowActionMessages.map((requestMessage) => (
                <Message key={requestMessage.id} role={requestMessage.role} content={requestMessage.content} action={requestMessage.action} />
              ))}

              {request.draftType === "flow" && request.flowCreationStage === "creating" ? (
                <FlowCreationSequence onComplete={onFlowCreationComplete} />
              ) : null}

              {request.draftType === "flow" && request.flowCreationStage === "preview" && createdFlow ? (
                <>
                  <CollapsedFlowTools />
                  <FlowDraftPreview flow={createdFlow} onPublish={onPublishFlow} />
                </>
              ) : null}

              {request.draftType === "flow" && request.flowCreationStage === "published" && createdFlow ? (
                <>
                  <CollapsedFlowTools />
                  <FlowDraftPreview flow={createdFlow} resolved onPublish={onPublishFlow} />
                  {publishFlowActionMessages.map((requestMessage) => (
                    <Message key={requestMessage.id} role={requestMessage.role} content={requestMessage.content} action={requestMessage.action} />
                  ))}
                  <FlowPublishedResult
                    flow={createdFlow}
                    onOpen={() => onNavigate(`/flows?selected=${createdFlow.id}`)}
                    onRun={() => onRunFlow(createdFlow)}
                  />
                </>
              ) : null}

              {!request.draftType && current && canShowRunDecision && request.agentStage !== "thinking" && request.dataConfirmationStage ? (
                <DataConfirmation
                  request={request}
                  item={current}
                  resolved={request.dataConfirmationStage === "confirmed"}
                  onConfirm={onConfirmData}
                />
              ) : null}

              {dataConfirmationActionMessages.map((requestMessage) => (
                <Message key={requestMessage.id} role={requestMessage.role} content={requestMessage.content} action={requestMessage.action} />
              ))}

              {!request.draftType && current && canShowRunDecision && request.agentStage !== "thinking" && request.fileRecoveryStage ? (
                <MissingFileResolution
                  stage={request.fileRecoveryStage}
                  recoveredFileName={request.recoveredFileName}
                  onUpload={onUploadMissingFile}
                  onContinueSearch={onContinueFileSearch}
                />
              ) : null}

              {fileRecoveryActionMessages.map((requestMessage) => (
                <Message key={requestMessage.id} role={requestMessage.role} content={requestMessage.content} action={requestMessage.action} />
              ))}

              {request.fileRecoveryStage === "searching" ? (
                <FileSearchSequence onComplete={onFileSearchComplete} />
              ) : null}

              {request.fileRecoveryStage === "resolved" && request.recoveredFileName ? (
                <>
                  {request.fileRecoveryMethod === "agent_search" ? <CollapsedChainSummary>File found · 2 tools called</CollapsedChainSummary> : null}
                  <RecoveredFileResult fileName={request.recoveredFileName} method={request.fileRecoveryMethod} />
                </>
              ) : null}

              {requestChangeActionMessages.map((requestMessage) => (
                <Message key={requestMessage.id} role={requestMessage.role} content={requestMessage.content} action={requestMessage.action} />
              ))}

              {request.revisionStage === "thinking" ? (
                <ThinkingSequence onComplete={onRevisionComplete} />
              ) : request.revisionStage === "ready" ? (
                <CollapsedChainSummary>Revision complete · report updated</CollapsedChainSummary>
              ) : null}

              {!request.draftType && current && canShowRunApproval && request.dataConfirmationStage !== "required" && request.fileRecoveryStage !== "required" && request.fileRecoveryStage !== "searching" && request.revisionStage !== "thinking" && (request.agentStage === "awaiting_approval" || request.agentStage === "approved") ? (
                <ExecutionApproval
                  request={request}
                  current={current}
                  state={state}
                  onApprove={onApproveGenerated}
                  onPreview={setPreviewArtifact}
                  onRequestChanges={onRequestChanges}
                  resolved={request.agentStage === "approved"}
                />
              ) : null}

              {followUpMessages.map((requestMessage) => (
                <Message key={requestMessage.id} role={requestMessage.role} content={requestMessage.content} />
              ))}

              {visibleApprovalActionMessages.map((requestMessage) => (
                <Message
                  key={requestMessage.id}
                  role={requestMessage.role}
                  content={requestMessage.content}
                  action={requestMessage.action}
                />
              ))}

              {!request.draftType && current && canShowRunApproval && request.agentStage === "approved" ? (
                <RequestCompletionResult request={request} item={current} onPreview={setPreviewArtifact} />
              ) : null}

              </div>
              {showSummary ? (
                <RequestSummaryCard
                  current={current}
                  relatedWork={relatedWork}
                  flows={state.flows}
                  onClose={onToggleSummary}
                  onOpenWork={(workId) => {
                    onToggleSummary()
                    onNavigate(`/runs?selected=${workId}`)
                  }}
                  onOpenSources={() => {
                    onToggleSummary()
                    onNavigate("/toolkit")
                  }}
                  onPreviewReport={(reportName) => {
                    onToggleSummary()
                    setPreviewArtifact(reportName)
                  }}
                />
              ) : null}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-8 pb-5">
            <div className="pointer-events-auto mx-auto w-full max-w-3xl">
              <Composer
                value={message}
                onValueChange={setMessage}
                onSubmit={(value) => {
                  onMessage(value)
                  setMessage("")
                }}
                placeholder="Message Enable"
                collapsible
              />
            </div>
          </div>
          </div>

        </div>
      </div>

      {previewArtifact ? (
        <ReportPreviewPanel name={previewArtifact} onClose={() => setPreviewArtifact(null)} />
      ) : null}
    </div>
  )
}

function WorkingRunUpdate({ item, flow }: { item: WorkItem; flow?: Flow }) {
  const currentActivity = item.activities.at(-1)
  const completedActivities = item.activities.slice(0, -1)
  const nextOutput = flow?.outputs[0]

  return (
    <div className="flex max-w-xl flex-col gap-2">
      <p className="text-sm text-muted-foreground">Agent is working · Updated {item.updatedAt}</p>
      <section aria-label="Agent response" className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background">
              <Sparkles className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-medium">{flow?.name ?? item.title}</h2>
              <p className="mt-1 text-sm leading-6 text-secondary-foreground">
                The run is progressing normally. No action is needed right now; I’ll ask when a decision or approval is required.
              </p>
            </div>
          </div>
          <WorkStatus status={item.status} />
        </div>

        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Current step</dt>
            <dd className="mt-1 font-medium">{currentActivity?.label ?? "Starting the Flow"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Next</dt>
            <dd className="mt-1 font-medium">{nextOutput ? `Generate ${nextOutput}` : "Continue to the next Flow step"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Completed</dt>
            <dd className="mt-1 text-secondary-foreground">
              {completedActivities.length > 0
                ? completedActivities.map((activity) => activity.label).join(" · ")
                : "Run initialized and governed resources loaded"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

function RequestSummaryCard({
  current,
  relatedWork,
  flows,
  onClose,
  onOpenWork,
  onOpenSources,
  onPreviewReport,
}: {
  current?: WorkItem
  relatedWork: WorkItem[]
  flows: Flow[]
  onClose: () => void
  onOpenWork: (workId: string) => void
  onOpenSources: () => void
  onPreviewReport: (reportName: string) => void
}) {
  const getCrossFlowName = (item: WorkItem) => {
    const flowName = flows.find((flow) => flow.id === item.flowId)?.name ?? item.title
    return getRunName(item, flowName)
  }
  const latestReport = current?.artifacts
    .filter((artifact) => artifact.kind === "pdf")
    .sort((a, b) => b.version - a.version)[0]

  return (
    <aside className="order-first self-start rounded-xl border border-border bg-card p-4 shadow-sm lg:order-none lg:col-start-2 lg:row-start-1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Summary</h2>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close summary">
          <X aria-hidden="true" />
        </Button>
      </div>
      {current ? (
        <SummarySection label="Selected run">
          <button
            type="button"
            onClick={() => onOpenWork(current.id)}
            className="w-full rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="block text-sm font-medium">{getCrossFlowName(current)}</span>
            <span className="mt-1 block truncate text-xs capitalize text-muted-foreground">Run #{getRunNumber(current)} · {current.trigger}</span>
            <span className="mt-2 block"><WorkStatus status={current.status} /></span>
          </button>
        </SummarySection>
      ) : null}
      {relatedWork.length > 1 ? (
        <SummarySection label="Other runs in this request">
          {relatedWork.filter((item) => item.id !== current?.id).map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onOpenWork(item.id)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate">{getCrossFlowName(item)}</span>
                <span className="block truncate text-xs capitalize text-muted-foreground">Run #{getRunNumber(item)} · {item.trigger}</span>
              </span>
              <WorkStatus status={item.status} />
            </button>
          ))}
        </SummarySection>
      ) : null}
      {current ? (
        <SummarySection label="Sources">
          <SummaryResourceLink name={current.sourceProfile} onClick={onOpenSources} />
        </SummarySection>
      ) : null}
      {current ? (
        <SummarySection label="Output">
          {latestReport ? (
            <SummaryResourceLink
              meta={`PDF · v${latestReport.version}`}
              name={latestReport.name}
              onClick={() => onPreviewReport(latestReport.name)}
            />
          ) : (
            <p className="px-2 py-1 text-sm text-muted-foreground">
              {current.status === "working" ? "Report not generated yet" : "No report generated"}
            </p>
          )}
        </SummarySection>
      ) : null}
    </aside>
  )
}

function SummaryResourceLink({ meta, name, onClick }: { meta?: string; name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0">
        {meta ? <span className="block text-xs text-muted-foreground">{meta}</span> : null}
        <span className={cn("block truncate text-sm font-medium", meta && "mt-0.5")}>{name}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  )
}

function RequestCompletionResult({ request, item, onPreview }: { request: RequestRecord; item: WorkItem; onPreview: (name: string) => void }) {
  const report = item.artifacts
    .filter((artifact) => artifact.kind === "pdf")
    .sort((a, b) => b.version - a.version)[0]
  const reportName = report?.name ?? getReportFileName(item)
  const reportVersion = report?.version ?? (request.revisionCount ?? 0) + 1

  return (
    <section aria-label="Agent response" className="flex max-w-xl flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-foreground" aria-hidden="true" />
        <div>
          <h2 className="font-medium">Run completed</h2>
          <p className="mt-1 text-sm text-secondary-foreground">Approval was recorded and the report was saved to this Run. No external delivery was started.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-border pt-4 text-sm">
        <ReceiptField label="Approved by" value="Erin Chen" />
        <ReceiptField label="Approved" value={request.updatedAt} />
        <ReceiptField label="Artifact" value={`PDF · v${reportVersion}`} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Approval comment</p>
        <p className="text-sm leading-6">{request.approvalComment}</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Generated report</p>
        <AiAttachmentCard
          fluid
          role="button"
          tabIndex={0}
          icon={<FileText />}
          title={reportName}
          meta={`PDF · v${reportVersion} · Generated 4 Oct, 11:08`}
          className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onPreview(reportName)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onPreview(reportName)
            }
          }}
        />
      </div>
    </section>
  )
}

function ReportPreviewPanel({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <aside className="flex h-full w-1/2 min-w-96 max-w-2xl shrink-0 flex-col overflow-hidden border-l border-border bg-muted/20">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Report preview</p>
          <p className="truncate text-xs text-muted-foreground">{name}</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close report preview"><X /></Button>
      </div>
      <iframe
        title={`${name} preview`}
        src={getReportPreviewUrl(name)}
        className="min-h-0 w-full flex-1 border-0 bg-background"
      />
    </aside>
  )
}

function getReportPreviewUrl(name: string) {
  return `/${encodeURIComponent(name)}#toolbar=0&navpanes=0&view=FitH`
}

function ThinkingSequence({ onComplete }: { onComplete: () => void }) {
  const [activeStep, setActiveStep] = React.useState(0)
  const completeRef = React.useRef(onComplete)
  completeRef.current = onComplete

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeStep < 2) setActiveStep((step) => step + 1)
      else completeRef.current()
    }, 800)
    return () => window.clearTimeout(timer)
  }, [activeStep])

  const steps = [
    { value: "understand", title: "Understand the outcome", detail: "Identifying the client, reporting period, and expected deliverables." },
    { value: "governance", title: "Match governed resources", detail: "Checking the published Flow, authorized sources, and approval policy." },
    { value: "review", title: "Prepare the review", detail: "Building the minimum decision surface needed before execution." },
  ]

  return (
    <section aria-label="Enable is thinking" className="rounded-xl border border-border bg-muted/20 p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Thinking</p>
          <p className="mt-1 text-sm text-muted-foreground">Preparing a governed execution for your review.</p>
        </div>
        <StatusBadge status="normal">Working</StatusBadge>
      </div>
      <AiChain>
        {steps.map((step, index) => {
          const status = index < activeStep ? "success" : index === activeStep ? "running" : "pending"
          return (
            <AiChainNode
              key={step.value}
              value={step.value}
              status={status}
              icon={status === "success" ? <Check /> : <Sparkles />}
              title={step.title}
              description={step.detail}
              defaultExpanded={status !== "success"}
              collapseOnSuccess
            >
              {status === "running" ? <AiChainTaskBar status="running">Working on this step</AiChainTaskBar> : null}
            </AiChainNode>
          )
        })}
      </AiChain>
    </section>
  )
}

function CollapsedThinkingSummary() {
  return <CollapsedChainSummary>Thinking complete</CollapsedChainSummary>
}

function CollapsedChainSummary({ children }: { children: React.ReactNode }) {
  return <section className="-mb-5 text-sm text-muted-foreground">{children}</section>
}

const cashSourceFiles = [
  { name: "Daily_Cash_Ledger_2026-10-04.xlsx", kind: "Excel workbook" },
  { name: "Custodian_Cash_Confirmation.msg", kind: "Outlook message" },
]

const missingCashFile = "Treasury_Adjustment_Approval.msg"

function MissingFileResolution({
  stage,
  recoveredFileName,
  onUpload,
  onContinueSearch,
}: {
  stage: NonNullable<RequestRecord["fileRecoveryStage"]>
  recoveredFileName?: string
  onUpload: (fileName: string) => void
  onContinueSearch: () => void
}) {
  const resolved = stage === "resolved"
  const working = stage === "searching"

  return (
    <section aria-label="Agent response" className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">One source file is missing</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Two of three required files were found for the reconciliation.</p>
        </div>
        <StatusBadge status={resolved ? "success" : working ? "normal" : "warning-medium"}>
          {resolved ? "Resolved" : working ? "Searching" : "Action required"}
        </StatusBadge>
      </div>

      <div className="mt-5 space-y-2">
        {cashSourceFiles.map((file) => (
          <div key={file.name} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-success-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{file.kind} · Found</p>
            </div>
          </div>
        ))}
        <div className={cn(
          "flex items-center gap-3 rounded-lg border px-3 py-2.5",
          resolved ? "border-border bg-muted/30" : "border-warning-medium bg-warning-medium-background",
        )}>
          <Mail className={cn("size-4 shrink-0", resolved ? "text-success-foreground" : "text-warning-medium-foreground")} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{recoveredFileName ?? missingCashFile}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Outlook message · {resolved ? "Available" : working ? "Agent is searching" : "Not found"}</p>
          </div>
        </div>
      </div>

      {stage === "required" ? (
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <input
            id="cash-missing-file-upload"
            type="file"
            accept=".msg"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onUpload(file.name)
            }}
          />
          <Button asChild variant="outline">
            <label htmlFor="cash-missing-file-upload" className="cursor-pointer"><Upload aria-hidden="true" />Upload missing file</label>
          </Button>
          <Button type="button" onClick={onContinueSearch}><Search aria-hidden="true" />Continue searching</Button>
        </div>
      ) : null}
    </section>
  )
}

function FileSearchSequence({ onComplete }: { onComplete: () => void }) {
  const [activeStep, setActiveStep] = React.useState(0)
  const completeRef = React.useRef(onComplete)
  completeRef.current = onComplete
  const tools = [
    { value: "mailbox", title: "Treasury mailbox", detail: "Searching related approval threads and attachments." },
    { value: "archive", title: "Message archive", detail: "Checking the governed archive for the missing approval." },
  ]

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeStep < tools.length - 1) setActiveStep((step) => step + 1)
      else completeRef.current()
    }, 700)
    return () => window.clearTimeout(timer)
  }, [activeStep, tools.length])

  return (
    <section aria-label="Agent response" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">Searching for the missing file</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enable is checking authorized email sources.</p>
        </div>
        <StatusBadge status="normal">Working</StatusBadge>
      </div>
      <AiChain>
        {tools.map((tool, index) => {
          const status = index < activeStep ? "success" : index === activeStep ? "running" : "pending"
          return (
            <AiChainNode
              key={tool.value}
              value={tool.value}
              status={status}
              icon={status === "success" ? <Check /> : <Search />}
              title={tool.title}
              description={tool.detail}
              defaultExpanded={status === "running"}
              collapseOnSuccess
            >
              {status === "running" ? <AiChainTaskBar status="running">Searching</AiChainTaskBar> : null}
            </AiChainNode>
          )
        })}
      </AiChain>
    </section>
  )
}

function RecoveredFileResult({ fileName, method }: { fileName: string; method?: RequestRecord["fileRecoveryMethod"] }) {
  return (
    <section aria-label="Agent response" className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-medium">Missing file added</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {method === "agent_search" ? "Enable found the approval message in the Treasury mailbox." : "The uploaded approval message was added to this run."}
      </p>
      <AiAttachmentCard
        fluid
        icon={<Mail />}
        title={fileName}
        meta={`MSG · ${method === "agent_search" ? "Found by Enable" : "Uploaded by you"}`}
        className="mt-4"
      />
    </section>
  )
}

function DataConfirmation({
  request,
  item,
  resolved,
  onConfirm,
}: {
  request: RequestRecord
  item: WorkItem
  resolved: boolean
  onConfirm: (value: string, source: string, overrideReason?: string) => void
}) {
  const valueLabel = item.flowId === "flow-bis" ? "risk asset value" : "AUM value"
  const options = item.flowId === "flow-bis"
    ? [
        {
          value: "742.6M",
          source: "Approved Risk Ledger",
          meta: "Updated 30 Apr, 08:55 · Authorized source",
          authorized: true,
        },
        {
          value: "741.9M",
          source: "Reporting workbook",
          meta: "Uploaded 30 Apr, 09:02 · Differs by 0.7M",
          authorized: false,
        },
      ]
    : [
        {
          value: "1.241B",
          source: "Approved worksheet",
          meta: "Updated 30 Apr, 08:55 · Authorized source",
          authorized: true,
        },
        {
          value: "1.238B",
          source: "Email attachment",
          meta: "Received 29 Apr, 16:42 · Differs by 0.003B",
          authorized: false,
        },
      ]
  const [selectedValue, setSelectedValue] = React.useState(request.dataConfirmationValue ?? options[0].value)
  const [overrideReason, setOverrideReason] = React.useState(request.dataOverrideReason ?? "")
  const selectedOption = options.find((option) => option.value === selectedValue) ?? options[0]
  const requiresOverride = !selectedOption.authorized
  const canConfirm = !requiresOverride || overrideReason.trim().length > 0

  return (
    <section aria-label="Agent response" className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Confirm {valueLabel}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Two source values were found. Confirm which value should be used for {item.title}.
          </p>
        </div>
        <StatusBadge status={resolved ? "success" : "warning-medium"}>{resolved ? "Confirmed" : "Confirmation required"}</StatusBadge>
      </div>

      <div className="mt-5 space-y-2" role="group" aria-label={`${valueLabel} options`}>
        {options.map((option) => {
          const selected = selectedValue === option.value
          return (
            <button
              type="button"
              key={option.value}
              aria-pressed={selected}
              disabled={resolved}
              onClick={() => setSelectedValue(option.value)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-100",
                selected ? "border-primary bg-muted/30" : "border-border hover:bg-muted/20",
              )}
            >
              <span className={cn("size-2.5 shrink-0 rounded-full border", selected ? "border-primary bg-primary" : "border-border")} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{option.source}</span>
                  <span className="text-sm font-medium">{option.value}</span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{option.meta}</span>
              </span>
            </button>
          )
        })}
      </div>

      {requiresOverride ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`override-reason-${request.id}`} className="text-sm font-medium">Override reason</label>
            <span className="text-xs text-muted-foreground">Required</span>
          </div>
          <Textarea
            id={`override-reason-${request.id}`}
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            readOnly={resolved}
            rows={3}
            placeholder="Explain why the workbook value should replace the authorized source"
          />
          <p className="text-xs text-muted-foreground">This reason will be recorded with the source override.</p>
        </div>
      ) : null}

      {!resolved ? (
        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(selectedValue, selectedOption.source, requiresOverride ? overrideReason.trim() : undefined)}
          >
            {requiresOverride ? "Confirm override and continue" : "Confirm and continue"}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function ExecutionApproval({
  request,
  current,
  state,
  onApprove,
  onPreview,
  onRequestChanges,
  resolved,
}: {
  request: RequestRecord
  current: WorkItem
  state: DemoState
  onApprove: (comment: string) => void
  onPreview: (name: string) => void
  onRequestChanges: (comment: string) => void
  resolved: boolean
}) {
  const [comment, setComment] = React.useState(request.approvalComment ?? "")
  const flow = state.flows.find((entry) => entry.id === current.flowId)
  const report = current.artifacts
    .filter((artifact) => artifact.kind === "pdf")
    .sort((a, b) => b.version - a.version)[0]
  const reportName = report?.name ?? getReportFileName(current)
  const reportVersion = report?.version ?? (request.revisionCount ?? 0) + 1
  const canApprove = comment.trim().length > 0
  return (
    <section aria-label="Agent response" className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">{current.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {resolved
              ? "This governed execution was approved and remains available in the conversation."
              : "Review the report and add a comment before approving."}
          </p>
        </div>
        <StatusBadge status={resolved ? "success" : "warning-low"}>{resolved ? "Approved" : "Approval required"}</StatusBadge>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor={`approval-flow-${request.id}`} className="text-sm font-medium">Flow</label>
          <Input id={`approval-flow-${request.id}`} value={flow?.name ?? "Restricted runtime plan"} readOnly className="bg-muted/20" />
        </div>
        <div className="space-y-2">
          <label htmlFor={`approval-sources-${request.id}`} className="text-sm font-medium">Sources</label>
          <Input id={`approval-sources-${request.id}`} value={`${current.sourceProfile} · no upload required`} readOnly className="bg-muted/20" />
        </div>
        <div className="col-span-2 space-y-2">
          <p className="text-sm font-medium">Report to approve</p>
          <AiAttachmentCard
              fluid
              role="button"
              tabIndex={0}
              icon={<FileText />}
              title={reportName}
              meta={`PDF · v${reportVersion} · ${resolved ? "Approved" : "Ready for review"}`}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onPreview(reportName)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onPreview(reportName)
                }
              }}
            />
        </div>
        <div className="col-span-2 space-y-2">
          {resolved ? (
            <>
              <label htmlFor={`approval-comment-${request.id}`} className="text-sm font-medium">Comment</label>
              <Textarea id={`approval-comment-${request.id}`} value={request.approvalComment ?? ""} readOnly rows={3} className="bg-muted/20" />
            </>
          ) : (
            <>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`approval-comment-${request.id}`} className="text-sm font-medium">Comment</label>
              <span className="text-xs text-muted-foreground">Required</span>
            </div>
            <Textarea
              id={`approval-comment-${request.id}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add context for this approval"
              rows={3}
              required
              aria-describedby={`approval-comment-help-${request.id}`}
            />
            <p id={`approval-comment-help-${request.id}`} className="text-xs text-muted-foreground">
              This comment will be recorded with your approval or change request.
            </p>
            </>
          )}
        </div>
        <div className="col-span-2 rounded-lg bg-muted/30 px-3 py-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">After approval</p>
          <p className="mt-1 text-sm">Complete this run and save the approved report to its Run history. No external delivery will be started.</p>
        </div>
      </div>
      {!resolved ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canApprove}
              onClick={() => {
                onRequestChanges(comment.trim())
                setComment("")
              }}
            >
              Request changes
            </Button>
            <Button
              type="button"
              className="bg-[#001aff] text-white hover:bg-[#001aff]/90"
              disabled={!canApprove}
              onClick={() => onApprove(comment.trim())}
            >
              Approve report and complete
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function Message({
  role,
  content,
  action,
}: {
  role: "user" | "agent" | "system"
  content: string
  action?: RequestRecord["messages"][number]["action"]
}) {
  if (role === "user") {
    const compactAction = action === "approve_execution" || action === "request_changes" || action === "publish_flow" || action === "confirm_data" || action === "upload_file" || action === "continue_search"
    return (
      <div className="flex justify-end">
        <div className={cn(
          "max-w-xl bg-muted text-sm",
          action && compactAction ? "flex items-center gap-2 rounded-full px-3 py-2" : "rounded-2xl px-4 py-3 leading-6",
        )}>
          {action && action !== "request_changes" ? <CheckCircle2 className="size-4 shrink-0 text-success-foreground" aria-hidden="true" /> : null}
          <span>{content}</span>
        </div>
      </div>
    )
  }
  return (
    <div aria-label="Agent response" className="flex max-w-xl gap-3 rounded-xl border border-border bg-card p-4">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background">
        <Sparkles className="size-3.5" aria-hidden="true" />
      </span>
      <p className="pt-1 text-sm leading-6">{content}</p>
    </div>
  )
}

function SummarySection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

export function WorkListPage({
  state,
  selectedItem,
  onNavigate,
  onOpenConversation,
  onRetry,
  onResume,
  onRerun,
  onCancel,
}: {
  state: DemoState
  selectedItem?: WorkItem
  onNavigate: Navigate
  onOpenConversation: (item: WorkItem) => void
  onRetry: (item: WorkItem) => void
  onResume: (item: WorkItem) => void
  onRerun: (item: WorkItem) => void
  onCancel: (item: WorkItem) => void
}) {
  const [status, setStatus] = React.useState("all")
  const [trigger, setTrigger] = React.useState("all")
  const [query, setQuery] = React.useState("")
  const [previewArtifact, setPreviewArtifact] = React.useState<Artifact | null>(null)
  const [artifactComparison, setArtifactComparison] = React.useState<{ base: Artifact; target: Artifact } | null>(null)
  const [collapsedFlows, setCollapsedFlows] = React.useState<Set<string>>(() => new Set())

  React.useEffect(() => {
    setPreviewArtifact(null)
    setArtifactComparison(null)
  }, [selectedItem?.id])

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = state.workItems.filter((item) => {
    const flow = state.flows.find((entry) => entry.id === item.flowId)
    const schedule = state.schedules.find((entry) => entry.id === item.scheduleId)
    const statusMatch = status === "all" || item.status === status
    const triggerMatch = trigger === "all" || item.trigger === trigger
    const queryMatch = `${flow?.name ?? "Ad hoc runs"} ${schedule?.name ?? ""} ${item.title} ${item.client} ${item.reportingPeriod} ${getRunDate(item)}`.toLowerCase().includes(normalizedQuery)
    return statusMatch && triggerMatch && queryMatch
  })
  const groupedRuns = [
    ...state.flows.map((flow) => ({
      id: flow.id,
      name: flow.name,
      runs: filtered.filter((item) => item.flowId === flow.id).sort((a, b) => getRunNumber(b) - getRunNumber(a)),
    })),
    {
      id: "ad-hoc",
      name: "Ad hoc runs",
      runs: filtered.filter((item) => !item.flowId).sort((a, b) => getRunNumber(b) - getRunNumber(a)),
    },
  ].filter((group) => group.runs.length > 0)

  const toggleFlow = (flowId: string) => {
    setCollapsedFlows((current) => {
      const next = new Set(current)
      if (next.has(flowId)) next.delete(flowId)
      else next.add(flowId)
      return next
    })
  }

  return (
    <div className="flex h-full min-h-0">
      <div className={cn("min-w-0 flex-1 overflow-y-auto px-8 py-7", selectedItem && "hidden lg:block")}>
        <div className="mx-auto max-w-6xl">
          <PageHeader title="Runs" description="Monitor each Flow execution, whether started by a person, schedule, or event." />

          <div className="mt-7 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1" role="group" aria-label="Filter runs by trigger">
              {[
                { value: "all", label: "All runs" },
                { value: "user", label: "Requested" },
                { value: "scheduled", label: "Scheduled" },
                { value: "event", label: "Event" },
              ].map((option) => (
                <button
                  type="button"
                  key={option.value}
                  aria-pressed={trigger === option.value}
                  onClick={() => setTrigger(option.value)}
                  className={cn(
                    "h-8 rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    trigger === option.value ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="relative min-w-64 flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search flows and runs" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="needs_attention">Needs attention</SelectItem>
                <SelectItem value="ready_for_approval">Ready for approval</SelectItem>
                <SelectItem value="working">Working</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-12 gap-4 border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span className="col-span-5">Flow / run</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-2">Trigger</span>
              <span className="col-span-2">Updated</span>
              <span className="text-right">Action</span>
            </div>
            {groupedRuns.map((group) => {
              const isCollapsed = collapsedFlows.has(group.id)
              return (
                <React.Fragment key={group.id}>
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleFlow(group.id)}
                    className="grid w-full grid-cols-12 items-center gap-4 border-b border-border bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="col-span-9 flex min-w-0 items-center gap-2">
                      {isCollapsed ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                      <span className="min-w-0 truncate text-sm font-medium">{group.name}</span>
                    </span>
                    <span className="col-span-3 text-right text-xs text-muted-foreground">{group.runs.length} {group.runs.length === 1 ? "run" : "runs"}</span>
                  </button>
                  {!isCollapsed ? group.runs.map((item) => {
                    const schedule = state.schedules.find((entry) => entry.id === item.scheduleId)
                    return (
                      <button
                        type="button"
                        key={item.id}
                        aria-pressed={selectedItem?.id === item.id}
                        onClick={() => onNavigate(`/runs?selected=${item.id}`)}
                        className={cn(
                          "grid w-full grid-cols-12 items-center gap-4 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/20",
                          selectedItem?.id === item.id && "bg-accent",
                        )}
                      >
                        <span className="col-span-5 flex min-w-0 items-start gap-2 pl-6">
                          <span className="mt-2 h-px w-3 shrink-0 bg-border" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{getRunName(item, group.id === "ad-hoc" ? undefined : group.name)}</span>
                            <span className="block truncate text-xs text-muted-foreground">{schedule ? schedule.name : `${item.client} · ${item.reportingPeriod}`}</span>
                          </span>
                        </span>
                        <span className="col-span-2"><WorkStatus status={item.status} /></span>
                        <span className="col-span-2 text-sm capitalize text-muted-foreground">{item.trigger}</span>
                        <span className="col-span-2 text-sm text-muted-foreground">{item.updatedAt}</span>
                        <span className="text-right text-sm font-medium text-primary">View</span>
                      </button>
                    )
                  }) : null}
                </React.Fragment>
              )
            })}
            {groupedRuns.length === 0 ? <p className="px-4 py-12 text-center text-sm text-muted-foreground">No runs match these filters.</p> : null}
          </div>
        </div>
      </div>

      {selectedItem ? (
        <WorkInspectorPanel
          item={selectedItem}
          state={state}
          previewArtifact={previewArtifact}
          artifactComparison={artifactComparison}
          onPreview={(artifact) => {
            setArtifactComparison(null)
            setPreviewArtifact(artifact)
          }}
          onCompare={(base, target) => {
            setPreviewArtifact(null)
            setArtifactComparison({ base, target })
          }}
          onBackToDetails={() => {
            setPreviewArtifact(null)
            setArtifactComparison(null)
          }}
          onClose={() => onNavigate("/runs")}
          onOpenConversation={() => onOpenConversation(selectedItem)}
          onRetry={() => onRetry(selectedItem)}
          onResume={() => onResume(selectedItem)}
          onRerun={() => onRerun(selectedItem)}
          onCancel={() => onCancel(selectedItem)}
          onNavigate={onNavigate}
        />
      ) : null}
    </div>
  )
}

function WorkInspectorPanel({
  item,
  state,
  previewArtifact,
  artifactComparison,
  onPreview,
  onCompare,
  onBackToDetails,
  onClose,
  onOpenConversation,
  onRetry,
  onResume,
  onRerun,
  onCancel,
  onNavigate,
}: {
  item: WorkItem
  state: DemoState
  previewArtifact: Artifact | null
  artifactComparison: { base: Artifact; target: Artifact } | null
  onPreview: (artifact: Artifact | null) => void
  onCompare: (base: Artifact, target: Artifact) => void
  onBackToDetails: () => void
  onClose: () => void
  onOpenConversation: () => void
  onRetry: () => void
  onResume: () => void
  onRerun: () => void
  onCancel: () => void
  onNavigate: Navigate
}) {
  const flow = state.flows.find((entry) => entry.id === item.flowId)
  const schedule = state.schedules.find((entry) => entry.id === item.scheduleId)
  const request = state.requests.find((entry) => entry.id === item.requestId)
  const pdfArtifacts = item.artifacts.filter((artifact) => artifact.kind === "pdf").sort((a, b) => b.version - a.version)
  const report = pdfArtifacts[0]
  const auditEntries = buildRunAuditLog(item, request)
  const needsMissingFile = (item.status === "pending" || item.status === "needs_attention") && item.flowId === "flow-cash"
  const canCancel = ["queued", "working", "pending", "needs_attention", "ready_for_approval", "delivering"].includes(item.status)

  if (artifactComparison) {
    return (
      <ArtifactComparisonPanel
        item={item}
        base={artifactComparison.base}
        target={artifactComparison.target}
        onBack={onBackToDetails}
        onClose={onClose}
        onPreview={onPreview}
      />
    )
  }

  if (previewArtifact) {
    return (
      <aside className="flex h-full w-full shrink-0 flex-col overflow-hidden border-l border-border bg-muted/20 lg:w-96">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-3">
          <Button variant="ghost" size="sm" onClick={onBackToDetails}>
            <ArrowLeft aria-hidden="true" />
            <span className="max-w-56 truncate">{getRunName(item, flow?.name)}</span>
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close run inspector"><X /></Button>
        </div>
        <div className="border-b border-border bg-background px-4 py-3">
          <p className="truncate text-sm font-medium">{previewArtifact.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">PDF · v{previewArtifact.version} · {previewArtifact.createdAt}</p>
        </div>
        <iframe
          title={`${previewArtifact.name} version ${previewArtifact.version} preview`}
          src={getReportPreviewUrl(previewArtifact.name)}
          className="min-h-0 w-full flex-1 border-0 bg-background"
        />
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-border bg-background lg:w-96">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{getRunName(item, flow?.name)}</p>
          <p className="truncate text-xs capitalize text-muted-foreground">{getRunTechnicalLabel(item)}</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close run inspector"><X /></Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <section>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Current status</h3>
            <WorkStatus status={item.status} />
          </div>
          <p className="mt-3 text-sm leading-6 text-secondary-foreground">{workIntro(item)}</p>
        </section>

        {item.status === "failed" && item.failure ? (
          <section className="mt-6 rounded-lg border border-warning-high bg-warning-high-background p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">Recovery options</h3>
              <span className="text-xs text-muted-foreground">Failed {item.failure.failedAt}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-secondary-foreground">{item.failure.reason}</p>
            <dl className="mt-3 space-y-2 rounded-md border border-border bg-background p-3 text-sm">
              <InspectorField label="Failed step" value={item.failure.step} />
              <InspectorField label="Checkpoint" value={item.failure.checkpoint} />
            </dl>
            <div className="mt-4 space-y-3">
              <div>
                <Button className="w-full" onClick={onResume}>Resume from checkpoint</Button>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Continue this Run using the validated work already retained.</p>
              </div>
              <div>
                <Button variant="outline" className="w-full" onClick={onRetry}>Retry failed step</Button>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Retry only “{item.failure.step}” in this Run.</p>
              </div>
              <div>
                <Button variant="outline" className="w-full" onClick={onRerun}>Rerun from start</Button>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Create a new Run using the latest Flow version and inputs.</p>
              </div>
            </div>
          </section>
        ) : null}

        {item.status === "pending" || item.status === "needs_attention" ? (
          <section className="mt-6 rounded-lg border border-warning-low bg-warning-low-background p-4">
            <h3 className="text-sm font-medium">Needs your attention</h3>
            <p className="mt-1 text-sm leading-6 text-secondary-foreground">
              {needsMissingFile
                ? "One required approval message is missing. Upload it or ask Enable to continue searching."
                : "Choose which authorized AUM value should be used before the report continues."}
            </p>
            <div className="mt-3 rounded-md border border-border bg-background p-3">
              <p className="text-sm font-medium">{needsMissingFile ? "Treasury_Adjustment_Approval.msg" : "Approved worksheet · 1.241B"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {needsMissingFile ? "Required source · Not found" : "Updated 30 Apr, 08:55 · Recommended source"}
              </p>
            </div>
            <Button className="mt-3 w-full" onClick={onOpenConversation}>
              {needsMissingFile ? "Resolve missing file in Agent Workspace" : "Review decision in Agent Workspace"}
            </Button>
          </section>
        ) : item.status === "ready_for_approval" ? (
          <section className="mt-6 rounded-lg border border-warning-low bg-warning-low-background p-4">
            <h3 className="text-sm font-medium">Needs your attention</h3>
            <p className="mt-1 text-sm leading-6 text-secondary-foreground">Review and approve the generated report package before delivery.</p>
            <Button className="mt-3 w-full" onClick={onOpenConversation}>Review report in Agent Workspace</Button>
          </section>
        ) : null}

        {report ? (
          <section className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-medium">Report</h3>
            <AiAttachmentCard
              fluid
              role="button"
              tabIndex={0}
              icon={<FileText />}
              title={report.name}
              meta={`PDF · v${report.version} · Current · ${report.createdAt}`}
              className="mt-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onPreview(report)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onPreview(report)
                }
              }}
            />
            {pdfArtifacts.length > 1 ? (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-medium">Previous versions</h4>
                  <span className="text-xs text-muted-foreground">{pdfArtifacts.length - 1} previous</span>
                </div>
                <div className="mt-3 divide-y divide-border rounded-lg border border-border">
                  {pdfArtifacts.slice(1).map((artifact) => (
                    <div key={artifact.id} className="flex items-center gap-3 px-3 py-3">
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">v{artifact.version}</span>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{artifact.createdAt}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => onCompare(artifact, report)}>Compare with current</Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <details className="mt-6 border-t border-border pt-5">
          <summary className="cursor-pointer text-sm font-medium">Run details</summary>
          <dl className="mt-4 space-y-3 text-sm">
            {flow ? <InspectorLink label="Flow" value={flow.name} onClick={() => onNavigate(`/flows?selected=${flow.id}`)} /> : <InspectorField label="Flow" value="Not assigned" />}
            {schedule && flow ? <InspectorLink label="Schedule" value={schedule.name} onClick={() => onNavigate(`/flows?selected=${flow.id}`)} /> : null}
            {request ? <InspectorLink label="Request" value={request.title} onClick={() => onNavigate(`/requests/${request.id}`)} /> : null}
            <InspectorField label="Source profile" value={item.sourceProfile} />
            <InspectorField label="Run" value={`#${getRunNumber(item)}`} />
            <InspectorField label="Started" value={getRunDate(item)} />
            <InspectorField label="Updated" value={item.updatedAt} />
          </dl>
        </details>

        <details className="mt-6 border-t border-border pt-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
            <span>Audit log</span>
            <span className="text-xs font-normal text-muted-foreground">{auditEntries.length} {auditEntries.length === 1 ? "event" : "events"}</span>
          </summary>
          <div className="mt-4 space-y-4">
            {auditEntries.map((entry) => (
              <div key={entry.id} className="border-l border-border pl-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{entry.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{entry.at}</span>
                </div>
                <p className="mt-1 text-sm leading-5 text-secondary-foreground">{entry.detail}</p>
                <p className="mt-1 text-xs text-muted-foreground">{entry.actor}</p>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="shrink-0 border-t border-border p-4">
        <div className={cn("grid gap-2", canCancel && "grid-cols-2")}>
          {canCancel ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">Cancel run</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel this run?</DialogTitle>
                  <DialogDescription>
                    This stops the current execution. Generated artifacts and the complete audit history will remain available.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Keep running</Button></DialogClose>
                  <DialogClose asChild><Button variant="destructive" onClick={onCancel}>Cancel run</Button></DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
          <Button variant="outline" className="w-full" onClick={onOpenConversation}>Open conversation</Button>
        </div>
      </div>
    </aside>
  )
}

function ArtifactComparisonPanel({
  item,
  base,
  target,
  onBack,
  onClose,
  onPreview,
}: {
  item: WorkItem
  base: Artifact
  target: Artifact
  onBack: () => void
  onClose: () => void
  onPreview: (artifact: Artifact) => void
}) {
  const changes = item.flowId === "flow-mufg"
    ? [
        { label: "AUM source", before: "Reporting workbook", after: "Approved Risk Ledger" },
        { label: "Validation evidence", before: "Source mismatch flagged", after: "Source decision attached" },
        { label: "Review status", before: "Draft", after: "Ready for approval" },
      ]
    : [
        { label: "Report content", before: "Original draft", after: "Revised after review" },
        { label: "Validation evidence", before: "Initial validation", after: "Updated evidence attached" },
        { label: "Review status", before: "Draft", after: "Ready for approval" },
      ]

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-border bg-background lg:w-96">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Report
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close artifact comparison"><X /></Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Report version comparison</p>
        <h2 className="mt-1 break-words text-lg font-medium">{target.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Review what changed before relying on the current version.</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Baseline</p>
            <p className="mt-1 text-sm font-medium">Version {base.version}</p>
            <p className="mt-1 text-xs text-muted-foreground">{base.createdAt}</p>
          </div>
          <div className="rounded-lg border border-primary bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="mt-1 text-sm font-medium">Version {target.version}</p>
            <p className="mt-1 text-xs text-muted-foreground">{target.createdAt}</p>
          </div>
        </div>

        <section className="mt-7">
          <h3 className="text-sm font-medium">Changes in v{target.version}</h3>
          <div className="mt-3 divide-y divide-border rounded-lg border border-border">
            {changes.map((change) => (
              <div key={change.label} className="p-3">
                <p className="text-xs font-medium text-muted-foreground">{change.label}</p>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">v{base.version}</p>
                    <p className="mt-1 leading-5">{change.before}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">v{target.version}</p>
                    <p className="mt-1 font-medium leading-5">{change.after}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border p-4">
        <Button variant="outline" onClick={() => onPreview(base)}>Preview v{base.version}</Button>
        <Button onClick={() => onPreview(target)}>Preview v{target.version}</Button>
      </div>
    </aside>
  )
}

type RunAuditEntry = {
  id: string
  title: string
  detail: string
  actor: string
  at: string
}

function buildRunAuditLog(item: WorkItem, request?: RequestRecord): RunAuditEntry[] {
  const events: RunAuditEntry[] = [
    ...item.activities.map((activity) => ({
      id: `activity-${activity.id}`,
      title: activity.label,
      detail: "Run activity recorded in the governed execution history.",
      actor: activity.label.startsWith("Schedule")
        ? "Scheduler"
        : activity.label.startsWith("User")
          ? "Erin Chen"
          : "Enable",
      at: activity.at,
    })),
    ...item.artifacts.map((artifact) => ({
      id: `artifact-${artifact.id}`,
      title: `Artifact v${artifact.version} created`,
      detail: artifact.name,
      actor: "Enable",
      at: artifact.createdAt,
    })),
    ...item.decisions.map((decision) => ({
      id: `decision-${decision.id}`,
      title: decision.label,
      detail: decision.value,
      actor: "Erin Chen · Data decision",
      at: decision.decidedAt,
    })),
  ]

  if (request?.approvalComment) {
    events.push({
      id: `approval-${request.id}`,
      title: "Run approved",
      detail: request.approvalComment,
      actor: "Erin Chen · Approval",
      at: request.updatedAt,
    })
  }

  return events.sort((a, b) => auditTimeValue(b.at) - auditTimeValue(a.at))
}

function auditTimeValue(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0
}

function InspectorField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

function InspectorLink({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right"><button type="button" onClick={onClick} className="font-medium text-primary hover:underline">{value}</button></dd>
    </div>
  )
}

export function WorkItemPage({
  item,
  state,
  onNavigate,
  onResolveDecision,
  onApprove,
  onMessage,
  onConfirmSchedule,
}: {
  item: WorkItem
  state: DemoState
  onNavigate: Navigate
  onResolveDecision: () => void
  onApprove: () => void
  onMessage: (message: string) => void
  onConfirmSchedule: () => void
}) {
  const [message, setMessage] = React.useState("")
  const parentRequest = state.requests.find((request) => request.id === item.requestId)
  const relatedWork = parentRequest?.workItemIds
    .filter((id) => id !== item.id)
    .map((id) => state.workItems.find((entry) => entry.id === id))
    .filter((entry): entry is WorkItem => Boolean(entry)) ?? []
  const messages = parentRequest?.messages.filter((entry) => entry.workItemId === item.id) ?? []

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border px-6 py-4">
        {parentRequest && parentRequest.workItemIds.length > 1 ? (
          <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            <button type="button" className="hover:text-foreground" onClick={() => onNavigate(`/requests/${parentRequest.id}`)}>{parentRequest.title}</button>
            <ChevronRight className="size-3" aria-hidden="true" />
            <span>{item.title}</span>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="truncate text-xl font-semibold">{item.title}</h1>
              <WorkStatus status={item.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.client} · {item.reportingPeriod} · {item.trigger === "scheduled" ? "Scheduled" : "User request"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" disabled={item.status === "completed"}><Pause /> Pause</Button>
            <Button variant="ghost" size="sm" disabled={item.status === "completed"}><X /> Cancel</Button>
            <ExecutionDetails item={item} />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="relative flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-28 pt-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-7">
              <Message role="agent" content={workIntro(item)} />
              <SourceSummary />
              {item.status === "needs_attention" ? <SourceComparison onAccept={onResolveDecision} /> : null}
              {item.status === "working" ? <WorkingProgress /> : null}
              {item.status === "ready_for_approval" ? <ApprovalReview item={item} onApprove={onApprove} /> : null}
              {item.status === "completed" ? <CompletionReceipt item={item} /> : null}
              {messages.map((entry) => <Message key={entry.id} role={entry.role} content={entry.content} />)}
              {item.scheduleDraftVisible ? <ScheduleDraft prompt="Run the MUFG report every month" onConfirm={() => onConfirmSchedule()} /> : null}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-8 pb-5">
            <div className="pointer-events-auto mx-auto max-w-3xl">
              <Composer
                value={message}
                onValueChange={setMessage}
                onSubmit={(value) => {
                  onMessage(value)
                  setMessage("")
                }}
                placeholder={item.status === "completed" ? "Ask a follow-up or make this recurring" : "Ask about this run or request a change"}
                collapsible
              />
            </div>
          </div>
        </section>
        <ContextPanel item={item} relatedWork={relatedWork} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

function workIntro(item: WorkItem) {
  if (item.status === "failed") return "This Run stopped before completion. Review the failed step and choose whether to retry it, resume from the retained checkpoint, or start a new Run."
  if (item.status === "cancelled") return "This Run was cancelled. Its generated artifacts, decisions, and complete activity history remain available for audit."
  if (item.recoveryMethod === "resume") return "Recovery is in progress from the retained checkpoint. Previously validated work remains attached to this Run."
  if (item.recoveryMethod === "retry") return "The failed step is being retried in this Run. Completed steps and the existing audit history are retained."
  if (item.recoveryMethod === "rerun") return "This new Run started from the beginning using the latest published Flow and current authorized inputs."
  if (item.status === "pending" && item.flowId === "flow-cash") return "Two of three required files were found. The Treasury approval message is still missing, so this run is pending until the source is recovered."
  if (item.status === "needs_attention" && item.flowId === "flow-cash") return "Two of three required files were found. The Treasury approval message is still missing, so this run is paused until the source is recovered."
  if (item.status === "needs_attention") return "I found all required inputs and fixed one file name. One AUM value conflicts across authorized sources, so I need your decision before I continue."
  if (item.status === "ready_for_approval") return "The report package is ready. I validated the source set, applied the confirmed source values, and prepared the result for approval."
  if (item.status === "completed") return "The approved result and its full source, decision, version, and approval record are retained here."
  return "I am progressing this run using its published Flow and authorized source profile."
}

function SourceSummary() {
  return (
    <section className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">Sources ready</h2>
          <p className="mt-1 text-sm text-muted-foreground">12 of 12 required inputs found · 0 uploads</p>
        </div>
        <StatusBadge status="success">Complete</StatusBadge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
        <div className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" aria-hidden="true" /><span>Outlook · 4 attachments</span></div>
        <div className="flex items-center gap-2"><Share2 className="size-4 text-muted-foreground" aria-hidden="true" /><span>SharePoint · 8 files</span></div>
      </div>
    </section>
  )
}

function SourceComparison({ onAccept }: { onAccept: () => void }) {
  return (
    <section className="rounded-xl border border-warning-medium bg-warning-medium-background p-5">
      <div className="flex items-start gap-3">
        <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-warning-medium-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">Choose the AUM value for the report</h2>
          <p className="mt-1 text-sm text-secondary-foreground">The approved worksheet is newer and is the authorized source for published AUM.</p>
          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background">
            <ComparisonRow label="Email attachment" value="1.238B" meta="Received 29 Apr, 16:42" />
            <ComparisonRow label="Approved worksheet" value="1.241B" meta="Updated 30 Apr, 08:55 · Authorized" recommended />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={onAccept}>Use approved worksheet</Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function ComparisonRow({ label, value, meta, recommended }: { label: string; value: string; meta: string; recommended?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0", recommended && "bg-brand-1")}>
      <div>
        <div className="flex items-center gap-2 text-sm font-medium">{label}{recommended ? <StatusBadge status="normal" iconVariant="none">Recommended</StatusBadge> : null}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
      </div>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function WorkingProgress() {
  return (
    <section className="rounded-xl border border-border p-5">
      <div className="flex items-center gap-3">
        <span className="size-2 rounded-full bg-brand motion-safe:animate-pulse" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-medium">Preparing the report package</h2>
          <p className="mt-1 text-sm text-muted-foreground">Applying validation rules and generating Word and PDF versions.</p>
        </div>
      </div>
    </section>
  )
}

function ApprovalReview({ item, onApprove }: { item: WorkItem; onApprove: () => void }) {
  return (
    <section className="rounded-xl border border-border p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approval review</p>
          <h2 className="mt-1 text-lg font-medium">Approve the current report version for delivery</h2>
        </div>
        <StatusBadge status="warning-low">Approval required</StatusBadge>
      </div>
      <div className="mt-5 divide-y divide-border rounded-lg border border-border">
        {item.artifacts.length > 0 ? item.artifacts.map((artifact) => (
          <div key={artifact.id} className="flex items-center gap-3 px-4 py-3">
            <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm">{artifact.name}</span>
            <span className="text-xs text-muted-foreground">v{artifact.version}</span>
          </div>
        )) : (
          <>
            <ArtifactRow name="MUFG-April-2026-Report.docx" />
            <ArtifactRow name="MUFG-April-2026-Report.pdf" />
          </>
        )}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-6 text-sm">
        <div>
          <h3 className="font-medium">Key changes</h3>
          <p className="mt-1 text-muted-foreground">AUM set to 1.241B from the approved worksheet. File naming normalized.</p>
        </div>
        <div>
          <h3 className="font-medium">Validation</h3>
          <p className="mt-1 text-muted-foreground">12/12 inputs · 8 checks passed · 6 internal test recipients</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={onApprove}><Send aria-hidden="true" />Approve and send</Button>
      </div>
    </section>
  )
}

function ArtifactRow({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      <span className="text-xs text-muted-foreground">v1</span>
    </div>
  )
}

function CompletionReceipt({ item }: { item: WorkItem }) {
  return (
    <section className="rounded-xl border border-success bg-success-background p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 text-success-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">Report delivered</h2>
          <p className="mt-1 text-sm text-secondary-foreground">Sent to 6 internal test recipients. Delivery and approval evidence were recorded.</p>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <ReceiptField label="Approved by" value="Erin Chen" />
            <ReceiptField label="Delivered" value="30 Apr, 10:31" />
            <ReceiptField label="Artifact version" value={`v${Math.max(1, ...item.artifacts.map((artifact) => artifact.version))}`} />
          </div>
        </div>
      </div>
    </section>
  )
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>
}

function ContextPanel({ item, relatedWork, onNavigate }: { item: WorkItem; relatedWork: WorkItem[]; onNavigate: Navigate }) {
  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-muted/20 p-5">
      <ContextSection title="Task">
        <Detail label="Client" value={item.client} />
        <Detail label="Period" value={item.reportingPeriod} />
        <Detail label="Source profile" value={item.sourceProfile} />
      </ContextSection>
      <ContextSection title="Decisions">
        {item.decisions.length ? item.decisions.map((decision) => <Detail key={decision.id} label={decision.label} value={decision.value} />) : <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>}
      </ContextSection>
      <ContextSection title="Artifacts">
        {item.artifacts.length ? item.artifacts.map((artifact) => <p key={artifact.id} className="break-words text-sm">{artifact.name} <span className="text-muted-foreground">v{artifact.version}</span></p>) : <p className="text-sm text-muted-foreground">Artifacts will appear here.</p>}
      </ContextSection>
      {relatedWork.length ? (
        <ContextSection title="Related runs">
          {relatedWork.map((related) => (
            <button type="button" key={related.id} onClick={() => onNavigate(`/runs/${related.id}`)} className="flex w-full items-center justify-between gap-2 rounded-md py-1.5 text-left text-sm hover:text-primary">
              <span className="truncate">{related.title}</span>
              <WorkStatus status={related.status} />
            </button>
          ))}
        </ContextSection>
      ) : null}
      <ContextSection title="Activity">
        {item.activities.slice().reverse().map((activity) => (
          <div key={activity.id} className="border-l border-border pl-3 text-sm">
            <p>{activity.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{activity.at}</p>
          </div>
        ))}
      </ContextSection>
    </aside>
  )
}

function ContextSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-7"><h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2><div className="space-y-3">{children}</div></section>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-sm">{value}</p></div>
}

function ExecutionDetails({ item }: { item: WorkItem }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline" size="sm">Execution details</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Execution details</DialogTitle>
          <DialogDescription>Technical information is kept separate from the business workspace.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <Detail label="Current run" value={`Run #${getRunNumber(item)} · ${getRunDate(item)}`} />
          <Detail label="Flow" value={item.flowId ?? "Restricted runtime plan"} />
          <Detail label="Run ID" value={item.id} />
          <Detail label="Retry policy" value="Automatic retry for transient connector errors" />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ScheduleDraft({
  prompt,
  flow,
  schedule,
  initialName,
  initialFrequencyLabel,
  initialNextRunAt,
  resolved = false,
  onConfirm,
}: {
  prompt: string
  flow?: Flow
  schedule?: Schedule
  initialName?: string
  initialFrequencyLabel?: string
  initialNextRunAt?: string
  resolved?: boolean
  onConfirm: (input: { name: string; frequencyLabel: string; nextRunAt: string }) => void
}) {
  const sourceFrequency = initialFrequencyLabel ?? schedule?.frequencyLabel ?? "Last business day, 09:00"
  const sourceNextRun = initialNextRunAt ?? schedule?.nextRunAt ?? "30 Oct 2026, 09:00"
  const [name, setName] = React.useState(initialName ?? schedule?.name ?? `${flow?.name ?? "Flow"} schedule`)
  const [frequency, setFrequency] = React.useState(
    sourceFrequency.startsWith("Weekdays") ? "weekdays" : sourceFrequency.startsWith("Every Monday") ? "weekly" : "monthly",
  )
  const [time, setTime] = React.useState(sourceFrequency.match(/\d{2}:\d{2}/)?.[0] ?? "09:00")
  const frequencyLabel = frequency === "weekdays"
    ? `Weekdays, ${time}`
    : frequency === "weekly"
      ? `Every Monday, ${time}`
      : `Last business day, ${time}`
  const nextRunAt = frequency === "weekdays"
    ? `7 Oct 2026, ${time}`
    : frequency === "weekly"
      ? `12 Oct 2026, ${time}`
      : sourceNextRun.replace(/\d{2}:\d{2}/, time)
  const canConfirm = name.trim().length > 0 && time.length > 0

  return (
    <section aria-label="Agent response" className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 size-5 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Schedule preview</p>
              <h2 className="mt-1 text-lg font-medium">{name || "Untitled schedule"}</h2>
            </div>
            <StatusBadge status={resolved ? "success" : "unknown"}>{resolved ? "Submitted" : "Review"}</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Based on: {prompt}</p>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <label htmlFor="schedule-name" className="text-sm font-medium">Schedule name</label>
              <Input id="schedule-name" value={name} readOnly={resolved} className={cn(resolved && "bg-muted/20")} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="schedule-frequency" className="text-sm font-medium">Frequency</label>
                <Select value={frequency} onValueChange={setFrequency} disabled={resolved}>
                  <SelectTrigger id="schedule-frequency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekdays">Every weekday</SelectItem>
                    <SelectItem value="weekly">Every Monday</SelectItem>
                    <SelectItem value="monthly">Last business day of the month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="schedule-start-time" className="text-sm font-medium">Start time</label>
                <Input id="schedule-start-time" type="time" value={time} readOnly={resolved} className={cn(resolved && "bg-muted/20")} onChange={(event) => setTime(event.target.value)} />
              </div>
            </div>
          </div>
          <dl className="mt-5 space-y-3 rounded-lg bg-muted/30 p-4">
            <KeyValueRow label="Frequency" value={frequencyLabel} />
            <KeyValueRow label="First run" value={nextRunAt} />
            <KeyValueRow label="Flow" value={flow?.name ?? "Flow not available"} />
            <KeyValueRow label="Source profile" value={flow?.sourceProfile ?? "Not assigned"} />
            <KeyValueRow label="Approval" value={flow?.approvalPolicy ?? "Flow policy applies"} />
          </dl>
          {!resolved ? (
            <div className="mt-6 flex justify-end">
              <Button disabled={!canConfirm} onClick={() => onConfirm({ name: name.trim(), frequencyLabel, nextRunAt })}>Confirm schedule</Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function ScheduleCreationSequence({ onComplete }: { onComplete: () => void }) {
  const [activeStep, setActiveStep] = React.useState(0)
  const completeRef = React.useRef(onComplete)
  completeRef.current = onComplete
  const tools = [
    { value: "scheduler", title: "Schedule Registry", detail: "Saving the recurring trigger and next run time." },
    { value: "governance", title: "Governance Check", detail: "Linking the published Flow, sources, and approval policy." },
    { value: "activation", title: "Schedule Activation", detail: "Activating the schedule for its first governed run." },
  ]

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeStep < tools.length - 1) setActiveStep((step) => step + 1)
      else completeRef.current()
    }, 700)
    return () => window.clearTimeout(timer)
  }, [activeStep, tools.length])

  return (
    <section aria-label="Agent response" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">Creating schedule</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enable is registering and validating the recurring work.</p>
        </div>
        <StatusBadge status="normal">Working</StatusBadge>
      </div>
      <AiChain>
        {tools.map((tool, index) => {
          const status = index < activeStep ? "success" : index === activeStep ? "running" : "pending"
          return (
            <AiChainNode
              key={tool.value}
              value={tool.value}
              status={status}
              icon={status === "success" ? <Check /> : <Sparkles />}
              title={tool.title}
              description={tool.detail}
              defaultExpanded={status === "running"}
              collapseOnSuccess
            >
              {status === "running" ? <AiChainTaskBar status="running">Calling tool</AiChainTaskBar> : null}
            </AiChainNode>
          )
        })}
      </AiChain>
    </section>
  )
}

function CollapsedScheduleTools() {
  return <CollapsedChainSummary>Schedule created · 3 tools called</CollapsedChainSummary>
}

function ScheduleCreatedResult({ schedule, onOpen }: { schedule: Schedule; onOpen: () => void }) {
  return (
    <section aria-label="Agent response" className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">Schedule created</h2>
          <p className="mt-1 text-sm text-muted-foreground">{schedule.name} is active. The first run is {schedule.nextRunAt}.</p>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={onOpen}>View in Flow<ChevronRight aria-hidden="true" /></Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function FlowDraftForm({
  prompt,
  initialName,
  initialDescription,
  resolved,
  onConfirm,
}: {
  prompt: string
  initialName?: string
  initialDescription?: string
  resolved: boolean
  onConfirm: (name: string, description: string) => void
}) {
  const [name, setName] = React.useState(initialName ?? "Quarterly Management Fee Review")
  const [description, setDescription] = React.useState(initialDescription ?? "Compare quarterly management fees against approved client schedules.")
  const canCreate = name.trim().length > 0 && description.trim().length > 0

  return (
    <section aria-label="Agent response" className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Define the Flow</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {resolved ? "Submitted to Enable for creation." : "Confirm the name and description before Enable creates the draft."}
          </p>
        </div>
        {resolved ? <StatusBadge status="success">Submitted</StatusBadge> : null}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Based on: {prompt}</p>
      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <label htmlFor="flow-name" className="text-sm font-medium">Flow name</label>
          <Input id="flow-name" value={name} readOnly={resolved} className={cn(resolved && "bg-muted/20")} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <label htmlFor="flow-description" className="text-sm font-medium">Description</label>
          <Textarea id="flow-description" value={description} readOnly={resolved} className={cn(resolved && "bg-muted/20")} onChange={(event) => setDescription(event.target.value)} rows={3} />
        </div>
      </div>
      {!resolved ? (
        <div className="mt-6 flex justify-end">
          <Button disabled={!canCreate} onClick={() => onConfirm(name.trim(), description.trim())}>Create Flow</Button>
        </div>
      ) : null}
    </section>
  )
}

function FlowCreationSequence({ onComplete }: { onComplete: () => void }) {
  const [activeStep, setActiveStep] = React.useState(0)
  const completeRef = React.useRef(onComplete)
  completeRef.current = onComplete
  const tools = [
    { value: "builder", title: "Flow Builder", detail: "Creating the draft definition and execution steps." },
    { value: "validator", title: "Policy Validator", detail: "Checking sources, outputs, and publishing requirements." },
    { value: "registry", title: "Flow Registry", detail: "Saving the draft and preparing its preview." },
  ]

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeStep < tools.length - 1) setActiveStep((step) => step + 1)
      else completeRef.current()
    }, 700)
    return () => window.clearTimeout(timer)
  }, [activeStep, tools.length])

  return (
    <section aria-label="Agent response" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">Creating Flow</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enable is calling the tools needed to create a governed draft.</p>
        </div>
        <StatusBadge status="normal">Working</StatusBadge>
      </div>
      <AiChain>
        {tools.map((tool, index) => {
          const status = index < activeStep ? "success" : index === activeStep ? "running" : "pending"
          return (
            <AiChainNode
              key={tool.value}
              value={tool.value}
              status={status}
              icon={status === "success" ? <Check /> : <Sparkles />}
              title={tool.title}
              description={tool.detail}
              defaultExpanded={status === "running"}
              collapseOnSuccess
            >
              {status === "running" ? <AiChainTaskBar status="running">Calling tool</AiChainTaskBar> : null}
            </AiChainNode>
          )
        })}
      </AiChain>
    </section>
  )
}

function CollapsedFlowTools() {
  return <CollapsedChainSummary>Flow created · 3 tools called</CollapsedChainSummary>
}

function FlowDraftPreview({ flow, resolved = false, onPublish }: { flow: Flow; resolved?: boolean; onPublish: () => void }) {
  return (
    <section aria-label="Agent response" className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Flow preview</p>
          <h2 className="mt-1 text-lg font-medium">{flow.name}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{flow.description}</p>
        </div>
        <StatusBadge status="unknown">Draft</StatusBadge>
      </div>
      <dl className="mt-5 space-y-3 rounded-lg bg-muted/30 p-4">
        <KeyValueRow label="Owner" value={flow.owner} />
        <KeyValueRow label="Sources" value={flow.sourceProfile} />
        <KeyValueRow label="Output" value={flow.outputs.join(", ")} />
        <KeyValueRow label="Publishing" value="Requires review before activation" />
      </dl>
      <div className="mt-5 rounded-lg bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Execution preview</p>
        <ol className="mt-3 space-y-3">
          {flow.steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
      {resolved ? (
        <p className="mt-6 text-xs text-muted-foreground">This is the draft preview that was reviewed before publishing.</p>
      ) : (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">Publishing makes this Flow available to run and schedule.</p>
          <Button onClick={onPublish}>Publish Flow</Button>
        </div>
      )}
    </section>
  )
}

function FlowPublishedResult({ flow, onOpen, onRun }: { flow: Flow; onOpen: () => void; onRun: () => void }) {
  return (
    <section aria-label="Agent response" className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">Flow published</h2>
          <p className="mt-1 text-sm text-muted-foreground">{flow.name} is active and available to run or schedule.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onOpen}>View Flow<ChevronRight aria-hidden="true" /></Button>
            <Button onClick={onRun}><Play aria-hidden="true" />Run Flow</Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function KeyValueRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm sm:col-span-2">{value}</dd>
    </div>
  )
}

export function FlowListPage({
  state,
  selectedFlow,
  onNavigate,
  onCreate,
  onPublish,
  onRun,
  onSchedule,
  onAddSchedule,
  onRollback,
  onPublishEdit,
}: {
  state: DemoState
  selectedFlow?: Flow
  onNavigate: Navigate
  onCreate: () => void
  onPublish: (flow: Flow) => void
  onRun: (flow: Flow) => void
  onSchedule: (flow: Flow, schedule?: Schedule) => void
  onAddSchedule: (flow: Flow, input: ManualScheduleInput) => void
  onRollback: (flow: Flow, version: FlowVersion) => void
  onPublishEdit: (flow: Flow, input: FlowEditInput) => void
}) {
  return (
    <div className="flex h-full min-h-0">
      <div className={cn("min-w-0 flex-1 overflow-y-auto px-8 py-7", selectedFlow && "hidden lg:block")}>
        <div className="mx-auto max-w-6xl">
          <PageHeader title="Flows" description="Published and draft definitions for repeatable operational work." actions={<Button onClick={onCreate}><Sparkles />Create with Agent</Button>} />
          <div className="mt-7 overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-12 gap-4 border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span className="col-span-5">Name</span><span className="col-span-2">Status</span><span className="col-span-2">Owner</span><span className="col-span-1 text-right">Runs</span><span className="col-span-2">Updated</span>
            </div>
            {state.flows.map((flow) => (
              <button
                type="button"
                key={flow.id}
                aria-pressed={selectedFlow?.id === flow.id}
                onClick={() => onNavigate(`/flows?selected=${flow.id}`)}
                className={cn(
                  "grid w-full grid-cols-12 items-center gap-4 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/20",
                  selectedFlow?.id === flow.id && "bg-accent",
                )}
              >
                <span className="col-span-5 min-w-0"><span className="block truncate text-sm font-medium">{flow.name}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{flow.description}</span></span>
                <span className="col-span-2"><StatusBadge status={flow.status === "active" ? "success" : flow.status === "draft" ? "unknown" : "warning-medium"}>{flow.status === "active" ? "Active" : flow.status === "draft" ? "Draft" : "Paused"}</StatusBadge></span>
                <span className="col-span-2 truncate text-sm text-muted-foreground">{flow.owner}</span>
                <span className="col-span-1 text-right text-sm tabular-nums text-muted-foreground">{state.workItems.filter((item) => item.flowId === flow.id).length}</span>
                <span className="col-span-2 text-sm text-muted-foreground">{flow.updatedAt}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedFlow ? (
        <FlowInspectorPanel
          flow={selectedFlow}
          state={state}
          onClose={() => onNavigate("/flows")}
          onNavigate={onNavigate}
          onPublish={() => onPublish(selectedFlow)}
          onRun={() => onRun(selectedFlow)}
          onSchedule={(schedule) => onSchedule(selectedFlow, schedule)}
          onAddSchedule={(input) => onAddSchedule(selectedFlow, input)}
          onRollback={(version) => onRollback(selectedFlow, version)}
          onPublishEdit={(input) => onPublishEdit(selectedFlow, input)}
        />
      ) : null}
    </div>
  )
}

function FlowInspectorPanel({
  flow,
  state,
  onClose,
  onNavigate,
  onPublish,
  onRun,
  onSchedule,
  onAddSchedule,
  onRollback,
  onPublishEdit,
}: {
  flow: Flow
  state: DemoState
  onClose: () => void
  onNavigate: Navigate
  onPublish: () => void
  onRun: () => void
  onSchedule: (schedule?: Schedule) => void
  onAddSchedule: (input: ManualScheduleInput) => void
  onRollback: (version: FlowVersion) => void
  onPublishEdit: (input: FlowEditInput) => void
}) {
  const [mode, setMode] = React.useState<"view" | "edit" | "preview">("view")
  const [draft, setDraft] = React.useState<FlowEditInput>(() => flowToEditInput(flow))
  const [comparedVersion, setComparedVersion] = React.useState<FlowVersion | null>(null)
  const schedule = state.schedules.find((entry) => entry.flowId === flow.id)
  const recentRuns = state.workItems.filter((item) => item.flowId === flow.id).sort((a, b) => getRunNumber(b) - getRunNumber(a)).slice(0, 3)
  const currentVersion = flow.version ?? Math.max(1, ...(flow.versions ?? []).map((entry) => entry.version))
  const currentVersionRecord = (flow.versions ?? []).find((entry) => entry.version === currentVersion)
  const previousVersions = (flow.versions ?? []).filter((entry) => entry.version < currentVersion).sort((a, b) => b.version - a.version)

  React.useEffect(() => {
    setComparedVersion(null)
    setMode("view")
    setDraft(flowToEditInput(flow))
  }, [flow.id, flow.version])

  if (mode === "edit") {
    return (
      <FlowEditPanel
        flow={flow}
        draft={draft}
        onChange={setDraft}
        onCancel={() => {
          setDraft(flowToEditInput(flow))
          setMode("view")
        }}
        onPreview={() => {
          setDraft(normalizeFlowEditInput(draft))
          setMode("preview")
        }}
        onClose={onClose}
      />
    )
  }

  if (mode === "preview") {
    return (
      <FlowEditPreviewPanel
        flow={flow}
        draft={draft}
        onBack={() => setMode("edit")}
        onClose={onClose}
        onPublish={() => {
          onPublishEdit(draft)
          setMode("view")
        }}
      />
    )
  }

  if (comparedVersion) {
    return (
      <FlowVersionComparisonPanel
        flow={flow}
        version={comparedVersion}
        onBack={() => setComparedVersion(null)}
        onClose={onClose}
        onRollback={() => {
          onRollback(comparedVersion)
          setComparedVersion(null)
        }}
      />
    )
  }

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-border bg-background lg:w-96">
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{flow.name}</p>
          <p className="truncate text-xs text-muted-foreground">Updated {flow.updatedAt}</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close Flow inspector"><X /></Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={flow.status === "active" ? "success" : flow.status === "draft" ? "unknown" : "warning-medium"}>{flow.status === "active" ? "Active" : flow.status === "draft" ? "Draft" : "Paused"}</StatusBadge>
          <span className="text-xs text-muted-foreground">{flow.owner}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-secondary-foreground">{flow.description}</p>

        <dl className="mt-6 space-y-3 text-sm">
          <InspectorField label="Source" value={flow.sourceProfile} />
          <InspectorField label="Approval" value={flow.approvalPolicy} />
        </dl>

        <section className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Schedule</h3>
            {schedule ? (
              <Button variant="ghost" size="sm" onClick={() => onSchedule(schedule)}>Modify with Agent</Button>
            ) : (
              <AddScheduleDialog flow={flow} onAdd={onAddSchedule} onCreateWithAgent={() => onSchedule()} />
            )}
          </div>
          {schedule ? (
            <dl className="mt-3 space-y-3 rounded-lg bg-muted/40 p-3 text-sm">
              <InspectorField label="Status" value={schedule.status === "active" ? "Active" : "Paused"} />
              <InspectorField label="Frequency" value={schedule.frequencyLabel} />
              <InspectorField label="Next run" value={schedule.nextRunAt} />
            </dl>
          ) : (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">No schedule configured. This Flow can still be run on request.</p>
          )}
        </section>

        <section className="mt-7">
          <h3 className="text-sm font-medium">Inputs</h3>
          <SimpleList items={flow.inputs} />
        </section>

        <section className="mt-7">
          <h3 className="text-sm font-medium">Output</h3>
          <SimpleList items={flow.outputs} />
        </section>

        <section className="mt-7">
          <h3 className="text-sm font-medium">How it runs</h3>
          <ol className="mt-3 space-y-3">
            {flow.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-7">
          <h3 className="text-sm font-medium">Checks before approval</h3>
          <SimpleList items={flow.validationRules} />
        </section>

        <section className="mt-7 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Flow versions</h3>
            <span className="text-xs text-muted-foreground">v{currentVersion} current</span>
          </div>
          {currentVersionRecord ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{currentVersionRecord.changeSummary}</p> : null}
          {previousVersions.length > 0 ? (
            <div className="mt-3 divide-y divide-border rounded-lg border border-border">
              {previousVersions.map((version) => (
                <div key={version.id} className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Version {version.version}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{version.changeSummary}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setComparedVersion(version)}>Compare</Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No previous published versions.</p>
          )}
        </section>

        {recentRuns.length > 0 ? (
          <section className="mt-7">
            <h3 className="text-sm font-medium">Recent runs</h3>
            <div className="mt-2">
              {recentRuns.map((item) => (
                <button type="button" key={item.id} onClick={() => onNavigate(`/runs?selected=${item.id}`)} className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-2 text-left hover:bg-muted/40">
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{getRunName(item, flow.name)}</span>
                    <span className="block truncate text-xs capitalize text-muted-foreground">{getRunTechnicalLabel(item)}</span>
                  </span>
                  <WorkStatus status={item.status} />
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border p-4">
        {flow.status === "draft" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setMode("edit")}>Edit Flow</Button>
            <Button onClick={onPublish}>Publish Flow</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setMode("edit")}>Edit Flow</Button>
            <Button onClick={onRun}><Play />Run Flow</Button>
          </div>
        )}
      </div>
    </aside>
  )
}

function flowToEditInput(flow: Flow): FlowEditInput {
  return {
    name: flow.name,
    description: flow.description,
    sourceProfile: flow.sourceProfile,
    inputs: [...flow.inputs],
    steps: [...flow.steps],
    outputs: [...flow.outputs],
    validationRules: [...flow.validationRules],
    approvalPolicy: flow.approvalPolicy,
  }
}

function linesToItems(value: string) {
  return value.split("\n")
}

function normalizeFlowEditInput(draft: FlowEditInput): FlowEditInput {
  const normalizeItems = (items: string[]) => items.map((item) => item.trim()).filter(Boolean)
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    sourceProfile: draft.sourceProfile.trim(),
    inputs: normalizeItems(draft.inputs),
    steps: normalizeItems(draft.steps),
    outputs: normalizeItems(draft.outputs),
    validationRules: normalizeItems(draft.validationRules),
    approvalPolicy: draft.approvalPolicy.trim(),
  }
}

function FlowEditPanel({
  flow,
  draft,
  onChange,
  onCancel,
  onPreview,
  onClose,
}: {
  flow: Flow
  draft: FlowEditInput
  onChange: (draft: FlowEditInput) => void
  onCancel: () => void
  onPreview: () => void
  onClose: () => void
}) {
  const current = flowToEditInput(flow)
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(current)
  const isValid = draft.name.trim().length > 0
    && draft.description.trim().length > 0
    && draft.sourceProfile.trim().length > 0
    && draft.inputs.some((item) => item.trim().length > 0)
    && draft.steps.some((item) => item.trim().length > 0)
    && draft.outputs.some((item) => item.trim().length > 0)
    && draft.validationRules.some((item) => item.trim().length > 0)
    && draft.approvalPolicy.trim().length > 0
  const version = flow.version ?? 1

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-border bg-background lg:w-96">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
        <Button variant="ghost" size="sm" onClick={onCancel}><ArrowLeft aria-hidden="true" />Flow details</Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close Flow editor"><X /></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Draft from version {version}</p>
        <h2 className="mt-1 text-lg font-medium">Edit Flow</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Changes stay in this draft until you preview and publish a new version.</p>

        <div className="mt-6 space-y-5">
          <FlowTextField label="Flow name" value={draft.name} onChange={(name) => onChange({ ...draft, name })} />
          <FlowTextareaField label="Description" value={draft.description} rows={3} onChange={(description) => onChange({ ...draft, description })} />
          <FlowTextField label="Source profile" value={draft.sourceProfile} onChange={(sourceProfile) => onChange({ ...draft, sourceProfile })} />
          <FlowTextareaField label="Inputs" hint="One item per line" value={draft.inputs.join("\n")} rows={4} onChange={(value) => onChange({ ...draft, inputs: linesToItems(value) })} />
          <FlowTextareaField label="Steps" hint="One step per line" value={draft.steps.join("\n")} rows={6} onChange={(value) => onChange({ ...draft, steps: linesToItems(value) })} />
          <FlowTextareaField label="Outputs" hint="One item per line" value={draft.outputs.join("\n")} rows={4} onChange={(value) => onChange({ ...draft, outputs: linesToItems(value) })} />
          <FlowTextareaField label="Validation rules" hint="One rule per line" value={draft.validationRules.join("\n")} rows={6} onChange={(value) => onChange({ ...draft, validationRules: linesToItems(value) })} />
          <FlowTextField label="Approval policy" value={draft.approvalPolicy} onChange={(approvalPolicy) => onChange({ ...draft, approvalPolicy })} />
        </div>
      </div>
      <div className="shrink-0 border-t border-border p-4">
        <Button className="w-full" disabled={!hasChanges || !isValid} onClick={onPreview}>Preview changes</Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Existing Runs continue using the version they started with.</p>
      </div>
    </aside>
  )
}

function FlowTextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = React.useId()
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function FlowTextareaField({ label, hint, value, rows, onChange }: { label: string; hint?: string; value: string; rows: number; onChange: (value: string) => void }) {
  const id = React.useId()
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <Textarea id={id} value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function FlowEditPreviewPanel({
  flow,
  draft,
  onBack,
  onClose,
  onPublish,
}: {
  flow: Flow
  draft: FlowEditInput
  onBack: () => void
  onClose: () => void
  onPublish: () => void
}) {
  const currentVersion = flow.version ?? 1
  const changes = [
    { label: "Flow name", before: flow.name, after: draft.name },
    { label: "Description", before: flow.description, after: draft.description },
    { label: "Source profile", before: flow.sourceProfile, after: draft.sourceProfile },
    { label: "Inputs", before: flow.inputs.join(" · "), after: draft.inputs.join(" · ") },
    { label: "Steps", before: flow.steps.join(" · "), after: draft.steps.join(" · ") },
    { label: "Outputs", before: flow.outputs.join(" · "), after: draft.outputs.join(" · ") },
    { label: "Validation rules", before: flow.validationRules.join(" · "), after: draft.validationRules.join(" · ") },
    { label: "Approval policy", before: flow.approvalPolicy, after: draft.approvalPolicy },
  ].filter((change) => change.before !== change.after)

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-border bg-background lg:w-96">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft aria-hidden="true" />Edit Flow</Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close Flow change preview"><X /></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Publish preview</p>
        <h2 className="mt-1 text-lg font-medium">Version {currentVersion + 1}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Review the draft against version {currentVersion}. Publishing applies these changes to future Runs.</p>
        <section className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Changed fields</h3>
            <span className="text-xs text-muted-foreground">{changes.length} {changes.length === 1 ? "change" : "changes"}</span>
          </div>
          <div className="mt-3 divide-y divide-border rounded-lg border border-border">
            {changes.map((change) => (
              <div key={change.label} className="p-3">
                <p className="text-xs font-medium text-muted-foreground">{change.label}</p>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">v{currentVersion}</p><p className="mt-1 whitespace-pre-wrap leading-5">{change.before}</p></div>
                  <div><p className="text-xs text-muted-foreground">Draft</p><p className="mt-1 whitespace-pre-wrap font-medium leading-5">{change.after}</p></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="shrink-0 border-t border-border p-4">
        <Button className="w-full" onClick={onPublish}>Publish version {currentVersion + 1}</Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Version {currentVersion} remains available for comparison and rollback.</p>
      </div>
    </aside>
  )
}

function FlowVersionComparisonPanel({
  flow,
  version,
  onBack,
  onClose,
  onRollback,
}: {
  flow: Flow
  version: FlowVersion
  onBack: () => void
  onClose: () => void
  onRollback: () => void
}) {
  const currentVersion = flow.version ?? Math.max(1, ...(flow.versions ?? []).map((entry) => entry.version))
  const changes = [
    { label: "Description", previous: version.snapshot.description, current: flow.description },
    { label: "Source profile", previous: version.snapshot.sourceProfile, current: flow.sourceProfile },
    { label: "Steps", previous: version.snapshot.steps.join(" · "), current: flow.steps.join(" · ") },
    { label: "Validation rules", previous: version.snapshot.validationRules.join(" · "), current: flow.validationRules.join(" · ") },
    { label: "Approval policy", previous: version.snapshot.approvalPolicy, current: flow.approvalPolicy },
  ].filter((change) => change.previous !== change.current)

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-border bg-background lg:w-96">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft aria-hidden="true" />Flow versions</Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close Flow version comparison"><X /></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Flow version comparison</p>
        <h2 className="mt-1 text-lg font-medium">Version {version.version} → Version {currentVersion}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Compare the published definition before restoring an earlier version.</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Version {version.version}</p>
            <p className="mt-1 text-sm font-medium">{version.publishedAt}</p>
            <p className="mt-1 text-xs text-muted-foreground">{version.publishedBy}</p>
          </div>
          <div className="rounded-lg border border-primary bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="mt-1 text-sm font-medium">Version {currentVersion}</p>
            <p className="mt-1 text-xs text-muted-foreground">{flow.updatedAt}</p>
          </div>
        </div>

        <section className="mt-7">
          <h3 className="text-sm font-medium">Changed fields</h3>
          {changes.length > 0 ? (
            <div className="mt-3 divide-y divide-border rounded-lg border border-border">
              {changes.map((change) => (
                <div key={change.label} className="p-3">
                  <p className="text-xs font-medium text-muted-foreground">{change.label}</p>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">v{version.version}</p><p className="mt-1 whitespace-pre-wrap leading-5">{change.previous}</p></div>
                    <div><p className="text-xs text-muted-foreground">v{currentVersion}</p><p className="mt-1 whitespace-pre-wrap font-medium leading-5">{change.current}</p></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No definition changes were detected.</p>
          )}
        </section>
      </div>
      <div className="shrink-0 border-t border-border p-4">
        <Dialog>
          <DialogTrigger asChild><Button className="w-full">Restore v{version.version} as new version</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore Flow version {version.version}?</DialogTitle>
              <DialogDescription>This creates version {currentVersion + 1} from version {version.version}. Existing versions and Run history remain unchanged.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={onRollback}>Restore as version {currentVersion + 1}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </aside>
  )
}

function AddScheduleDialog({
  flow,
  onAdd,
  onCreateWithAgent,
}: {
  flow: Flow
  onAdd: (input: ManualScheduleInput) => void
  onCreateWithAgent: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [frequency, setFrequency] = React.useState("weekdays")
  const [time, setTime] = React.useState("09:00")

  const submit = () => {
    const scheduleByFrequency = {
      weekdays: { frequencyLabel: `Weekdays, ${time}`, nextRunAt: `7 Oct 2026, ${time}` },
      weekly: { frequencyLabel: `Every Monday, ${time}`, nextRunAt: `12 Oct 2026, ${time}` },
      monthly: { frequencyLabel: `Last business day, ${time}`, nextRunAt: `30 Oct 2026, ${time}` },
    }
    onAdd(scheduleByFrequency[frequency as keyof typeof scheduleByFrequency])
    setOpen(false)
  }

  const createWithAgent = () => {
    setOpen(false)
    onCreateWithAgent()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm"><Plus aria-hidden="true" />Add</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add schedule</DialogTitle>
          <DialogDescription>Choose when {flow.name} should start a new Run.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label htmlFor={`schedule-frequency-${flow.id}`} className="text-sm font-medium">Frequency</label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger id={`schedule-frequency-${flow.id}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekdays">Every weekday</SelectItem>
                <SelectItem value="weekly">Every Monday</SelectItem>
                <SelectItem value="monthly">Last business day of the month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor={`schedule-time-${flow.id}`} className="text-sm font-medium">Start time</label>
            <Input id={`schedule-time-${flow.id}`} type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            <p className="text-xs text-muted-foreground">Uses the Investment Operations workspace time zone.</p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button variant="outline" onClick={createWithAgent}><Sparkles aria-hidden="true" />Create with Agent</Button>
          <Button onClick={submit} disabled={!time}>Add schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SimpleList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {items.map((item) => (
        <li key={item} className="flex gap-2 leading-5">
          <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function ToolkitPage({
  state,
  selectedConnection,
  onNavigate,
  onSavePermissions,
}: {
  state: DemoState
  selectedConnection?: ToolkitConnection
  onNavigate: Navigate
  onSavePermissions: (connection: ToolkitConnection, permissions: ToolkitPermission[]) => void
}) {
  return (
    <div className="flex h-full min-h-0">
      <div className={cn("min-w-0 flex-1 overflow-y-auto px-8 py-7", selectedConnection && "hidden lg:block")}>
        <div className="mx-auto max-w-5xl">
          <PageHeader title="Toolkit" description="Connections, permissions, and changes governing what Enable can use." />
          <div className="mt-7 divide-y divide-border rounded-xl border border-border">
            {state.toolkit.map((connection) => (
              <button
                type="button"
                key={connection.id}
                aria-pressed={selectedConnection?.id === connection.id}
                onClick={() => onNavigate(`/toolkit?selected=${connection.id}`)}
                className={cn(
                  "flex w-full items-center gap-5 px-5 py-4 text-left transition-colors hover:bg-muted/20",
                  selectedConnection?.id === connection.id && "bg-accent",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30"><WrenchIcon name={connection.id} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{connection.name}</span><span className="mt-0.5 block text-sm text-muted-foreground">{connection.description}</span></span>
                <span className="w-56"><span className="block text-xs text-muted-foreground">Scope</span><span className="mt-0.5 block truncate text-sm">{connection.scope}</span></span>
                <span className="w-40"><span className="block text-xs text-muted-foreground">Last used</span><span className="mt-0.5 block text-sm">{connection.lastUsed}</span></span>
                <StatusBadge status={connection.status === "connected" ? "success" : connection.status === "error" ? "warning-high" : "warning-medium"}>{connection.status === "connected" ? "Connected" : connection.status === "error" ? "Error" : "Permission required"}</StatusBadge>
              </button>
            ))}
          </div>
        </div>
      </div>
      {selectedConnection ? (
        <ToolkitInspectorPanel
          connection={selectedConnection}
          onClose={() => onNavigate("/toolkit")}
          onSave={(permissions) => onSavePermissions(selectedConnection, permissions)}
        />
      ) : null}
    </div>
  )
}

function ToolkitInspectorPanel({
  connection,
  onClose,
  onSave,
}: {
  connection: ToolkitConnection
  onClose: () => void
  onSave: (permissions: ToolkitPermission[]) => void
}) {
  const [draft, setDraft] = React.useState<ToolkitPermission[]>(connection.permissions ?? [])
  const original = connection.permissions ?? []
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(original)

  React.useEffect(() => {
    setDraft(connection.permissions ?? [])
  }, [connection.id, connection.permissions])

  const updatePermission = (permissionId: string, level: ToolkitPermission["level"]) => {
    setDraft((current) => current.map((permission) => permission.id === permissionId ? { ...permission, level } : permission))
  }

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-border bg-background lg:w-96">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{connection.name}</p>
          <p className="truncate text-xs text-muted-foreground">Permission controls</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close Toolkit inspector"><X /></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={connection.status === "connected" ? "success" : connection.status === "error" ? "warning-high" : "warning-medium"}>{connection.status === "connected" ? "Connected" : connection.status === "error" ? "Error" : "Permission required"}</StatusBadge>
          <span className="max-w-48 truncate text-xs text-muted-foreground">{connection.scope}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-secondary-foreground">{connection.description}</p>

        <section className="mt-7">
          <h3 className="text-sm font-medium">Permissions</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Choose the maximum action Enable can take with this connection.</p>
          <div className="mt-3 space-y-4">
            {draft.map((permission) => (
              <div key={permission.id} className="space-y-2 rounded-lg border border-border p-3">
                <div>
                  <label htmlFor={`permission-${connection.id}-${permission.id}`} className="text-sm font-medium">{permission.label}</label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{permission.description}</p>
                </div>
                <Select value={permission.level} onValueChange={(value) => updatePermission(permission.id, value as ToolkitPermission["level"])}>
                  <SelectTrigger id={`permission-${connection.id}-${permission.id}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No access</SelectItem>
                    <SelectItem value="read">Read only</SelectItem>
                    <SelectItem value="use">Use in Runs</SelectItem>
                    <SelectItem value="approve">Approval required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Change audit</h3>
            <span className="text-xs text-muted-foreground">{connection.audit?.length ?? 0} {(connection.audit?.length ?? 0) === 1 ? "event" : "events"}</span>
          </div>
          <div className="mt-4 space-y-4">
            {(connection.audit ?? []).map((event) => (
              <div key={event.id} className="border-l border-border pl-3">
                <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{event.action}</p><span className="shrink-0 text-xs text-muted-foreground">{event.at}</span></div>
                <p className="mt-1 text-sm leading-5 text-secondary-foreground">{event.detail}</p>
                <p className="mt-1 text-xs text-muted-foreground">{event.actor}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="shrink-0 border-t border-border p-4">
        <Button className="w-full" disabled={!hasChanges} onClick={() => onSave(draft)}>Save permission changes</Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Every saved change is recorded in the audit.</p>
      </div>
    </aside>
  )
}

function WrenchIcon({ name }: { name: string }) {
  if (name === "outlook" || name === "email-delivery") return <Mail className="size-4" aria-hidden="true" />
  if (name === "excel") return <FileSpreadsheet className="size-4" aria-hidden="true" />
  return <FileText className="size-4" aria-hidden="true" />
}

export function InsightsPage() {
  const metrics = [
    ["Runs completed", "124", "This month"],
    ["Automation completion rate", "92%", "Without manual recovery"],
    ["Human intervention rate", "14%", "Decision or approval requested"],
    ["Average processing time", "18 min", "From creation to completion"],
    ["Uploads avoided", "68", "Retrieved from authorized sources"],
    ["Estimated time saved", "31 h", "Compared with the manual process"],
  ]
  return (
    <div className="h-full overflow-y-auto px-8 py-7">
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Insights" description="Operational outcomes from Enable in October 2026." />
        <div className="mt-8 grid grid-cols-3 gap-4">
          {metrics.map(([label, value, note]) => (
            <section key={label} className="rounded-xl border border-border p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
              <p className="mt-2 text-xs text-muted-foreground">{note}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

export function NotFoundPage({ onNavigate }: { onNavigate: Navigate }) {
  return <div className="flex h-full items-center justify-center"><div className="text-center"><h1 className="text-xl font-medium">Page not found</h1><Button className="mt-4" onClick={() => onNavigate("/requests/new")}>Return to New Request</Button></div></div>
}
