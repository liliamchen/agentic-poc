"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { useControllableState } from "@radix-ui/react-use-controllable-state"
import { BookOpen, ChevronDown, CopyMinus, CopyPlus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SimpleTooltip } from "@/components/ui/simple-tooltip"

// runtime 无关（DEC-035）：数据只从 props 进、动作只从事件回调出，
// 不依赖 AI runtime，不对滚动容器做假设（无固定宽高、无内置 overflow-scroll）。

export type AiPlanCardStatus = "generating" | "pending" | "confirmed"

type AiPlanCardContextValue = {
  status: AiPlanCardStatus
  expandedSteps: string[]
  setExpandedSteps: (values: string[]) => void
  stepValues: string[]
  registerStep: (value: string) => () => void
  collapsible: boolean
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  /** header 折叠钮 aria-controls ↔ 内容层 id */
  contentId: string
}

const AiPlanCardContext = React.createContext<AiPlanCardContextValue | null>(
  null,
)

function useAiPlanCardContext() {
  const context = React.useContext(AiPlanCardContext)
  if (!context) {
    throw new Error("AiPlanCard components must be used within AiPlanCard")
  }
  return context
}

export interface AiPlanCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "dir"
> {
  /** 卡片状态，默认 "pending"（generating 由业务追加 Skeleton、confirmed 整体弱化） */
  status?: AiPlanCardStatus
  /** 展开的步骤 value 集合，受控 */
  expandedSteps?: string[]
  /** 非受控初始展开集合，默认 [] */
  defaultExpandedSteps?: string[]
  onExpandedStepsChange?: (values: string[]) => void
  /** 整卡可收起为一条 header 灰条，默认 false（老用法零变化） */
  collapsible?: boolean
  /** 整卡收起状态，受控 */
  collapsed?: boolean
  /** 非受控初始收起状态，默认 false */
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

const AiPlanCard = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Root>,
  AiPlanCardProps
>(
  (
    {
      className,
      status = "pending",
      expandedSteps: expandedStepsProp,
      defaultExpandedSteps,
      onExpandedStepsChange,
      collapsible = false,
      collapsed: collapsedProp,
      defaultCollapsed,
      onCollapsedChange,
      children,
      ...props
    },
    ref,
  ) => {
    // 步骤挂载时经 context 注册 value，供 Header「展开全部」与步骤计数使用（注册走 effect + 清理）。
    const [stepValues, setStepValues] = React.useState<string[]>([])
    const contentId = React.useId()

    const [expandedSteps = [], setExpandedSteps] = useControllableState<
      string[]
    >({
      prop: expandedStepsProp,
      defaultProp: defaultExpandedSteps ?? [],
      onChange: onExpandedStepsChange,
    })

    const [collapsed = false, setCollapsed] = useControllableState<boolean>({
      prop: collapsedProp,
      defaultProp: defaultCollapsed ?? false,
      onChange: onCollapsedChange,
    })

    const registerStep = React.useCallback((stepValue: string) => {
      setStepValues((prev) =>
        prev.includes(stepValue) ? prev : [...prev, stepValue],
      )
      return () => {
        setStepValues((prev) => prev.filter((value) => value !== stepValue))
      }
    }, [])

    const contextValue = React.useMemo<AiPlanCardContextValue>(
      () => ({
        status,
        expandedSteps,
        setExpandedSteps,
        stepValues,
        registerStep,
        collapsible,
        collapsed,
        setCollapsed,
        contentId,
      }),
      [
        status,
        expandedSteps,
        setExpandedSteps,
        stepValues,
        registerStep,
        collapsible,
        collapsed,
        setCollapsed,
        contentId,
      ],
    )

    return (
      <AiPlanCardContext.Provider value={contextValue}>
        <AccordionPrimitive.Root
          type="multiple"
          ref={ref}
          value={expandedSteps}
          onValueChange={setExpandedSteps}
          data-slot="ai-plan-card"
          data-status={status}
          data-collapsed={collapsible && collapsed ? "" : undefined}
          className={cn(
            "group/plan overflow-hidden rounded-xl bg-muted/50 ring-1 ring-inset ring-border",
            className,
          )}
          {...props}
        >
          {children}
        </AccordionPrimitive.Root>
      </AiPlanCardContext.Provider>
    )
  },
)
AiPlanCard.displayName = "AiPlanCard"

export type AiPlanCardContentProps = React.ComponentPropsWithoutRef<"div">

/**
 * 整卡收起用 grid-rows 过渡（与 ai-trace / ai-chain 同配方），不复用步骤那套 Radix
 * Accordion 高度动画——root 的 Accordion 归步骤用。收起保留 DOM 是硬约束：
 * 步骤计数依赖 AiPlanCardStep 挂载时的 registerStep，条件渲染会让计数归零。
 */
const AiPlanCardContent = React.forwardRef<
  React.ElementRef<"div">,
  AiPlanCardContentProps
>(({ className, ...props }, ref) => {
  const { collapsible, collapsed, contentId } = useAiPlanCardContext()

  const content = (
    <div
      ref={ref}
      data-slot="ai-plan-card-content"
      className={cn(
        "flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-inset ring-border",
        className,
      )}
      {...props}
    />
  )

  if (!collapsible) {
    return content
  }

  // React 18：inert 不在正式 HTMLAttributes（仅 experimental）；React 19：inert?: boolean。
  // 展开时必须省略属性本身（HTML 布尔属性看存在性）。
  const collapsedInert = { inert: "" }
  const inertProps = (
    collapsed ? collapsedInert : {}
  ) as React.HTMLAttributes<HTMLDivElement>

  return (
    <div
      id={contentId}
      aria-hidden={collapsed}
      {...inertProps}
      data-slot="ai-plan-card-collapsible"
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-toggle motion-reduce:transition-none",
        collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
      )}
    >
      <div className="overflow-hidden">{content}</div>
    </div>
  )
})
AiPlanCardContent.displayName = "AiPlanCardContent"

export interface AiPlanCardHeaderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** 头部图标，默认 lucide BookOpen */
  icon?: React.ReactNode
  title?: React.ReactNode
  /** 标题右侧状态插槽（如「已更新」徽标），排在 title 与 duration 之间 */
  badge?: React.ReactNode
  /** 耗时展示（只展示不计时，值由业务算好传入） */
  duration?: React.ReactNode
  /**
   * 步骤计数。省略时仅在 collapsible 下自动渲染 `${count} steps`（count 取自已注册的
   * AiPlanCardStep）；传函数可换措辞而不必重新数；传 null 隐藏。
   */
  stepsLabel?: React.ReactNode | ((count: number) => React.ReactNode)
  /** 右侧操作插槽（版本下拉等业务内容） */
  extra?: React.ReactNode
  /** 是否显示内置「展开/收起全部」按钮，默认 true */
  showExpandAll?: boolean
  /** 整卡折叠按钮 aria-label；默认英文（DEC-021） */
  collapseAriaLabel?: string
}

// 计数是组件独有的派生数据，所以默认自动渲染、覆盖走函数式（DEC-058 同款）；
// 非 collapsible 时不自动出，避免改变既有卡片的头部渲染。
function resolveStepsLabel(
  stepsLabel: AiPlanCardHeaderProps["stepsLabel"],
  count: number,
  collapsible: boolean,
): React.ReactNode {
  if (stepsLabel === undefined) {
    return collapsible ? `${count} steps` : null
  }
  if (typeof stepsLabel === "function") {
    return stepsLabel(count)
  }
  return stepsLabel
}

function AiPlanCardCollapseTrigger({
  label = "Toggle plan details",
}: {
  label?: string
}) {
  const { collapsed, setCollapsed, contentId } = useAiPlanCardContext()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-slot="ai-plan-card-collapse-trigger"
      aria-expanded={!collapsed}
      aria-controls={contentId}
      aria-label={label}
      className="h-6 w-6 text-muted-foreground transition-[transform,color,background-color,border-color] duration-100 ease-press pointer-fine:active:scale-[0.97] motion-reduce:transition-none"
      onClick={() => setCollapsed(!collapsed)}
    >
      <ChevronDown
        strokeWidth={1.75}
        aria-hidden="true"
        className={cn(
          "transition-transform duration-200 ease-toggle motion-reduce:transition-none",
          !collapsed && "rotate-180",
        )}
      />
    </Button>
  )
}

const AiPlanCardHeader = React.forwardRef<
  HTMLDivElement,
  AiPlanCardHeaderProps
>(
  (
    {
      className,
      icon,
      title,
      badge,
      duration,
      stepsLabel,
      extra,
      showExpandAll = true,
      collapseAriaLabel,
      ...props
    },
    ref,
  ) => {
    const { expandedSteps, stepValues, setExpandedSteps, collapsible } =
      useAiPlanCardContext()

    const allExpanded =
      stepValues.length > 0 &&
      stepValues.every((value) => expandedSteps.includes(value))
    const expandAllLabel = allExpanded
      ? "Collapse all steps"
      : "Expand all steps"
    const stepsNode = resolveStepsLabel(
      stepsLabel,
      stepValues.length,
      collapsible,
    )

    return (
      <div
        ref={ref}
        data-slot="ai-plan-card-header"
        className={cn("flex items-center gap-3 px-4 py-3", className)}
        {...props}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-4 shrink-0 items-center justify-center text-brand-foreground group-data-[status=confirmed]/plan:text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0"
        >
          {icon ?? <BookOpen strokeWidth={1.75} />}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          {title != null && (
            <span className="text-sm font-medium text-foreground group-data-[status=confirmed]/plan:text-muted-foreground">
              {title}
            </span>
          )}
          {badge}
          {duration != null && (
            <span className="text-sm text-muted-foreground">{duration}</span>
          )}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {stepsNode != null && (
            <span
              data-slot="ai-plan-card-steps-label"
              className="text-sm text-muted-foreground"
            >
              {stepsNode}
            </span>
          )}
          {showExpandAll && (
            <SimpleTooltip title={expandAllLabel}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground transition-[transform,color,background-color,border-color] duration-100 ease-press pointer-fine:active:scale-[0.97] motion-reduce:transition-none"
                aria-label={expandAllLabel}
                onClick={() => setExpandedSteps(allExpanded ? [] : stepValues)}
              >
                {allExpanded ? (
                  <CopyMinus strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <CopyPlus strokeWidth={1.75} aria-hidden="true" />
                )}
              </Button>
            </SimpleTooltip>
          )}
          {extra}
          {collapsible && (
            <AiPlanCardCollapseTrigger label={collapseAriaLabel} />
          )}
        </span>
      </div>
    )
  },
)
AiPlanCardHeader.displayName = "AiPlanCardHeader"

export interface AiPlanCardStepProps extends Omit<
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>,
  "title"
> {
  /** 步骤图标；hover 时切换为展开/折叠箭头 */
  icon?: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  /** children = 展开后的详情区（业务自渲染 markdown 等），未提供时展开无详情 */
}

const AiPlanCardStep = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  AiPlanCardStepProps
>(({ className, value, icon, title, description, children, ...props }, ref) => {
  const { registerStep } = useAiPlanCardContext()

  React.useEffect(() => registerStep(value), [registerStep, value])

  return (
    <AccordionPrimitive.Item
      ref={ref}
      value={value}
      data-slot="ai-plan-card-step"
      className={cn("group/plan-step relative", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className="absolute -bottom-4 left-2.5 top-5 w-px bg-foreground/10 group-last/plan-step:hidden"
      />
      <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger
          className={cn(
            "group/step flex w-full items-start gap-3 rounded-lg text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          )}
        >
          <span
            aria-hidden="true"
            className="relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground [&_svg]:size-3 [&_svg]:shrink-0"
          >
            {icon != null && (
              <span className="flex items-center justify-center transition-opacity duration-150 ease-standard group-focus-visible/step:opacity-0 pointer-fine:group-hover/step:opacity-0 motion-reduce:transition-none">
                {icon}
              </span>
            )}
            <ChevronDown
              strokeWidth={1.75}
              className={cn(
                "absolute transition-[opacity,transform] duration-200 ease-toggle group-data-[state=open]/step:rotate-180 motion-reduce:transition-none",
                icon != null &&
                  "opacity-0 group-focus-visible/step:opacity-100 pointer-fine:group-hover/step:opacity-100",
              )}
            />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            {title != null && (
              <span className="text-sm font-normal text-foreground group-data-[status=confirmed]/plan:text-muted-foreground">
                {title}
              </span>
            )}
            {description != null && (
              <span className="text-sm text-secondary-foreground group-data-[status=confirmed]/plan:opacity-60">
                {description}
              </span>
            )}
          </span>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      {children != null && (
        <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none">
          <div className="pl-8 pt-2 text-sm text-secondary-foreground group-data-[status=confirmed]/plan:opacity-60">
            {children}
          </div>
        </AccordionPrimitive.Content>
      )}
    </AccordionPrimitive.Item>
  )
})
AiPlanCardStep.displayName = "AiPlanCardStep"

export interface AiPlanCardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 骨架行数，默认 3（generating 时由业务追加在已出步骤之后） */
  rows?: number
}

const AiPlanCardSkeleton = React.forwardRef<
  HTMLDivElement,
  AiPlanCardSkeletonProps
>(({ className, rows = 3, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn("flex flex-col gap-4", className)}
    {...props}
  >
    {Array.from({ length: rows }, (_, index) => index).map((row) => (
      <div
        key={row}
        className="group/plan-skeleton relative flex items-start gap-3"
      >
        <span
          aria-hidden="true"
          className="absolute -bottom-4 left-2.5 top-5 w-px bg-foreground/10 group-last/plan-skeleton:hidden"
        />
        <span className="relative z-10 size-5 shrink-0 animate-pulse rounded-full border border-border bg-muted" />
        <span className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
          <span className="h-3.5 w-2/5 animate-pulse rounded bg-muted" />
          <span className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
        </span>
      </div>
    ))}
  </div>
))
AiPlanCardSkeleton.displayName = "AiPlanCardSkeleton"

export interface AiPlanCardConfirmBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 是否已确认，受控；默认 false（待确认） */
  confirmed?: boolean
  defaultConfirmed?: boolean
  onConfirmedChange?: (confirmed: boolean) => void
  /** 待确认文案，默认英文（DEC-021），业务传中文覆盖 */
  message?: React.ReactNode
  /** 已确认文案 */
  confirmedMessage?: React.ReactNode
  modifyText?: React.ReactNode
  confirmText?: React.ReactNode
  /** 已确认后确认按钮文案 */
  confirmedText?: React.ReactNode
  /** 业务用于「引用整段计划到输入框」 */
  onModify?: () => void
  onConfirm?: () => void
  /** 确认后自动消失延时 ms，默认 2000；传 null 禁用自动消失 */
  autoHideDelay?: number | null
  /** 消失动画结束后回调（业务可据此卸载） */
  onAutoHide?: () => void
}

const AiPlanCardConfirmBar = React.forwardRef<
  HTMLDivElement,
  AiPlanCardConfirmBarProps
>(
  (
    {
      className,
      confirmed: confirmedProp,
      defaultConfirmed,
      onConfirmedChange,
      message = "Plan ready. Confirm to execute?",
      confirmedMessage = "Plan confirmed. Executing task.",
      modifyText = "Modify",
      confirmText = "Confirm",
      confirmedText = "Confirmed",
      onModify,
      onConfirm,
      autoHideDelay = 2000,
      onAutoHide,
      onTransitionEnd,
      ...props
    },
    ref,
  ) => {
    const [confirmed = false, setConfirmed] = useControllableState<boolean>({
      prop: confirmedProp,
      defaultProp: defaultConfirmed ?? false,
      onChange: onConfirmedChange,
    })

    // 淡出播放态；confirmed 被外部复位时在渲染期同步重置（DEC-029 模式 2）。
    const [hiding, setHiding] = React.useState(false)
    const [prevConfirmed, setPrevConfirmed] = React.useState(confirmed)
    if (prevConfirmed !== confirmed) {
      setPrevConfirmed(confirmed)
      if (!confirmed) {
        setHiding(false)
      }
    }

    React.useEffect(() => {
      if (!confirmed || autoHideDelay === null) {
        return
      }
      // setTimeout 回调里 setState 属 DEC-029 合法例外；卸载时清理定时器。
      const timer = setTimeout(() => {
        setHiding(true)
      }, autoHideDelay)
      return () => clearTimeout(timer)
    }, [confirmed, autoHideDelay])

    return (
      <div
        ref={ref}
        data-slot="ai-plan-card-confirm-bar"
        data-confirmed={confirmed ? "" : undefined}
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg bg-muted/50 py-3 pl-4 pr-2 ring-1 ring-inset ring-border",
          "transition-opacity duration-180 ease-enter motion-reduce:transition-none",
          hiding && "pointer-events-none opacity-0",
          className,
        )}
        onTransitionEnd={(event) => {
          onTransitionEnd?.(event)
          if (
            hiding &&
            event.target === event.currentTarget &&
            event.propertyName === "opacity"
          ) {
            onAutoHide?.()
          }
        }}
        {...props}
      >
        <span
          className={cn(
            "text-sm font-medium",
            confirmed ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {confirmed ? confirmedMessage : message}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-lg px-3 text-xs leading-5 transition-[transform,color,background-color,border-color] duration-100 ease-press pointer-fine:active:scale-[0.97] motion-reduce:transition-none"
            disabled={confirmed}
            onClick={onModify}
          >
            {modifyText}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 rounded-lg px-3 text-xs leading-5 shadow-none transition-[transform,color,background-color,border-color] duration-100 ease-press pointer-fine:active:scale-[0.97] motion-reduce:transition-none"
            disabled={confirmed}
            onClick={() => {
              setConfirmed(true)
              onConfirm?.()
            }}
          >
            {confirmed ? confirmedText : confirmText}
          </Button>
        </span>
      </div>
    )
  },
)
AiPlanCardConfirmBar.displayName = "AiPlanCardConfirmBar"

export {
  AiPlanCard,
  AiPlanCardConfirmBar,
  AiPlanCardContent,
  AiPlanCardHeader,
  AiPlanCardSkeleton,
  AiPlanCardStep,
}
