import * as React from "react"
import { cva } from "class-variance-authority"
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  LoaderCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"

export type StatusBadgeStatus =
  | "unknown"
  | "success"
  | "normal"
  | "warning-high"
  | "warning-medium"
  | "warning-low"

export type StatusBadgeIconVariant = "glyph" | "dot" | "none"

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 状态色档位，默认 "unknown" */
  status?: StatusBadgeStatus
  /** 图标形态，默认 "glyph"；"dot" / "none" 时忽略 icon */
  iconVariant?: StatusBadgeIconVariant
  /** 覆盖默认字形图标；仅 iconVariant="glyph" 生效 */
  icon?: React.ReactNode
  /** children = 状态文案（业务传入，组件无默认文案） */
}

/**
 * 状态 pill。图标用 size-3（12px）对齐 Flex Card 设计稿，
 * 与当前组件规格保持一致。
 *
 * 状态 → 组件内 foreground / background / border 三层 semantic token 配色。
 * Dark 仅在 background / border 上加透明度；文字色不写 dark:。
 */
const statusBadgeVariants = cva(
  "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-xl border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        unknown:
          "text-unknown-foreground bg-unknown-background border-unknown dark:bg-unknown-background/[0.07] dark:border-unknown/20",
        success:
          "text-success-foreground bg-success-background border-success dark:bg-success-background/[0.07] dark:border-success/20",
        normal:
          "text-normal-foreground bg-normal-background border-normal dark:bg-normal-background/[0.07] dark:border-normal/20",
        "warning-high":
          "text-warning-high-foreground bg-warning-high-background border-warning-high dark:bg-warning-high-background/[0.07] dark:border-warning-high/20",
        "warning-medium":
          "text-warning-medium-foreground bg-warning-medium-background border-warning-medium dark:bg-warning-medium-background/[0.07] dark:border-warning-medium/20",
        "warning-low":
          "text-warning-low-foreground bg-warning-low-background border-warning-low dark:bg-warning-low-background/[0.07] dark:border-warning-low/20",
      },
    },
    defaultVariants: { status: "unknown" },
  },
)

/**
 * 默认 lucide 映射。
 * warning-medium / warning-low 取 CircleAlert（非 CircleX）：
 * 设计稿 Light 画 CircleX、Dark 画 CircleAlert，取告警语义留给中低危；
 * CircleX「不可用/失败」留给 warning-high。须回流设计师确认。
 */
const defaultIcons: Record<StatusBadgeStatus, React.ReactNode> = {
  unknown: <CircleDashed className="size-3 shrink-0" aria-hidden="true" />,
  success: <CircleCheck className="size-3 shrink-0" aria-hidden="true" />,
  normal: (
    <LoaderCircle
      className="size-3 shrink-0 animate-spin motion-reduce:animate-none"
      aria-hidden="true"
    />
  ),
  "warning-high": <CircleX className="size-3 shrink-0" aria-hidden="true" />,
  "warning-medium": (
    <CircleAlert className="size-3 shrink-0" aria-hidden="true" />
  ),
  "warning-low": <CircleAlert className="size-3 shrink-0" aria-hidden="true" />,
}

const StatusBadge = React.forwardRef<
  React.ElementRef<"span">,
  StatusBadgeProps
>(
  (
    {
      className,
      status = "unknown",
      iconVariant = "glyph",
      icon,
      children,
      ...props
    },
    ref,
  ) => {
    let iconNode: React.ReactNode = null
    if (iconVariant === "glyph") {
      iconNode = icon ?? defaultIcons[status]
    } else if (iconVariant === "dot") {
      // bg-current 继承 text-{status}-foreground，六状态零额外分支
      iconNode = (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current"
          aria-hidden="true"
        />
      )
    }

    return (
      <span
        ref={ref}
        data-status={status}
        className={cn(statusBadgeVariants({ status }), className)}
        {...props}
      >
        {iconNode}
        {children}
      </span>
    )
  },
)
StatusBadge.displayName = "StatusBadge"

export { StatusBadge }
