import * as React from "react"
import {
  Activity,
  Archive,
  BarChart3,
  ChevronDown,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  RefreshCcw,
  Shapes,
  Trash2,
  Wrench,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import type { DemoState, RequestRecord } from "@/model"
import { cn } from "@/lib/utils"

type AppShellProps = {
  children: React.ReactNode
  path: string
  state: DemoState
  onNavigate: (path: string) => void
  onReset: () => void
  onToggleRequestPin: (requestId: string) => void
  onRenameRequest: (requestId: string, title: string) => void
  onArchiveRequest: (requestId: string) => void
  onDeleteRequest: (requestId: string) => void
}

const navItems = [
  { label: "Runs", href: "/runs", icon: Activity },
  { label: "Flows", href: "/flows", icon: Shapes },
  { label: "Toolkit", href: "/toolkit", icon: Wrench },
  { label: "Insights", href: "/insights", icon: BarChart3 },
]

type RequestIndicator = "running" | "needs_action" | undefined

function getRequestIndicator(request: RequestRecord, state: DemoState): RequestIndicator {
  const relatedWork = state.workItems.filter((item) => request.workItemIds.includes(item.id) || item.requestId === request.id)
  const running = request.agentStage === "thinking"
    || request.flowCreationStage === "creating"
    || request.scheduleCreationStage === "creating"
    || request.fileRecoveryStage === "searching"
    || request.revisionStage === "thinking"
    || relatedWork.some((item) => item.status === "queued" || item.status === "working" || item.status === "delivering")

  // Active agent work takes precedence over the next human checkpoint. Once the
  // agent stops, the same request can switch to the needs-action indicator.
  if (running) return "running"

  const needsAction = request.agentStage === "awaiting_approval"
    || request.dataConfirmationStage === "required"
    || request.fileRecoveryStage === "required"
    || request.flowCreationStage === "form"
    || request.flowCreationStage === "preview"
    || request.scheduleCreationStage === "form"
    || request.scheduleCreationStage === "preview"
    || relatedWork.some((item) => item.status === "pending" || item.status === "needs_attention" || item.status === "ready_for_approval" || item.status === "failed")

  if (needsAction) return "needs_action"
  return undefined
}

export function AppShell({ children, path, state, onNavigate, onReset, onToggleRequestPin, onRenameRequest, onArchiveRequest, onDeleteRequest }: AppShellProps) {
  const pinnedRequests = React.useMemo(() => state.requests.filter((request) => request.pinned && !request.archived), [state.requests])
  const recentRequests = React.useMemo(() => state.requests.filter((request) => !request.pinned && !request.archived).slice(0, 5), [state.requests])
  const attentionCount = React.useMemo(() => {
    return state.workItems.filter((item) => (
      item.status === "pending"
      || item.status === "needs_attention"
      || item.status === "ready_for_approval"
      || item.status === "failed"
    )).length
  }, [state.workItems])

  return (
    <div className="flex h-dvh overflow-hidden bg-muted/30 text-foreground">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-muted/30">
        <div className="shrink-0 p-3">
          <button
            type="button"
            onClick={() => onNavigate("/requests/new")}
            className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-sm font-semibold">Enable</span>
          </button>
        </div>

        <div className="shrink-0 px-3 pb-3">
          <Button variant="outline" className="w-full justify-start" onClick={() => onNavigate("/requests/new")}>
            <Plus aria-hidden="true" />
            New Request
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <nav aria-label="Primary" className="space-y-1">
            {navItems.map((item) => {
              const active = item.href === "/runs"
                ? path.startsWith("/runs") || path.startsWith("/work")
                : path.startsWith(item.href)
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => onNavigate(item.href)}
                  className={cn(
                    "flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition-colors",
                    active ? "bg-border/70 font-medium text-foreground" : "text-foreground hover:bg-accent/60",
                  )}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.href === "/runs" && attentionCount > 0 ? (
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground" aria-label={`${attentionCount} runs need attention`}>
                      {attentionCount}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>

          {pinnedRequests.length > 0 ? (
            <SidebarSection label="Pinned Requests" className="mt-5">
              {pinnedRequests.map((request) => (
                <RequestSidebarItem
                  key={request.id}
                  request={request}
                  active={path === `/requests/${request.id}`}
                  onNavigate={onNavigate}
                  onTogglePin={onToggleRequestPin}
                  onRename={onRenameRequest}
                  onArchive={onArchiveRequest}
                  onDelete={onDeleteRequest}
                  indicator={getRequestIndicator(request, state)}
                />
              ))}
            </SidebarSection>
          ) : null}

          <SidebarSection label="Recent Requests" className="mt-5">
            {recentRequests.map((request) => (
              <RequestSidebarItem
                key={request.id}
                request={request}
                active={path === `/requests/${request.id}`}
                onNavigate={onNavigate}
                onTogglePin={onToggleRequestPin}
                onRename={onRenameRequest}
                onArchive={onArchiveRequest}
                onDelete={onDeleteRequest}
                indicator={getRequestIndicator(request, state)}
              />
            ))}
          </SidebarSection>

        <div className="mt-5 border-t border-border pt-3">
          <Button variant="ghost" size="sm" className="mb-1 w-full justify-start text-foreground" onClick={onReset}>
            <RefreshCcw aria-hidden="true" />
            Reset demo
          </Button>
        </div>
        </div>

        <div className="shrink-0 border-t border-border px-3 py-2">
          <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-accent" aria-label="Signed in as Erin Chen">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">EC</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">Erin Chen</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
        {children}
      </main>
    </div>
  )
}

function RequestSidebarItem({
  request,
  active,
  onNavigate,
  onTogglePin,
  onRename,
  onArchive,
  onDelete,
  indicator,
}: {
  request: RequestRecord
  active: boolean
  onNavigate: (path: string) => void
  onTogglePin: (requestId: string) => void
  onRename: (requestId: string, title: string) => void
  onArchive: (requestId: string) => void
  onDelete: (requestId: string) => void
  indicator: RequestIndicator
}) {
  const [renameOpen, setRenameOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [draftTitle, setDraftTitle] = React.useState(request.title)
  const openRequest = () => onNavigate(`/requests/${request.id}`)
  const leaveActiveRequest = () => {
    if (active) onNavigate("/requests/new")
  }

  return (
    <>
      <div className={cn("group relative rounded-md hover:bg-accent/60", active && "bg-border/70 font-medium text-foreground")}>
        <button type="button" onClick={openRequest} className="w-full truncate rounded-md px-3 py-2 pr-16 text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {request.title}
        </button>
        {indicator ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
            {indicator === "needs_action" ? (
              <span className="size-2 rounded-full bg-brand" aria-label="Needs your attention" />
            ) : (
              <LoaderCircle className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Agent is working" />
            )}
          </span>
        ) : null}
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5 bg-inherit opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`More actions for ${request.title}`}>
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => { setDraftTitle(request.title); setRenameOpen(true) }}><Pencil />Rename</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { onArchive(request.id); leaveActiveRequest() }}><Archive />Archive</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteOpen(true)}><Trash2 />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={request.pinned ? `Unpin ${request.title}` : `Pin ${request.title}`}
            onClick={() => onTogglePin(request.id)}
          >
            <Pin className={cn("size-3.5", request.pinned && "fill-current")} aria-hidden="true" />
          </button>
        </div>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(event) => {
            event.preventDefault()
            const nextTitle = draftTitle.trim()
            if (!nextTitle) return
            onRename(request.id, nextTitle)
            setRenameOpen(false)
          }}>
            <DialogHeader>
              <DialogTitle>Rename request</DialogTitle>
              <DialogDescription>Use a short name that makes this conversation easy to find.</DialogDescription>
            </DialogHeader>
            <Input className="mt-5" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} autoFocus aria-label="Request name" />
            <DialogFooter className="mt-6">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={!draftTitle.trim()}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete request?</DialogTitle>
            <DialogDescription>This removes the conversation from Requests. Related runs, reports, and audit records will remain.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="button" variant="destructive" onClick={() => { onDelete(request.id); setDeleteOpen(false); leaveActiveRequest() }}>Delete request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SidebarSection({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={className}>
      <div className="flex h-8 items-center px-3 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="space-y-0.5">{children}</div>
    </section>
  )
}
