"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

export type MessageBarStatus =
  "normal" | "warning-low" | "warning-medium" | "warning-high"

export interface MessageBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 风险档位，默认 "normal" */
  status?: MessageBarStatus
  /**
   * 渐变底，默认 true；false 为纯色。
   * 品牌若把 `*-background` 注册为渐变 token，`from-*-background/40` 类不会生成
   * （渐变 token 不在 theme.colors 里），此时传 `gradient={false}` 走纯色退路。
   */
  gradient?: boolean
}

export type MessageBarTitleProps = React.HTMLAttributes<HTMLParagraphElement>
export type MessageBarBodyProps = React.HTMLAttributes<HTMLDivElement>
export type MessageBarActionsProps = React.HTMLAttributes<HTMLDivElement>

export interface MessageBarActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

type MessageBarContextValue = {
  status: MessageBarStatus
}

const MessageBarContext = React.createContext<MessageBarContextValue | null>(
  null,
)

function useMessageBar() {
  const context = React.useContext(MessageBarContext)
  if (!context) {
    throw new Error("MessageBar* must be used within MessageBar")
  }
  return context
}

const messageBarVariants = cva(
  "flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3",
  {
    variants: {
      status: {
        normal: "border-normal dark:border-normal/20",
        "warning-low": "border-warning-low dark:border-warning-low/20",
        "warning-medium": "border-warning-medium dark:border-warning-medium/20",
        "warning-high": "border-warning-high dark:border-warning-high/20",
      },
    },
    defaultVariants: { status: "normal" },
  },
)

/**
 * 渐变：from-{s}-background/40 → to-{s}-background（对齐设计稿 normal 规格）。
 * 暗色二次乘 7%：40%×7%≈2.8% → /[0.028]，终点 /[0.07]。
 * 若暗色渐变观感几乎不可见，可退化为纯色（低对比渐变无信息量）。
 *
 * 渐变与纯色是两个 cva 而不是一个 cva 的 compoundVariants：prefix 转换只改 variants
 * 下的字符串，compoundVariants 里的会被静默跳过。
 */
const messageBarGradientVariants = cva("", {
  variants: {
    status: {
      normal:
        "bg-gradient-to-r from-normal-background/40 to-normal-background dark:from-normal-background/[0.028] dark:to-normal-background/[0.07]",
      "warning-low":
        "bg-gradient-to-r from-warning-low-background/40 to-warning-low-background dark:from-warning-low-background/[0.028] dark:to-warning-low-background/[0.07]",
      "warning-medium":
        "bg-gradient-to-r from-warning-medium-background/40 to-warning-medium-background dark:from-warning-medium-background/[0.028] dark:to-warning-medium-background/[0.07]",
      "warning-high":
        "bg-gradient-to-r from-warning-high-background/40 to-warning-high-background dark:from-warning-high-background/[0.028] dark:to-warning-high-background/[0.07]",
    },
  },
  defaultVariants: { status: "normal" },
})

const messageBarSolidVariants = cva("", {
  variants: {
    status: {
      normal: "bg-normal-background dark:bg-normal-background/[0.07]",
      "warning-low":
        "bg-warning-low-background dark:bg-warning-low-background/[0.07]",
      "warning-medium":
        "bg-warning-medium-background dark:bg-warning-medium-background/[0.07]",
      "warning-high":
        "bg-warning-high-background dark:bg-warning-high-background/[0.07]",
    },
  },
  defaultVariants: { status: "normal" },
})

/**
 * 小标题：w-full 独占一行，正文换到下一行承接。
 * 不像正文那样降到 90%，否则两行分不出主次。
 */
const messageBarTitleVariants = cva("w-full text-xs font-medium", {
  variants: {
    status: {
      normal: "text-normal-foreground",
      "warning-low": "text-warning-low-foreground",
      "warning-medium": "text-warning-medium-foreground",
      "warning-high": "text-warning-high-foreground",
    },
  },
  defaultVariants: { status: "normal" },
})

/** 正文：承担 90% 不透明度与 flex-1，勿把裸文本直接塞进 MessageBar。 */
const messageBarBodyVariants = cva("min-w-0 flex-1 text-xs", {
  variants: {
    status: {
      normal: "text-normal-foreground/90",
      "warning-low": "text-warning-low-foreground/90",
      "warning-medium": "text-warning-medium-foreground/90",
      "warning-high": "text-warning-high-foreground/90",
    },
  },
  defaultVariants: { status: "normal" },
})

/** 行动区：右对齐；窄屏整行换行，不与正文互相挤压。 */
const messageBarActionsVariants = cva(
  "ml-auto flex shrink-0 items-center gap-4",
)

const messageBarActionVariants = cva(
  "inline-flex items-center gap-0.5 text-xs font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  {
    variants: {
      status: {
        normal: "text-normal-foreground",
        "warning-low": "text-warning-low-foreground",
        "warning-medium": "text-warning-medium-foreground",
        "warning-high": "text-warning-high-foreground",
      },
    },
    defaultVariants: { status: "normal" },
  },
)

const MessageBar = React.forwardRef<React.ElementRef<"div">, MessageBarProps>(
  (
    { className, status = "normal", gradient = true, children, ...props },
    ref,
  ) => (
    <MessageBarContext.Provider value={{ status }}>
      <div
        ref={ref}
        data-status={status}
        className={cn(
          messageBarVariants({ status }),
          gradient
            ? messageBarGradientVariants({ status })
            : messageBarSolidVariants({ status }),
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </MessageBarContext.Provider>
  ),
)
MessageBar.displayName = "MessageBar"

const MessageBarTitle = React.forwardRef<
  React.ElementRef<"p">,
  MessageBarTitleProps
>(({ className, ...props }, ref) => {
  const { status } = useMessageBar()
  return (
    <p
      ref={ref}
      className={cn(messageBarTitleVariants({ status }), className)}
      {...props}
    />
  )
})
MessageBarTitle.displayName = "MessageBarTitle"

const MessageBarBody = React.forwardRef<
  React.ElementRef<"div">,
  MessageBarBodyProps
>(({ className, ...props }, ref) => {
  const { status } = useMessageBar()
  return (
    <div
      ref={ref}
      className={cn(messageBarBodyVariants({ status }), className)}
      {...props}
    />
  )
})
MessageBarBody.displayName = "MessageBarBody"

const MessageBarActions = React.forwardRef<
  React.ElementRef<"div">,
  MessageBarActionsProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(messageBarActionsVariants(), className)}
    {...props}
  />
))
MessageBarActions.displayName = "MessageBarActions"

/**
 * 行动链接：文字 + 内置 ArrowUpRight。
 * asChild 时把图标并进子元素 children（Slot 只接受单一子节点）。
 */
const MessageBarAction = React.forwardRef<
  React.ElementRef<"button">,
  MessageBarActionProps
>(({ className, asChild = false, children, ...props }, ref) => {
  const { status } = useMessageBar()
  const icon = <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
  const mergedClassName = cn(messageBarActionVariants({ status }), className)

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ children?: React.ReactNode }>
    // cloneElement 只补图标；className 交给 Slot 合并一次即可。
    // 若在此再 cn() 一遍，子元素上会同时留下两份样式类，
    // Slot 的合并是字符串拼接（非 tailwind-merge），冲突类不会被消解。
    return (
      <Slot ref={ref} className={mergedClassName} {...props}>
        {React.cloneElement(child, {
          children: (
            <>
              {child.props.children}
              {icon}
            </>
          ),
        })}
      </Slot>
    )
  }

  return (
    <button ref={ref} type="button" className={mergedClassName} {...props}>
      {children}
      {icon}
    </button>
  )
})
MessageBarAction.displayName = "MessageBarAction"

export {
  MessageBar,
  MessageBarTitle,
  MessageBarBody,
  MessageBarActions,
  MessageBarAction,
}
