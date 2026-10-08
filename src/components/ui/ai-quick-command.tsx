import * as React from "react"
import { useControllableState } from "@radix-ui/react-use-controllable-state"
import { Command as CommandPrimitive } from "cmdk"

import { cn } from "@/lib/utils"
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

// runtime 无关（DEC-035）：输入框上方的指令/对象选择菜单面板，`/`、`@` 触发检测、
// 面板定位（Popover/绝对定位）、选中后的文本插入全归业务；组件只是受控 open 下
// 渲染的普通块级面板（宽度不内置），value 受控高亮、onSelect 事件出。
// 键盘导航（↑↓ 高亮、Enter 选中）基于 shadcn command / cmdk，不自研 roving
// focus（DEC-004/019）；焦点始终留在业务 textarea，业务把按键经
// `ref.current?.dispatchEvent(new KeyboardEvent("keydown", …))` 转发进面板
// （shadcn combobox 同款做法，recipe 见 Storybook）。←/→ 切换 Tab 是 cmdk 之外
// 的增量：Root 捕获后路由给 AiQuickCommandTabs 注册的处理器。

// 面板换 tab 时列表内容多寡不同、列表高度随之变化，footer 在正常流里跟着上下移动。
// 为了让这段高度变化「平滑跟随」而非瞬间跳变，对列表容器高度做测量式动画（FLIP 变体：
// 量旧高 → 提交新内容 → 量新高 → 从旧高动画到新高）。起终高度由布局决定、CSS 表达不了，
// 故这一处用 WAAPI（DEC-050 例外）。footer 不再做 transform，始终留在正常流，因此不会
// 被面板 overflow-hidden 裁切（旧的 footer-transform 实现在列表变短时 footer 被裁出「跳」）。
// WAAPI 只接受字面量，取不到 Tailwind 的 `ease-*`，故此处与插件 token 同值手写；
// 改动须同步主题运行时的 MOTION_TIMING_FUNCTION。
const LIST_RESIZE_DURATION_MS = 180
const LIST_RESIZE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)" // = ease-enter
const LIST_RESIZE_ANIMATION_ID = "ai-quick-command-list-resize"

// 列表换 tab 的横向入场同样走 WAAPI：被打断时要从「当前实测值」续上，纯 CSS 做不到。
const CONTENT_IN_DURATION_MS = 180
const CONTENT_IN_OFFSET_PX = 4
const CONTENT_IN_EASING = "cubic-bezier(0.22, 1, 0.36, 1)" // = ease-enter
const CONTENT_IN_ANIMATION_ID = "ai-quick-command-content-in"

type AiQuickCommandContextValue = {
  /** Tabs 挂载时把 ←/→ 循环切换处理器写进来，Root onKeyDown 路由（无 Tabs 时无行为） */
  tabsArrowKeyHandlerRef: React.MutableRefObject<
    ((key: "ArrowLeft" | "ArrowRight") => boolean) | null
  >
  /** 单调自增；每次换 tab +1，供 List 重放入场动画、供列表高度 resize 动画触发 */
  contentMotionRevision: number
  contentMotionDirection: -1 | 1
  contentMotionAnimated: boolean
  requestContentMotion: (direction: -1 | 1, animated: boolean) => void
}

const AiQuickCommandContext =
  React.createContext<AiQuickCommandContextValue | null>(null)

/**
 * 返回 `[内部 ref, 挂到元素上的 callback ref]`，把转发进来的 ref 与内部 ref 合流。
 * callback 用 useCallback 稳定引用，避免内联写法在每次渲染时被以 null→node 重复调用。
 */
function useMergedRef<T>(forwardedRef: React.ForwardedRef<T>) {
  const localRef = React.useRef<T | null>(null)
  const setRef = React.useCallback(
    (node: T | null) => {
      localRef.current = node
      if (typeof forwardedRef === "function") {
        forwardedRef(node)
        return
      }
      if (!forwardedRef) return
      const objectRef = forwardedRef as React.MutableRefObject<T | null>
      objectRef.current = node
    },
    [forwardedRef],
  )
  return [localRef, setRef] as const
}

export interface AiQuickCommandProps extends React.ComponentPropsWithoutRef<
  typeof CommandPrimitive
> {
  /**
   * 是否用 cmdk 内置过滤，默认 false（菜单场景列表通常业务算好再传）。
   * 置 true 时需业务自行挂 CommandInput 提供 query（cmdk 无顶层 search prop）。
   */
  shouldFilter?: boolean
}

const AiQuickCommand = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  AiQuickCommandProps
>(({ className, shouldFilter = false, onKeyDown, children, ...props }, ref) => {
  const [commandRef, mergedRef] =
    useMergedRef<React.ElementRef<typeof CommandPrimitive>>(ref)
  const contentStartListHeightRef = React.useRef<number | null>(null)
  const listResizeAnimationRef = React.useRef<Animation | null>(null)
  const tabsArrowKeyHandlerRef = React.useRef<
    ((key: "ArrowLeft" | "ArrowRight") => boolean) | null
  >(null)
  const [contentMotionRevision, setContentMotionRevision] = React.useState(0)
  const [contentMotionDirection, setContentMotionDirection] = React.useState<
    -1 | 1
  >(1)
  const [contentMotionAnimated, setContentMotionAnimated] = React.useState(true)
  const requestContentMotion = React.useCallback(
    (direction: -1 | 1, animated: boolean) => {
      const command = commandRef.current
      if (command) {
        // FLIP 的 First：必须在 React 提交新列表前量到列表旧高度。连点 tab 时上一段
        // 高度动画还在跑，offsetHeight 即当前实测高度，天然从中途续上不跳帧。
        const list = command.querySelector<HTMLElement>(
          "[data-slot='ai-quick-command-list']",
        )
        contentStartListHeightRef.current = animated
          ? (list?.offsetHeight ?? null)
          : null
        listResizeAnimationRef.current?.cancel()
        listResizeAnimationRef.current = null
        if (list) delete list.dataset.resizing
      }
      setContentMotionDirection(direction)
      setContentMotionAnimated(animated)
      setContentMotionRevision((revision) => revision + 1)
    },
    [commandRef],
  )

  React.useLayoutEffect(() => {
    const command = commandRef.current
    const startHeight = contentStartListHeightRef.current
    if (!command || contentMotionRevision === 0 || startHeight === null) {
      return
    }

    // 每次启动动画时现读，故用户中途改系统设置下一次切换即生效。
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    // FLIP 的 Last：提交新列表后量到列表新高度，从旧高平滑收/展到新高。
    const list = command.querySelector<HTMLElement>(
      "[data-slot='ai-quick-command-list']",
    )
    if (!list) return
    const endHeight = list.offsetHeight
    if (Math.abs(endHeight - startHeight) <= 0.5) return

    // 列表本身 overflow-y-auto，变高过程中内容已满会闪出滚动条。overflow 不是可靠的
    // WAAPI 动画属性，改用 data 状态 + Tailwind utility 压掉；结束后恢复 CSS 的 auto。
    list.dataset.resizing = ""
    const animation = list.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      {
        duration: LIST_RESIZE_DURATION_MS,
        easing: LIST_RESIZE_EASING,
      },
    )
    animation.id = LIST_RESIZE_ANIMATION_ID
    listResizeAnimationRef.current = animation
    const finishResize = () => {
      if (listResizeAnimationRef.current !== animation) return
      listResizeAnimationRef.current = null
      delete list.dataset.resizing
    }
    animation.finished.then(finishResize).catch(finishResize)
  }, [commandRef, contentMotionRevision])

  React.useEffect(
    () => () => {
      listResizeAnimationRef.current?.cancel()
    },
    [],
  )

  const contextValue = React.useMemo<AiQuickCommandContextValue>(
    () => ({
      tabsArrowKeyHandlerRef,
      contentMotionRevision,
      contentMotionDirection,
      contentMotionAnimated,
      requestContentMotion,
    }),
    [
      contentMotionAnimated,
      contentMotionDirection,
      contentMotionRevision,
      requestContentMotion,
    ],
  )

  return (
    <AiQuickCommandContext.Provider value={contextValue}>
      <CommandPrimitive
        ref={mergedRef}
        data-slot="ai-quick-command"
        shouldFilter={shouldFilter}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented) return
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
          // 业务转发到面板根的 ←/→ 不会冒泡进子节点，故在 Root 捕获后
          // 路由给 Tabs（cmdk 只消费 ↑↓/Enter 等，不处理左右键）。
          if (tabsArrowKeyHandlerRef.current?.(event.key)) {
            event.preventDefault()
          }
        }}
        className={cn(
          "flex flex-col overflow-hidden rounded-2xl border border-border bg-muted text-popover-foreground shadow-sm",
          className,
        )}
        {...props}
      >
        {children}
      </CommandPrimitive>
    </AiQuickCommandContext.Provider>
  )
})
AiQuickCommand.displayName = "AiQuickCommand"

type AiQuickCommandTabsContextValue = {
  value: string
  setValue: (value: string) => void
}

const AiQuickCommandTabsContext =
  React.createContext<AiQuickCommandTabsContextValue | null>(null)

function useAiQuickCommandTabsContext() {
  const context = React.useContext(AiQuickCommandTabsContext)
  if (!context) {
    throw new Error("AiQuickCommandTab must be used within AiQuickCommandTabs")
  }
  return context
}

export interface AiQuickCommandTabsProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

const AiQuickCommandTabs = React.forwardRef<
  HTMLDivElement,
  AiQuickCommandTabsProps
>(
  (
    {
      className,
      value: valueProp,
      defaultValue,
      onValueChange,
      onKeyDown,
      onScroll,
      children,
      ...props
    },
    ref,
  ) => {
    const rootContext = React.useContext(AiQuickCommandContext)
    const requestContentMotion = rootContext?.requestContentMotion
    const [containerRef, mergedRef] = useMergedRef<HTMLDivElement>(ref)
    const [canScrollRight, setCanScrollRight] = React.useState(false)
    const [indicatorLayout, setIndicatorLayout] = React.useState({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      ready: false,
    })
    const [value = "", setValue] = useControllableState<string>({
      prop: valueProp,
      defaultProp: defaultValue ?? "",
      onChange: onValueChange,
    })
    const updateScrollEdge = React.useCallback(() => {
      const container = containerRef.current
      if (!container) return
      setCanScrollRight(
        container.scrollLeft + container.clientWidth <
          container.scrollWidth - 1,
      )
    }, [containerRef])
    const updateIndicatorLayout = React.useCallback(() => {
      const container = containerRef.current
      if (!container) return
      const activeTab = Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          "[data-ai-quick-command-tab]",
        ),
      ).find((tab) => tab.dataset.value === value)
      if (!activeTab) return

      const nextLayout = {
        x: activeTab.offsetLeft,
        y: activeTab.offsetTop,
        width: activeTab.offsetWidth,
        height: activeTab.offsetHeight,
        ready: true,
      }
      setIndicatorLayout((current) =>
        current.x === nextLayout.x &&
        current.y === nextLayout.y &&
        current.width === nextLayout.width &&
        current.height === nextLayout.height &&
        current.ready
          ? current
          : nextLayout,
      )
    }, [containerRef, value])
    React.useLayoutEffect(() => {
      const frame = requestAnimationFrame(() => {
        updateScrollEdge()
        updateIndicatorLayout()
      })
      const resizeObserver =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(() => {
              updateScrollEdge()
              updateIndicatorLayout()
            })
      const container = containerRef.current
      if (container) {
        resizeObserver?.observe(container)
        container
          .querySelectorAll("[data-ai-quick-command-tab]")
          .forEach((tab) => resizeObserver?.observe(tab))
      }
      return () => {
        cancelAnimationFrame(frame)
        resizeObserver?.disconnect()
      }
    }, [containerRef, children, updateIndicatorLayout, updateScrollEdge])
    React.useLayoutEffect(() => {
      const container = containerRef.current
      if (!container) return
      const activeTab = Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          "[data-ai-quick-command-tab]",
        ),
      ).find((tab) => tab.dataset.value === value)
      if (!activeTab) return
      updateIndicatorLayout()
      const frame = requestAnimationFrame(() => {
        const visibleLeft = container.scrollLeft
        const visibleRight = visibleLeft + container.clientWidth
        const tabLeft = activeTab.offsetLeft
        const tabRight = tabLeft + activeTab.offsetWidth
        const stripOverflows = container.scrollWidth > container.clientWidth + 1
        const tabIsOutside =
          tabLeft < visibleLeft - 1 || tabRight > visibleRight + 1
        if (stripOverflows && tabIsOutside) {
          activeTab.scrollIntoView({ block: "nearest", inline: "nearest" })
        }
        updateScrollEdge()
      })
      return () => cancelAnimationFrame(frame)
    }, [containerRef, value, children, updateIndicatorLayout, updateScrollEdge])
    // 循环切换：tab 顺序取 DOM 渲染顺序（跳过 disabled），对条件渲染天然稳健。
    const cycleTab = React.useCallback(
      (key: "ArrowLeft" | "ArrowRight") => {
        const container = containerRef.current
        if (!container) return false
        const tabs = Array.from(
          container.querySelectorAll<HTMLButtonElement>(
            "[data-ai-quick-command-tab]",
          ),
        ).filter((tab) => !tab.disabled)
        const values = tabs.map((tab) => tab.dataset.value ?? "")
        if (values.length === 0) return false
        const direction = key === "ArrowRight" ? 1 : -1
        let baseIndex = values.indexOf(value)
        if (baseIndex === -1) {
          baseIndex = direction === 1 ? -1 : 0
        }
        const nextIndex =
          (baseIndex + direction + values.length) % values.length
        if (values[nextIndex] !== value) {
          requestContentMotion?.(direction, false)
        }
        setValue(values[nextIndex])
        // 方向键直接发生在 Tab 内时，同步 roving focus，避免旧 Tab 留下焦点圈；
        // 从业务输入框转发到 Root 的按键不在容器内，仍保持输入框焦点。
        if (container.contains(document.activeElement)) {
          tabs[nextIndex]?.focus({ preventScroll: true })
        }
        return true
      },
      [containerRef, requestContentMotion, value, setValue],
    )
    // 把处理器注册到 Root，接收业务转发到面板根的 ←/→（见 Root onKeyDown）。
    React.useEffect(() => {
      const handlerRef = rootContext?.tabsArrowKeyHandlerRef
      if (!handlerRef) return
      handlerRef.current = cycleTab
      return () => {
        handlerRef.current = null
      }
    }, [rootContext, cycleTab])
    const contextValue = React.useMemo<AiQuickCommandTabsContextValue>(
      () => ({ value, setValue }),
      [value, setValue],
    )
    return (
      <AiQuickCommandTabsContext.Provider value={contextValue}>
        <div
          ref={mergedRef}
          onKeyDown={(event) => {
            onKeyDown?.(event)
            if (event.defaultPrevented) return
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
            if (cycleTab(event.key)) {
              event.preventDefault()
            }
          }}
          onScroll={(event) => {
            onScroll?.(event)
            updateScrollEdge()
          }}
          data-slot="ai-quick-command-tabs"
          className={cn(
            "relative flex shrink-0 items-center gap-1 overflow-x-auto bg-popover px-3 pt-3",
            canScrollRight &&
              "[-webkit-mask-image:linear-gradient(to_right,black_0,black_calc(100%-2rem),transparent_100%)] [mask-image:linear-gradient(to_right,black_0,black_calc(100%-2rem),transparent_100%)]",
            className,
          )}
          {...props}
        >
          <span
            aria-hidden="true"
            data-slot="ai-quick-command-tab-indicator"
            className={cn(
              "pointer-events-none absolute left-0 top-0 z-0 rounded-full border border-border",
              // 指针点击保留空间连续性；键盘切换即时响应（DEC-091）。
              indicatorLayout.ready && rootContext?.contentMotionAnimated
                ? "transition-[transform,width] duration-180 ease-enter motion-reduce:transition-none"
                : "transition-none",
            )}
            style={{
              width: indicatorLayout.width,
              height: indicatorLayout.height,
              opacity: indicatorLayout.ready ? 1 : 0,
              transform: `translate3d(${indicatorLayout.x}px, ${indicatorLayout.y}px, 0)`,
            }}
          />
          {children}
        </div>
      </AiQuickCommandTabsContext.Provider>
    )
  },
)
AiQuickCommandTabs.displayName = "AiQuickCommandTabs"

export interface AiQuickCommandTabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const AiQuickCommandTab = React.forwardRef<
  HTMLButtonElement,
  AiQuickCommandTabProps
>(({ className, value, onClick, onMouseDown, ...props }, ref) => {
  const rootContext = React.useContext(AiQuickCommandContext)
  const { value: activeValue, setValue } = useAiQuickCommandTabsContext()
  const active = activeValue === value

  return (
    <button
      ref={ref}
      type="button"
      data-slot="ai-quick-command-tab"
      data-ai-quick-command-tab=""
      data-value={value}
      data-state={active ? "active" : "inactive"}
      onMouseDown={(event) => {
        onMouseDown?.(event)
        const { activeElement } = event.currentTarget.ownerDocument
        if (
          activeElement instanceof HTMLElement &&
          activeElement.hasAttribute("data-ai-quick-command-tab")
        ) {
          event.currentTarget.focus({ preventScroll: true })
        }
        // 菜单不夺焦（§3.3 焦点始终留在业务 textarea）：按下不转移焦点。
        event.preventDefault()
      }}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        if (event.detail > 0 && !active) {
          const tabs = Array.from(
            event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
              "[data-ai-quick-command-tab]",
            ) ?? [],
          )
          const currentIndex = tabs.findIndex(
            (tab) => tab.dataset.value === activeValue,
          )
          const nextIndex = tabs.indexOf(event.currentTarget)
          rootContext?.requestContentMotion(
            nextIndex < currentIndex ? -1 : 1,
            true,
          )
        }
        setValue(value)
      }}
      className={cn(
        "relative z-[1] shrink-0 rounded-full border border-transparent px-2.5 py-0.5 text-sm font-medium",
        active
          ? "text-foreground"
          : "text-muted-foreground pointer-fine:hover:text-foreground",
        "focus-visible:border-ring focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
})
AiQuickCommandTab.displayName = "AiQuickCommandTab"

export type AiQuickCommandListProps = React.ComponentPropsWithoutRef<
  typeof CommandPrimitive.List
>

const AiQuickCommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  AiQuickCommandListProps
>(({ className, ...props }, ref) => {
  const rootContext = React.useContext(AiQuickCommandContext)
  const revision = rootContext?.contentMotionRevision ?? 0
  const direction = rootContext?.contentMotionDirection ?? 1
  const animated = rootContext?.contentMotionAnimated ?? true
  const [listRef, mergedRef] =
    useMergedRef<React.ElementRef<typeof CommandPrimitive.List>>(ref)
  const motionAnimationRef = React.useRef<Animation | null>(null)

  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list || revision === 0) return

    const previousAnimation = motionAnimationRef.current
    const previousIsRunning = previousAnimation?.playState === "running"
    const fromTransform = previousIsRunning
      ? getComputedStyle(list).transform
      : `translate3d(${direction * CONTENT_IN_OFFSET_PX}px, 0, 0)`
    previousAnimation?.cancel()
    motionAnimationRef.current = null
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    if (!animated || reduceMotion) return

    // 上一段还在跑就从它的当前值接着走，避免连点 tab 时跳帧。
    const animation = list.animate(
      [{ transform: fromTransform }, { transform: "translate3d(0, 0, 0)" }],
      {
        duration: CONTENT_IN_DURATION_MS,
        easing: CONTENT_IN_EASING,
      },
    )
    animation.id = CONTENT_IN_ANIMATION_ID
    motionAnimationRef.current = animation
    animation.finished
      .then(() => {
        if (motionAnimationRef.current !== animation) return
        motionAnimationRef.current = null
      })
      .catch(() => undefined)
  }, [animated, listRef, direction, revision])

  React.useEffect(
    () => () => {
      motionAnimationRef.current?.cancel()
    },
    [],
  )

  return (
    <CommandList
      ref={mergedRef}
      data-slot="ai-quick-command-list"
      data-content-direction={revision === 0 ? undefined : direction}
      className={cn(
        "max-h-72 shrink-0 rounded-b-2xl bg-popover p-1.5 data-[resizing]:overflow-y-hidden",
        className,
      )}
      {...props}
    />
  )
})
AiQuickCommandList.displayName = "AiQuickCommandList"

export type AiQuickCommandGroupProps = React.ComponentPropsWithoutRef<
  typeof CommandPrimitive.Group
>

const AiQuickCommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  AiQuickCommandGroupProps
>(({ className, ...props }, ref) => (
  // List 已有 p-1.5，去掉 shadcn Group 默认 p-1 避免双层缩进；保留分组标题样式。
  <CommandGroup ref={ref} className={cn("p-0", className)} {...props} />
))
AiQuickCommandGroup.displayName = "AiQuickCommandGroup"

const AiQuickCommandItemVariantContext = React.createContext<
  "rich" | "compact"
>("compact")

export interface AiQuickCommandItemProps extends React.ComponentPropsWithoutRef<
  typeof CommandPrimitive.Item
> {
  /** 右侧 muted 补充说明：compact 置于同行尾随，rich 置于第二行 */
  description?: React.ReactNode
  /** "rich" = icon 块 + 两行（qc-02 上例，须搭配 AiQuickCommandItemIcon）；"compact" = 单行。默认 "compact" */
  variant?: "rich" | "compact"
}

const AiQuickCommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  AiQuickCommandItemProps
>(
  (
    { className, variant = "compact", description, children, ...props },
    ref,
  ) => (
    <AiQuickCommandItemVariantContext.Provider value={variant}>
      <CommandItem
        ref={ref}
        data-slot="ai-quick-command-item"
        data-variant={variant}
        className={cn(
          "group/qc-item data-[selected=true]:bg-accent/50",
          "transition-transform duration-100 ease-press pointer-fine:active:scale-[0.97] motion-reduce:transition-none",
          // rich 用 grid 双列：ItemIcon 跨两行、主文本（裸文本节点继承字体样式）
          // 与 description 依次落入右列两行；主文本含多个节点时业务自行包一层 span。
          variant === "rich"
            ? "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 rounded-md p-2.5 text-sm font-medium"
            : "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm",
          className,
        )}
        {...props}
      >
        {children}
        {description != null && (
          <span
            className={cn(
              "truncate text-xs text-muted-foreground",
              variant === "rich" && "col-start-2 font-normal",
            )}
          >
            {description}
          </span>
        )}
      </CommandItem>
    </AiQuickCommandItemVariantContext.Provider>
  ),
)
AiQuickCommandItem.displayName = "AiQuickCommandItem"

export type AiQuickCommandItemIconProps = React.HTMLAttributes<HTMLSpanElement>

const AiQuickCommandItemIcon = React.forwardRef<
  HTMLSpanElement,
  AiQuickCommandItemIconProps
>(({ className, ...props }, ref) => {
  const variant = React.useContext(AiQuickCommandItemVariantContext)

  return (
    <span
      ref={ref}
      data-slot="ai-quick-command-item-icon"
      aria-hidden="true"
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0",
        "origin-center transition-transform duration-120 ease-press motion-reduce:transition-none",
        "pointer-fine:group-hover/qc-item:scale-[1.04]",
        // rich icon 块高亮转 brand：story 草案笔误写作 text-primary（近黑），
        // 按 DESIGN「Brand ≠ Primary」与 qc-02 截图（indigo）取 text-brand-foreground。
        variant === "rich" &&
          "row-span-2 size-9 rounded-lg border border-border bg-background group-data-[selected=true]/qc-item:text-brand-foreground",
        className,
      )}
      {...props}
    />
  )
})
AiQuickCommandItemIcon.displayName = "AiQuickCommandItemIcon"

export type AiQuickCommandEmptyProps = React.ComponentPropsWithoutRef<
  typeof CommandPrimitive.Empty
>

// 无结果占位，文案由业务经 children 传入（DEC-021 无内置文案）。
const AiQuickCommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  AiQuickCommandEmptyProps
>(({ className, ...props }, ref) => (
  <CommandEmpty
    ref={ref}
    className={cn("py-6 text-center text-sm text-muted-foreground", className)}
    {...props}
  />
))
AiQuickCommandEmpty.displayName = "AiQuickCommandEmpty"

export type AiQuickCommandFooterProps = React.HTMLAttributes<HTMLDivElement>
const AiQuickCommandFooter = React.forwardRef<
  HTMLDivElement,
  AiQuickCommandFooterProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="ai-quick-command-footer"
    className={cn(
      "relative flex shrink-0 items-center gap-4 border-border bg-muted px-3 py-2 text-xs text-muted-foreground before:pointer-events-none before:absolute before:-inset-x-px before:-top-4 before:h-4 before:rounded-b-2xl before:border-x before:border-b before:border-border before:shadow-sm",
      className,
    )}
    {...props}
  />
))
AiQuickCommandFooter.displayName = "AiQuickCommandFooter"

export interface AiQuickCommandHintProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 按键符号列表，如 ["←","→"]、["↵"]，逐个渲染为 <kbd>；label 经 children 传入（DEC-021） */
  keys?: React.ReactNode[]
}
const AiQuickCommandHint = React.forwardRef<
  HTMLDivElement,
  AiQuickCommandHintProps
>(({ className, keys, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-1", className)}
    {...props}
  >
    {children}
    {keys != null && keys.length > 0 && (
      <span className="flex items-center gap-0.5">
        {/* 先造带 id 的数据再 map，避免 JSX key 直接用 index（react/no-array-index-key） */}
        {keys
          .map((node, index) => ({ id: `key-${index}`, node }))
          .map(({ id, node }) => (
            <kbd
              key={id}
              className="min-w-4 rounded-sm border border-border bg-muted/50 px-0.5 py-0 text-center text-xs leading-4"
            >
              {node}
            </kbd>
          ))}
      </span>
    )}
  </div>
))
AiQuickCommandHint.displayName = "AiQuickCommandHint"

export {
  AiQuickCommand,
  AiQuickCommandEmpty,
  AiQuickCommandFooter,
  AiQuickCommandGroup,
  AiQuickCommandHint,
  AiQuickCommandItem,
  AiQuickCommandItemIcon,
  AiQuickCommandList,
  AiQuickCommandTab,
  AiQuickCommandTabs,
}
