"use client"

import * as React from "react"
import { useControllableState } from "@radix-ui/react-use-controllable-state"
import { cva } from "class-variance-authority"
import { ArrowUp, Square } from "lucide-react"

import { cn } from "@/lib/utils"
import { SimpleTooltip } from "@/components/ui/simple-tooltip"

import { useCollapseMorph } from "./prompt-input-collapse"

// runtime 无关（DEC-035）：数据只从 props 进、动作只从事件回调出，
// 不依赖 AI runtime；status（idle/running）由业务传入，组件不订阅任何生成状态；
// 宽度自适应父容器（设计稿的 min(90vw, 640px) 是业务页面布局的事）。
// 输入区（AiPromptInputTextarea）为 contentEditable + segments 行内 pill 混排
// （DEC-038，无 pill 时行为等价原生 textarea）；附件卡片本体归 B2 ai-attachment，
// 本组件只提供 Attachments 空插槽容器。

/** 工具栏 tooltip 压成单行 24px，与图标按钮同高 */
const toolbarTooltipVariants = cva("flex h-6 items-center px-2 py-0 leading-5")

/** 发送钮尺寸：收起态对照 342:1029 的 28px 圆钮，order-2 让它落在输入区之后（Toolbar 已摊平） */
const submitSizeVariants = cva("", {
  variants: { collapsed: { true: "order-2 size-7", false: "size-8" } },
  defaultVariants: { collapsed: false },
})

/** 发送钮图标盒：收起态 14px，展开态 16px */
const submitIconSizeVariants = cva("", {
  variants: { collapsed: { true: "size-3.5", false: "size-4" } },
  defaultVariants: { collapsed: false },
})

export type AiPromptInputStatus = "idle" | "running"
export type AiPromptInputBorderEffect = "none" | "beam"

// Root 下发的 value 为字符串（segments 的纯文本镜像，pill 展示 label）；
// 完整 pill 结构（含 id/value）经 AiPromptInputTextarea 的 ref getSegments() 拿（DEC-038）。
type AiPromptInputContextValue = {
  value: string
  setValue: (value: string) => void
  status: AiPromptInputStatus
  disabled: boolean
  submit: () => void
  stop: () => void
  /** 单行收起态（DEC-104）：各部件据此切布局，非 collapsible 时恒为 false */
  collapsed: boolean
  /** 输入区把自己的宿主节点交给 Root，供收起态点击容器留白时取焦 */
  registerEditor: (node: HTMLElement | null) => void
}

const AiPromptInputContext =
  React.createContext<AiPromptInputContextValue | null>(null)

export function useAiPromptInputContext() {
  const context = React.useContext(AiPromptInputContext)
  if (!context) {
    throw new Error(
      "AiPromptInput components must be used within AiPromptInput",
    )
  }
  return context
}

export interface AiPromptInputProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onSubmit"
> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** 生成状态，默认 "idle"；running 时 Submit 变停止钮 */
  status?: AiPromptInputStatus
  /** Enter 或点击发送触发；组件保证非空（trim 后）才触发 */
  onSubmit?: (value: string) => void
  /** running 态点击停止钮触发 */
  onStop?: () => void
  /** 整体禁用（输入 + 按钮） */
  disabled?: boolean
  /** 聚焦描边效果，默认 "none"；"beam" 启用沿边框移动的 Brand 光束 */
  borderEffect?: AiPromptInputBorderEffect
  /**
   * 单行收起形态（DEC-104），默认 false。开启后未聚焦且内容为空时压成一行胶囊
   * （按钮 · 占位文案 · 发送钮），聚焦或有内容时形变回多行。
   */
  collapsible?: boolean
  /** 受控展开态，仅 `collapsible` 下有意义；内容非空时恒为展开 */
  expanded?: boolean
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

const AiPromptInput = React.forwardRef<HTMLDivElement, AiPromptInputProps>(
  (
    {
      className,
      value: valueProp,
      defaultValue,
      onValueChange,
      status = "idle",
      onSubmit,
      onStop,
      disabled = false,
      borderEffect = "none",
      collapsible = false,
      expanded,
      defaultExpanded,
      onExpandedChange,
      children,
      onFocus,
      onBlur,
      onMouseDown,
      ...props
    },
    ref,
  ) => {
    const [value = "", setValue] = useControllableState<string>({
      prop: valueProp,
      defaultProp: defaultValue ?? "",
      onChange: onValueChange,
    })
    const [isExpanded = false, setExpanded] = useControllableState<boolean>({
      prop: expanded,
      defaultProp: defaultExpanded ?? false,
      onChange: onExpandedChange,
    })

    // 有内容时不许收起（收起态放不下已输入的文本与 pill）。
    const collapsed = collapsible && !isExpanded && value.trim().length === 0

    const rootRef = React.useRef<HTMLDivElement | null>(null)
    const editorRef = React.useRef<HTMLElement | null>(null)
    const captureMorph = useCollapseMorph(rootRef)
    // FLIP 要自己的 Root 引用；转发给外部的那份走 useImperativeHandle，
    // 避免在 forwardRef 的 ref 参数上手动分派。
    React.useImperativeHandle(ref, () => rootRef.current as HTMLDivElement, [])

    const registerEditor = React.useCallback((node: HTMLElement | null) => {
      editorRef.current = node
    }, [])

    // 先量切换前的几何再改 state，layout effect 才补得出 FLIP（见 useCollapseMorph）。
    const requestExpanded = React.useCallback(
      (next: boolean) => {
        if (!collapsible || next === isExpanded) return
        captureMorph()
        setExpanded(next)
      },
      [collapsible, isExpanded, captureMorph, setExpanded],
    )

    const submit = React.useCallback(() => {
      // running 期间唯一的动作出口是停止钮（onStop），Enter 不触发发送。
      if (disabled || status === "running") return
      if (!value.trim()) return
      onSubmit?.(value)
    }, [disabled, status, value, onSubmit])

    const stop = React.useCallback(() => {
      onStop?.()
    }, [onStop])

    const contextValue = React.useMemo<AiPromptInputContextValue>(
      () => ({
        value,
        setValue,
        status,
        disabled,
        submit,
        stop,
        collapsed,
        registerEditor,
      }),
      [
        value,
        setValue,
        status,
        disabled,
        submit,
        stop,
        collapsed,
        registerEditor,
      ],
    )

    return (
      <AiPromptInputContext.Provider value={contextValue}>
        <div
          ref={rootRef}
          data-slot="ai-prompt-input"
          data-status={status}
          data-disabled={disabled ? "" : undefined}
          data-border-effect={borderEffect}
          data-collapsed={collapsed ? "" : undefined}
          onFocus={(event) => {
            onFocus?.(event)
            requestExpanded(true)
          }}
          onBlur={(event) => {
            onBlur?.(event)
            if (event.currentTarget.contains(event.relatedTarget)) return
            requestExpanded(false)
          }}
          onMouseDown={(event) => {
            onMouseDown?.(event)
            if (event.defaultPrevented) return
            // 收起态下容器留白也应取焦；命中子节点时交给它们自己处理。
            if (!collapsed || event.target !== event.currentTarget) return
            event.preventDefault()
            editorRef.current?.focus()
          }}
          className={cn(
            // 容器规格对照 composer-02：外层输入框明确采用 20px 圆角。
            // 默认描边走 border；普通档聚焦后加 2px brand-2 外环，beam 档由光束承担强化反馈。
            // 背景对照 DESIGN.md 背景色层级（Prompt box → bg-card）。
            "flex w-full border border-border bg-card focus-within:border-brand",
            collapsed
              ? // 单行态对照 342:1029：12px 内边距 + 28px 发送钮 = 52px 行高，圆角取其半成胶囊。
                // 不用 rounded-full：9999px → 20px 的插值在掉到半高以下之前看不出变化，收尾会「啪」一下。
                // eslint-disable-next-line @ali/cloudai-ui/no-arbitrary-radius-spacing -- 26px 圆角是 52px 行高的一半，随行高定，非刻度值。
                "flex-row items-center gap-1 rounded-[1.625rem] p-3 shadow-sm"
              : // eslint-disable-next-line @ali/cloudai-ui/no-arbitrary-radius-spacing -- 设计确认采用刻度外的精确 20px 圆角。
                "flex-col gap-2 rounded-[20px] p-4",
            // Active 态由 focus-within 驱动；边框、投影与圆角同步过渡。高度与子节点位移归
            // useCollapseMorph 的 FLIP；圆角进不了 FLIP（见 prompt-input-collapse.ts 的
            // !important 说明），padding / gap 则有意不过渡，免得与 FLIP 抢同一段位移。
            "transition-[border-color,box-shadow,border-radius] duration-150 ease-standard motion-reduce:transition-none",
            borderEffect === "beam"
              ? "motion-border-beam"
              : "focus-within:ring-2 focus-within:ring-brand-2",
            className,
          )}
          {...props}
        >
          {borderEffect === "beam" && (
            <span
              aria-hidden="true"
              data-slot="ai-prompt-input-border-beam"
              className="motion-border-beam-bloom"
            />
          )}
          {children}
        </div>
      </AiPromptInputContext.Provider>
    )
  },
)
AiPromptInput.displayName = "AiPromptInput"

// 附件/引用 chips 插槽行（布局壳）：卡片本体归 B2 ai-attachment。
// 无 children 时业务不渲染本组件即可，组件自身不做空态判断。
export type AiPromptInputAttachmentsProps = React.HTMLAttributes<HTMLDivElement>

const AiPromptInputAttachments = React.forwardRef<
  HTMLDivElement,
  AiPromptInputAttachmentsProps
>(({ className, ...props }, ref) => {
  const { collapsed } = useAiPromptInputContext()
  return (
    <div
      ref={ref}
      className={cn("flex flex-wrap gap-2", collapsed && "hidden", className)}
      {...props}
    />
  )
})
AiPromptInputAttachments.displayName = "AiPromptInputAttachments"

// 底部功能区容器：业务左放 ToolbarButton、右放 Submit（Submit 用 ml-auto 靠右）。
// 收起态改 display:contents 摊平成 Root 那一行的 flex 项，输入区靠 order 插到中间（DEC-104）。
export type AiPromptInputToolbarProps = React.HTMLAttributes<HTMLDivElement>

const AiPromptInputToolbar = React.forwardRef<
  HTMLDivElement,
  AiPromptInputToolbarProps
>(({ className, ...props }, ref) => {
  const { collapsed } = useAiPromptInputContext()
  return (
    <div
      ref={ref}
      data-slot="ai-prompt-input-toolbar"
      className={cn(
        collapsed ? "contents" : "flex items-center gap-1",
        className,
      )}
      {...props}
    />
  )
})
AiPromptInputToolbar.displayName = "AiPromptInputToolbar"

export interface AiPromptInputToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 开关型按钮的激活态（brand 色 + aria-pressed），默认 undefined（普通按钮） */
  active?: boolean
  /** 提供时内部包 SimpleTooltip */
  tooltip?: React.ReactNode
}

const AiPromptInputToolbarButton = React.forwardRef<
  HTMLButtonElement,
  AiPromptInputToolbarButtonProps
>(
  (
    { className, active, tooltip, disabled, "aria-label": ariaLabel, ...props },
    ref,
  ) => {
    const { disabled: rootDisabled } = useAiPromptInputContext()

    // 尺寸与三态对照 Figma 115:1234：28px 圆钮、16px 图标、6px 内边距。
    const button = (
      <button
        ref={ref}
        type="button"
        data-slot="ai-prompt-input-toolbar-button"
        disabled={rootDisabled || disabled}
        aria-pressed={active}
        aria-label={
          ariaLabel ?? (typeof tooltip === "string" ? tooltip : undefined)
        }
        data-active={active ? "" : undefined}
        className={cn(
          "transition-control inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-transparent p-1.5 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          "pointer-fine:active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          active
            ? "text-brand-foreground"
            : "text-foreground hover:border-border hover:bg-muted",
          className,
        )}
        {...props}
      />
    )

    if (tooltip == null) return button
    return (
      <SimpleTooltip
        title={tooltip}
        contentClassName={toolbarTooltipVariants()}
      >
        {button}
      </SimpleTooltip>
    )
  },
)
AiPromptInputToolbarButton.displayName = "AiPromptInputToolbarButton"

export interface AiPromptInputSubmitProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 覆盖 idle 态图标，默认 lucide ArrowUp（自定义图标请自带尺寸 class） */
  icon?: React.ReactNode
  /** 覆盖 running 态图标，默认 lucide Square（实心） */
  stopIcon?: React.ReactNode
}

function getSubmitDerivedStatus(running: boolean, disabled: boolean) {
  if (running) return "running"
  if (disabled) return "disabled"
  return "ready"
}

/**
 * 发送/停止圆钮，三派生态自动切换（context 派生）：
 * - disabled：idle 且 trim(value) 为空，或整体 disabled → 灰底圆钮
 * - ready：idle 且有内容 → primary 圆钮，点击 submit()
 * - running：status="running" → primary 圆钮 + 实心停止图标，点击 onStop()
 *   （running 不因 value 为空而 disabled）
 *
 * running 态视觉对照 composer-07-running-draft 草图（设计稿缺口），
 * 样式集中于下方 cn()，设计师后续微调时改此一处即可。
 */
const AiPromptInputSubmit = React.forwardRef<
  HTMLButtonElement,
  AiPromptInputSubmitProps
>(({ className, icon, stopIcon, onClick, disabled, ...props }, ref) => {
  const {
    value,
    status,
    disabled: rootDisabled,
    submit,
    stop,
    collapsed,
  } = useAiPromptInputContext()

  const running = status === "running"
  const mergedDisabled =
    rootDisabled || disabled || (!running && value.trim().length === 0)

  const runningIcon = stopIcon ?? (
    <Square
      strokeWidth={1.75}
      className="size-3 fill-current"
      aria-hidden="true"
    />
  )
  const iconSizeClassName = submitIconSizeVariants({ collapsed })
  const idleIcon = icon ?? (
    <ArrowUp
      strokeWidth={1.75}
      className={iconSizeClassName}
      aria-hidden="true"
    />
  )

  return (
    <button
      ref={ref}
      type="button"
      data-slot="ai-prompt-input-submit"
      disabled={mergedDisabled}
      aria-label={running ? "Stop generating" : "Send message"}
      data-status={getSubmitDerivedStatus(running, mergedDisabled)}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        if (running) {
          stop()
        } else {
          submit()
        }
      }}
      className={cn(
        "transition-control inline-flex shrink-0 items-center justify-center rounded-full",
        submitSizeVariants({ collapsed }),
        "pointer-fine:active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        mergedDisabled
          ? "bg-muted text-muted-foreground"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
        className,
      )}
      {...props}
    >
      <span
        key={running ? "running" : "idle"}
        data-slot="ai-prompt-input-submit-icon"
        aria-hidden="true"
        className={cn(
          "inline-flex origin-center animate-enter-scale items-center justify-center motion-reduce:animate-none [&_svg]:shrink-0",
          iconSizeClassName,
        )}
      >
        {running ? runningIcon : idleIcon}
      </span>
    </button>
  )
})
AiPromptInputSubmit.displayName = "AiPromptInputSubmit"

export interface AiPromptInputHelperTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** "info"（默认，muted 灰）| "error"（destructive 红） */
  variant?: "info" | "error"
}

// 容器外下方辅助文本（业务排版），样式壳：无默认文案（DEC-021）。
// 字数计数与超限报错由业务算好经 children 呈现：组件默认不设 maxLength
// （含 pill 时按 getSegments() 结果自行统计，label 长度计入或整颗 pill 计 1 由业务决定）。
const AiPromptInputHelperText = React.forwardRef<
  HTMLParagraphElement,
  AiPromptInputHelperTextProps
>(({ className, variant = "info", ...props }, ref) => (
  <p
    ref={ref}
    data-variant={variant}
    className={cn(
      "text-sm",
      variant === "error" ? "text-destructive" : "text-muted-foreground",
      className,
    )}
    {...props}
  />
))
AiPromptInputHelperText.displayName = "AiPromptInputHelperText"

export {
  AiPromptInput,
  AiPromptInputAttachments,
  AiPromptInputHelperText,
  AiPromptInputSubmit,
  AiPromptInputToolbar,
  AiPromptInputToolbarButton,
}
