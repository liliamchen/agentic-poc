"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { SquareTerminal } from "lucide-react"

import { cn } from "@/lib/utils"

// runtime 无关（DEC-035）：纯展示组件，可独立于 AiChain 使用。

export type AiChainTaskBarStatus = "running" | "success" | "paused" | "error"

const taskBarVariants = cva(
  "flex h-9 items-center gap-3 rounded-lg border px-4 text-sm font-medium",
  {
    variants: {
      status: {
        running: "border-border bg-background text-foreground",
        success: "border-border bg-background text-foreground",
        paused: "border-border bg-background text-foreground",
        error:
          "border-warning-high bg-warning-high-background text-foreground dark:border-warning-high/20 dark:bg-warning-high-background/[0.07]",
      },
    },
    defaultVariants: { status: "running" },
  },
)

const taskBarIconVariants = cva(
  "inline-flex size-4 shrink-0 items-center justify-center [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      status: {
        running: "text-brand-foreground",
        success: "text-muted-foreground",
        paused: "text-muted-foreground",
        error: "text-warning-high-foreground",
      },
    },
    defaultVariants: { status: "running" },
  },
)

export interface AiChainTaskBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 状态，默认 "running"；paused/error 换 warning/destructive 色调 */
  status?: AiChainTaskBarStatus
  /** 左侧图标，默认 lucide SquareTerminal */
  icon?: React.ReactNode
  /** children = 文案（如「正在统计收入」） */
}

/** 终端风格执行条：圆角边框条 + 左 icon + 文案，纯展示、无交互。 */
const AiChainTaskBar = React.forwardRef<HTMLDivElement, AiChainTaskBarProps>(
  ({ className, status = "running", icon, children, ...props }, ref) => (
    <div
      ref={ref}
      data-status={status}
      className={cn(taskBarVariants({ status }), className)}
      {...props}
    >
      <span aria-hidden="true" className={taskBarIconVariants({ status })}>
        {icon ?? <SquareTerminal strokeWidth={1.75} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  ),
)
AiChainTaskBar.displayName = "AiChainTaskBar"

export { AiChainTaskBar }
