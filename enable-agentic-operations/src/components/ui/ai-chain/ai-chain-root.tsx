import * as React from "react"
import { useControllableState } from "@radix-ui/react-use-controllable-state"
import { cva } from "class-variance-authority"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

import { useCollapseOnSuccess } from "./use-collapse-on-success"

// runtime 无关（DEC-035）：数据只从 props 进、动作只从事件回调出，
// 不依赖 AI runtime，不对滚动容器做假设（无固定宽高、无内置 overflow-scroll）。
// 计时/状态流转由业务驱动：组件不轮询、不订阅，status 变化全部经 props。

export type AiChainNodeStatus = "success" | "running" | "pending" | "error"

type AiChainContextValue = {
  /** 节点注册顺序（= 挂载顺序），连线渐变取前驱状态用 */
  values: string[]
  statusMap: Record<string, AiChainNodeStatus>
  registerNode: (value: string) => () => void
  setNodeStatus: (value: string, status: AiChainNodeStatus) => void
}

const AiChainContext = React.createContext<AiChainContextValue | null>(null)

function useAiChainContext() {
  const context = React.useContext(AiChainContext)
  if (!context) {
    throw new Error("AiChainNode must be used within AiChain")
  }
  return context
}

export type AiChainProps = React.HTMLAttributes<HTMLDivElement>

/**
 * 执行链容器：垂直排布节点并维护注册顺序（顺序 = 挂载顺序）。
 *
 * 已知限制：动态把节点插入到链中间会导致注册顺序与视觉顺序不一致
 * （AI chat 场景节点只会尾部追加，可接受）。
 *
 * 注意：默认 `gap-6` 与 AiChainNode 入线的 `-top-6 h-6` 配套，
 * 业务覆盖 gap 时需同步覆盖节点连线的定位 class。
 */
const AiChain = React.forwardRef<HTMLDivElement, AiChainProps>(
  ({ className, children, ...props }, ref) => {
    const [values, setValues] = React.useState<string[]>([])
    const [statusMap, setStatusMap] = React.useState<
      Record<string, AiChainNodeStatus>
    >({})

    const registerNode = React.useCallback((value: string) => {
      // value 必须在同一条链内唯一：重复 value 会让注册顺序与连线渲染错乱
      // （后继节点取不到正确前驱状态）。重复时不再重复入列，保持已有顺序。
      // 业务用 .map 渲染时 key 与 value 同源，React 的重复 key 警告会先行提示。
      setValues((prev) => (prev.includes(value) ? prev : [...prev, value]))
      return () => {
        setValues((prev) => prev.filter((item) => item !== value))
        setStatusMap((prev) => {
          if (!(value in prev)) return prev
          const next = { ...prev }
          delete next[value]
          return next
        })
      }
    }, [])

    // status 变化只更新映射、不动注册顺序（与 registerNode 分离，避免重注册导致顺序漂移）。
    const setNodeStatus = React.useCallback(
      (value: string, status: AiChainNodeStatus) => {
        setStatusMap((prev) =>
          prev[value] === status ? prev : { ...prev, [value]: status },
        )
      },
      [],
    )

    const contextValue = React.useMemo<AiChainContextValue>(
      () => ({ values, statusMap, registerNode, setNodeStatus }),
      [values, statusMap, registerNode, setNodeStatus],
    )

    return (
      <AiChainContext.Provider value={contextValue}>
        <div
          ref={ref}
          data-slot="ai-chain"
          className={cn("flex flex-col gap-6", className)}
          {...props}
        >
          {children}
        </div>
      </AiChainContext.Provider>
    )
  },
)
AiChain.displayName = "AiChain"

/** 向 Root 注册节点顺序与状态，返回连线渲染所需的前驱状态 / 是否有后继。 */
function useChainLink(value: string, status: AiChainNodeStatus) {
  const { values, statusMap, registerNode, setNodeStatus } = useAiChainContext()

  // 连线渲染依赖注册顺序与前驱状态：用 useLayoutEffect 在浏览器 paint 前完成注册，
  // 避免首帧 index === -1 时连线缺失、随后闪一下补画（与 ai-plan-card 仅供「展开全部」
  // 的 useEffect 注册不同，此处顺序直接影响可见连线）。
  React.useLayoutEffect(() => registerNode(value), [registerNode, value])
  React.useLayoutEffect(() => {
    setNodeStatus(value, status)
  }, [setNodeStatus, value, status])

  const index = values.indexOf(value)
  const predecessorStatus =
    index > 0 ? (statusMap[values[index - 1]] ?? "success") : undefined
  const hasNext = index !== -1 && index < values.length - 1
  return { predecessorStatus, hasNext }
}

const nodeIconVariants = cva(
  "relative flex size-5 shrink-0 items-center justify-center rounded-full [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      status: {
        // 完成态弱化，不抢注意力
        success: "border border-border bg-muted/50 text-muted-foreground",
        running:
          "bg-background text-brand-foreground shadow-sm shadow-brand-foreground/20",
        pending:
          "border border-warning-low bg-warning-low-background text-warning-low-foreground dark:border-warning-low/20 dark:bg-warning-low-background/[0.07]",
        error:
          "border border-warning-high bg-warning-high-background text-warning-high-foreground dark:border-warning-high/20 dark:bg-warning-high-background/[0.07]",
      },
    },
    defaultVariants: { status: "success" },
  },
)

// 连线颜色：语义 token + 标准透明度刻度（DEC-033 合规写法，禁止 hex / 任意值）。
const lineGradientVariants = cva(
  "absolute -top-6 left-2.5 h-6 w-px bg-gradient-to-b",
  {
    variants: {
      from: {
        success: "from-border",
        running: "from-brand",
        pending: "from-warning-low/50",
        error: "from-warning-high/50",
      },
      to: {
        success: "to-border",
        running: "to-brand",
        pending: "to-warning-low/50",
        error: "to-warning-high/50",
      },
    },
    defaultVariants: { from: "success", to: "success" },
  },
)

const lineSolidVariants = cva("absolute bottom-0 left-2.5 top-5 w-px", {
  variants: {
    status: {
      success: "bg-border",
      running: "bg-brand",
      pending: "bg-warning-low/50",
      error: "bg-warning-high/50",
    },
  },
  defaultVariants: { status: "success" },
})

function AiChainNodeLines({
  predecessorStatus,
  status,
  hasNext,
}: {
  predecessorStatus: AiChainNodeStatus | undefined
  status: AiChainNodeStatus
  hasNext: boolean
}) {
  return (
    <>
      {/* 入线：向上延伸进 Root gap-3 的间隙，与前驱节点尾线相接；渐变 前驱色 → 自身色 */}
      {predecessorStatus != null && (
        <span
          aria-hidden="true"
          className={lineGradientVariants({
            from: predecessorStatus,
            to: status,
          })}
        />
      )}
      {/* 尾线：icon 下缘到节点底部，有后继节点时显示 */}
      {hasNext && (
        <span aria-hidden="true" className={lineSolidVariants({ status })} />
      )}
    </>
  )
}

/**
 * icon 位：可交互（有内容）时 hover 标题行淡入切换为折叠/展开箭头（同 AiPlanCardStep 配方）；
 * 无内容节点（interactive=false）不出箭头、不做 hover 切换，避免暗示「可展开」。
 */
function AiChainNodeIcon({
  status,
  icon,
  expanded,
  interactive,
}: {
  status: AiChainNodeStatus
  icon: React.ReactNode
  expanded: boolean
  interactive: boolean
}) {
  return (
    <span aria-hidden="true" className={nodeIconVariants({ status })}>
      {status === "running" && (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-brand-foreground/25"
          />
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-0 transition-opacity duration-150 ease-enter motion-reduce:transition-none",
              interactive &&
                "group-focus-visible/header:opacity-0 pointer-fine:group-hover/header:opacity-0",
            )}
          >
            <span
              data-slot="ai-chain-running-indicator"
              className="motion-chain-running-ring absolute inset-0 animate-spin rounded-full blur-[0.5px] [animation-duration:2400ms] motion-reduce:hidden"
            />
          </span>
        </>
      )}
      {icon != null && (
        <span
          className={cn(
            "flex items-center justify-center transition-opacity duration-150 ease-enter motion-reduce:transition-none",
            interactive &&
              "group-focus-visible/header:opacity-0 pointer-fine:group-hover/header:opacity-0",
          )}
        >
          <span className="flex items-center justify-center">{icon}</span>
        </span>
      )}
      {interactive && (
        <ChevronDown
          strokeWidth={1.75}
          aria-hidden="true"
          className={cn(
            "absolute transition-[opacity,transform] duration-200 ease-toggle motion-reduce:transition-none",
            expanded && "rotate-180",
            icon != null &&
              "opacity-0 group-focus-visible/header:opacity-100 pointer-fine:group-hover/header:opacity-100",
          )}
        />
      )}
    </span>
  )
}

/**
 * 展开/收起动画：CSS grid-rows 过渡，业务仓零 keyframes 配置可用
 * （勿换 Radix Collapsible 高度动画，其 keyframes 不在 shadcn v3 预设内）。
 */
function AiChainNodeContent({
  id,
  expanded,
  description,
  children,
}: {
  id: string
  expanded: boolean
  description: React.ReactNode
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
        <div className="flex min-w-0 flex-col gap-3 pl-8 pt-4">
          {React.Children.toArray(description).length > 0 && (
            <div className="text-sm text-secondary-foreground">
              {description}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

export interface AiChainNodeProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** 节点唯一标识（context 注册用） */
  value: string
  /** 节点状态，默认 "success"；驱动 icon 状态色、入线渐变、running 闪影 */
  status?: AiChainNodeStatus
  /** 节点图标；hover 标题行时 icon 位切换为折叠/展开箭头 */
  icon?: React.ReactNode
  title?: React.ReactNode
  /** 展开时显示的描述 */
  description?: React.ReactNode
  /** 展开，受控；非受控默认 true */
  expanded?: boolean
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  /**
   * status 变为 "success" 时自动折叠（设计稿「每个任务步骤完成后，自动折叠收起」），
   * 默认 true；仅非受控生效（受控时业务自管）
   */
  collapseOnSuccess?: boolean
  /** children = 节点内容插槽（TaskBar / ReasoningCard / 业务任意内容） */
}

const AiChainNode = React.forwardRef<HTMLDivElement, AiChainNodeProps>(
  (
    {
      className,
      value,
      status = "success",
      icon,
      title,
      description,
      expanded: expandedProp,
      defaultExpanded,
      onExpandedChange,
      collapseOnSuccess = true,
      children,
      ...props
    },
    ref,
  ) => {
    const contentId = React.useId()
    const { predecessorStatus, hasNext } = useChainLink(value, status)

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

    // DEC-039：description / children 统一用 Children.toArray 判空，
    // 避免 `{cond && <X/>}` 传入 false 时被 `!= null` 误判为「有内容」。
    const hasContent =
      React.Children.toArray([description, children]).length > 0

    const header = (
      <>
        <AiChainNodeIcon
          status={status}
          icon={icon}
          expanded={expanded}
          interactive={hasContent}
        />
        {React.Children.toArray(title).length > 0 && (
          <span className="text-sm font-medium text-foreground">{title}</span>
        )}
      </>
    )

    return (
      <div
        ref={ref}
        data-status={status}
        data-slot="ai-chain-node"
        className={cn(
          "relative flex animate-enter-up flex-col motion-reduce:animate-none",
          className,
        )}
        {...props}
      >
        <AiChainNodeLines
          predecessorStatus={predecessorStatus}
          status={status}
          hasNext={hasNext}
        />
        {hasContent ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "group/header relative flex items-center gap-3 rounded-md text-left",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {header}
          </button>
        ) : (
          // 无内容节点（如仅标题的 pending 节点）：纯展示，不做成可点按钮，
          // 不报告 aria-expanded / aria-controls，避免无障碍语义与实际不符。
          <div className="relative flex items-center gap-3">{header}</div>
        )}
        {hasContent && (
          <AiChainNodeContent
            id={contentId}
            expanded={expanded}
            description={description}
          >
            {children}
          </AiChainNodeContent>
        )}
      </div>
    )
  },
)
AiChainNode.displayName = "AiChainNode"

export { AiChain, AiChainNode }
