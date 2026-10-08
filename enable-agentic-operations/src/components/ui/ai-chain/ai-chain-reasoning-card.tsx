"use client"

import * as React from "react"
import { useControllableState } from "@radix-ui/react-use-controllable-state"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

import { useCollapseOnSuccess } from "./use-collapse-on-success"

// runtime 无关（DEC-035）：可独立于 AiChain 使用。
// 内容窗口的 min-h/max-h + 内部裁切是设计稿明确标注的组件自身规格（104px/256px），
// 不属于对聊天视口滚动容器的假设。

export interface AiChainReasoningCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** 默认 "running"；running = brand icon + 稳定标题，success = 置灰静止 */
  status?: "running" | "success"
  icon?: React.ReactNode
  title?: React.ReactNode
  /** 完成后可选一行总结；status="success" 且折叠时显示在标题右侧（弱化色） */
  summary?: React.ReactNode
  /** 展开，受控；非受控默认 true；点击 header 折叠收起 */
  expanded?: boolean
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  /** status 变为 "success" 时自动折叠，默认 false（完成后是否保持展开由业务决定） */
  collapseOnSuccess?: boolean
  /** children = 推理过程内容（业务渲染，流式追加；窗口顶部对齐 + 底部渐隐） */
}

function ReasoningTitle({
  status,
  title,
}: {
  status: "running" | "success"
  title: React.ReactNode
}) {
  if (React.Children.toArray(title).length === 0) return null
  return (
    <span
      className={cn(
        "min-w-0 truncate text-sm font-medium",
        status === "running" ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {title}
    </span>
  )
}

function ReasoningHeader({
  status,
  icon,
  title,
  summary,
  expanded,
  interactive,
}: {
  status: "running" | "success"
  icon: React.ReactNode
  title: React.ReactNode
  summary: React.ReactNode
  expanded: boolean
  interactive: boolean
}) {
  const showSummary =
    React.Children.toArray(summary).length > 0 &&
    status === "success" &&
    !expanded

  return (
    <>
      <span
        aria-hidden="true"
        className="relative inline-flex size-4 shrink-0 items-center justify-center [&_svg]:size-4 [&_svg]:shrink-0"
      >
        <span
          className={cn(
            "inline-flex size-4 items-center justify-center",
            status === "running"
              ? "text-brand-foreground/45 motion-reduce:text-brand-foreground"
              : "text-muted-foreground",
          )}
        >
          {icon}
        </span>
        {status === "running" && (
          <span className="shimmer-mask pointer-events-none absolute inset-0 inline-flex size-4 items-center justify-center text-brand-foreground">
            {icon}
          </span>
        )}
      </span>
      <ReasoningTitle status={status} title={title} />
      {showSummary && (
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {summary}
        </span>
      )}
      {/* hover 淡入折叠/展开箭头；无内容时不出箭头，避免暗示可展开 */}
      {interactive && (
        <ChevronDown
          strokeWidth={1.75}
          aria-hidden="true"
          className={cn(
            "ml-auto size-4 shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] duration-200 ease-toggle group-focus-visible/reasoning:opacity-100 pointer-fine:group-hover/reasoning:opacity-100 motion-reduce:transition-none",
            expanded && "rotate-180",
          )}
        />
      )}
    </>
  )
}

/** 内容窗口：min 104 / max 256（标准刻度 24/64），内容顶部对齐 + 底部渐隐。 */
function ReasoningContent({
  id,
  expanded,
  children,
}: {
  id: string
  expanded: boolean
  children: React.ReactNode
}) {
  return (
    <div
      id={id}
      className={cn(
        "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="overflow-hidden">
        <div className="relative -mx-px -mb-px max-h-64 min-h-24 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex max-h-64 min-h-24 flex-col overflow-hidden px-5 py-4">
            <div className="min-w-0 text-sm leading-6 text-secondary-foreground">
              {children}
            </div>
          </div>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent"
          />
        </div>
      </div>
    </div>
  )
}

/**
 * 推理单元卡：显示「任务目标 → 推理过程 → 输出结果」的路径。
 * 内容窗口约 104px~256px（设计稿标注），内容从顶部开始排列，
 * 超出窗口后裁切并用底部渐隐提示后续内容。
 */
const AiChainReasoningCard = React.forwardRef<
  HTMLDivElement,
  AiChainReasoningCardProps
>(
  (
    {
      className,
      status = "running",
      icon,
      title,
      summary,
      expanded: expandedProp,
      defaultExpanded,
      onExpandedChange,
      collapseOnSuccess = false,
      children,
      ...props
    },
    ref,
  ) => {
    const contentId = React.useId()

    const [expanded = true, setExpanded] = useControllableState<boolean>({
      prop: expandedProp,
      defaultProp: defaultExpanded ?? true,
      onChange: onExpandedChange,
    })
    useCollapseOnSuccess(
      status,
      collapseOnSuccess && expandedProp === undefined,
      () => setExpanded(false),
    )

    // DEC-039：过滤 null/false/undefined，避免空 children 渲染出空内容窗口（min-h 占位）。
    const hasContent = React.Children.toArray(children).length > 0
    const header = (
      <ReasoningHeader
        status={status}
        icon={icon}
        title={title}
        summary={summary}
        expanded={expanded}
        interactive={hasContent}
      />
    )

    return (
      <div
        ref={ref}
        data-status={status}
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-muted/50 shadow-sm",
          className,
        )}
        {...props}
      >
        {hasContent ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "group/reasoning flex h-9 w-full items-center gap-3 px-4 text-left",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            )}
          >
            {header}
          </button>
        ) : (
          // 无内容：纯展示，不做成可点按钮，避免 aria-expanded 与实际不符。
          <div className="flex h-9 w-full items-center gap-3 px-4">
            {header}
          </div>
        )}
        {hasContent && (
          <ReasoningContent id={contentId} expanded={expanded}>
            {children}
          </ReasoningContent>
        )}
      </div>
    )
  },
)
AiChainReasoningCard.displayName = "AiChainReasoningCard"

export { AiChainReasoningCard }
