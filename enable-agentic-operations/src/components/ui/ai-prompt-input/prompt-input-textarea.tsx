import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

import { useAiPromptInputContext } from "./prompt-input-root"
import type {
  AiPromptInputPill,
  AiPromptInputSegment,
  HostEntry,
} from "./prompt-input-pill-dom"
import {
  measurePreCaretLength,
  placeCaretAtEnd,
  placeCaretAtLength,
  readSegmentsFromDom,
  rebuildDom,
  reconcileHosts,
  resolvePillStatus,
  resolvePillVariant,
  segmentsToPlainText,
  toHostEntry,
} from "./prompt-input-pill-dom"
import {
  PromptInputPillPortals,
  type AiPromptInputPillRenderContext,
} from "./prompt-input-pill"
import { usePromptInputClipboard } from "./prompt-input-clipboard"
import { ScrollEdgeFades, useScrollEdges } from "./prompt-input-scroll-edges"
import { useDragReorder } from "./use-drag-reorder"
import {
  useBeforeInput,
  useEditorEventHandlers,
  useEditorHandle,
  useEditorNodeRef,
  usePillInteraction,
  useValueBridge,
  type AiPromptInputPillPatch,
} from "./prompt-input-hooks"
import {
  useHistoryKeymap,
  usePromptInputHistory,
  type HistoryCommitKind,
} from "./prompt-input-history"

// ============================================================================
// DEC-038 行内 pill 可编辑区（原生 contentEditable + Selection/Range，无编辑器内核）。
// 由 spike 验证品移植合并进 ai-prompt-input（AiPromptInputTextarea 本体）。
//
// 硬前提落地对照（DEC-038，移植时保持不回退）：
// 1. segments 数据模型：DOM 仅为渲染结果，可序列化、runtime 无关；
// 2. 非受控 DOM + 事件驱动同步：初始 children 只渲染一次，之后 DOM 归浏览器；
//    打字期间同步方向仅 DOM→segments（只读遍历），state→DOM 覆写仅发生在
//    外部受控 value 变化时（见 useValueBridge）；
// 3. 纯文本路径零干预：beforeinput 只拦「相邻 pill 删除 / Enter 提交」，
//    IME 组合全过程与 Shift+Enter 换行交给浏览器（见 useBeforeInput）；
// 4. pill 经 createPortal 渲染进 contenteditable=false 宿主 span；
// 5. pill 删除走 Selection + execCommand("delete")（触发 input 事件，由自研历史栈记录，DEC-044）。
//
// undo/redo（DEC-044）：不再依赖浏览器原生 undo 栈，改用 prompt-input-history 的 segments
// 快照栈统一记录所有编辑，keydown 接管 Cmd/Ctrl+Z 与 Cmd+Shift+Z / Ctrl+Y。
//
// 行内垂直对齐（DEC-066）：编辑器行高 leading-6 是本组件的对位基准，凡与编辑器内文字
// 对位的盒子都要显式贴合它，别指望工具类默认值。
// - pill 宿主：inline-flex（无行内 strut）+ align-top，各形态默认皮盒高恒为 24px。半行距
//   对称 ⇒ 盒顶贴行盒顶时 pill 内文字基线与正文基线恒等（与字体度量无关）。不可退回
//   align-baseline：嵌套 inline-flex 的基线由首个 flex 项的 border box 合成，首项是空
//   icon 盒时会偏（实测偏 2px）。
// - placeholder 覆盖层：必须显式 leading-6；只写 text-sm 吃到的是 20px 行高，文字会比
//   光标与正文高 2px（实测光标墨迹 top=3.0/h=17.0，20px 行高下 placeholder 墨迹 top=1.0）。
//
// 相较 spike 的正式化差量（dev-story §3.4）：
// - value≠label 全链路保真（data-pill-value / 剪贴板 / undo 收编）；
// - variant/status 三形态默认皮（DEC-040）；renderPillIcon 主扩展、renderPill 逃逸；
// - Root 字符串 value 与内部 segments 的桥接（lastEmittedValueRef + effect）；
// - updatePill（label+value+variant+status）/ removePill / reset caret 策略；
// - Shift+Enter 换行（<br> ↔ "\n"）；disabled；
// - 高度改用 CSS min/max-height + overflow-y-auto（DEC-029，删除原 scrollHeight 重算）。
// ============================================================================

export interface AiPromptInputTextareaProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  // 组件自持的受控/同步类事件不开放透传，避免业务覆写破坏 segments 同步；
  // onKeyDown 等其余事件（如 `/`、`@` 键盘转发）经 ...props 透传（DEC-036）。
  | "children"
  | "defaultValue"
  | "onInput"
  | "onCopy"
  | "onCut"
  | "onPaste"
  | "onCompositionStart"
  | "onCompositionEnd"
> {
  /** 默认 ""（DEC-021） */
  placeholder?: string
  /** 业务侧受控 placeholder 过渡样式；只作用于覆盖层，不影响编辑器内容。 */
  placeholderClassName?: string
  /** 初始 segments；未提供时按 Root 初始 value 生成纯文本 segment */
  defaultSegments?: AiPromptInputSegment[]
  /** 点击 pill 触发（拖拽后的 click 已被吞掉）；host 供业务浮层 anchor 定位 */
  onPillClick?: (pill: AiPromptInputPill, host: HTMLElement) => void
  /** 换 pill 内图标（主扩展路径，DEC-040）；不传则无 icon */
  renderPillIcon?: (pill: AiPromptInputPill) => React.ReactNode
  /** 整颗自定义 pill（逃逸舱，DEC-040）；拖拽/点击仍由库挂在外层 */
  renderPill?: (ctx: AiPromptInputPillRenderContext) => React.ReactNode
  disabled?: boolean
}

export interface AiPromptInputTextareaHandle {
  /** 在当前光标处插入 pill（光标不在编辑器内则追加到末尾） */
  insertPill: (pill: AiPromptInputPill) => void
  /** 更新 pill 字段：只改属性与 portal 渲染，不触碰文本节点 */
  updatePill: (id: string, patch: AiPromptInputPillPatch) => void
  /** 外部删除单个 pill：原子移除宿主节点，光标不受扰；记为一个可撤销步（DEC-044）；id 不存在时静默 no-op */
  removePill: (id: string) => void
  /**
   * 外部覆写：整棵重建 DOM。caret 缺省 "end"；"preserve-best-effort" 重建前
   * 记录光标的字符偏移，重建后尽力还原。记为一个可撤销步（DEC-044）——`/`、`@` 选中后
   * 剥触发词+插模板/ pill 的规范路径即走此；清空历史只由外部 value 桥接承载。
   */
  reset: (
    segments: AiPromptInputSegment[],
    options?: { caret?: "end" | "preserve-best-effort" },
  ) => void
  getSegments: () => AiPromptInputSegment[]
  focus: () => void
}

type AdoptHost = (pill: AiPromptInputPill, el: HTMLElement) => void

/** 初始 children：只在首渲染求值一次（useState initializer），之后引用恒定。 */
function renderInitialChildren(
  segments: AiPromptInputSegment[],
  adopt: AdoptHost,
): React.ReactNode[] {
  return segments.map((segment, index) => {
    const key = `seg-${index}`
    // 文本里的 "\n" 直接保留，靠容器 white-space: pre-wrap 渲染换行（不自造 <br>）
    if (segment.type === "text") {
      return <React.Fragment key={key}>{segment.text}</React.Fragment>
    }
    const variant = resolvePillVariant(segment)
    const status = resolvePillStatus(segment)
    return (
      <span
        key={key}
        data-pill-id={segment.id}
        data-pill-label={segment.label}
        data-pill-value={segment.value}
        data-pill-variant={variant}
        data-pill-status={status}
        contentEditable={false}
        ref={(el) => {
          if (el) adopt(segment, el)
        }}
      />
    )
  })
}

/**
 * 编辑区类名。自适应高度：contentEditable 块级随内容自然增高，min/max-height + 内滚即可
 * 达到与原 textarea rows=1 + scrollHeight 重算等价的视觉（DEC-029，删除 JS 重算）。
 * min-h-16 对照 composer-02 的 52px 取最近 DESIGN 刻度；max-h-60 对照 240px。
 * pill 宿主对齐不变量见文件头 DEC-066，勿改回 align-baseline。
 */
const editorVariants = cva(
  "max-h-60 min-h-16 w-full overflow-y-auto whitespace-pre-wrap break-words bg-transparent p-0 text-sm leading-6 text-foreground focus:outline-none [&_[data-pill-id]]:inline-flex [&_[data-pill-id]]:items-center [&_[data-pill-id]]:pr-1 [&_[data-pill-id]]:align-top",
  {
    variants: {
      // 收起态压成单行高（内容必为空，见 Root 的 collapsed 判定）
      collapsed: { true: "max-h-6 min-h-0 overflow-hidden", false: "" },
    },
    defaultVariants: { collapsed: false },
  },
)

/**
 * 编辑区外壳。收起态下它是那一行里的中间项（order-1 夹在按钮与发送钮之间），
 * ml-1 把稿内「按钮之间 4px、按钮到文案 8px」的间距补齐（DEC-104）。
 */
const editorShellVariants = cva("relative", {
  variants: {
    collapsed: { true: "order-1 ml-1 h-6 min-w-0 flex-1", false: "w-full" },
  },
  defaultVariants: { collapsed: false },
})

const AiPromptInputTextarea = React.forwardRef<
  AiPromptInputTextareaHandle,
  AiPromptInputTextareaProps
>(
  (
    {
      placeholder = "",
      placeholderClassName,
      defaultSegments,
      onPillClick,
      renderPillIcon,
      renderPill,
      disabled,
      className,
      ...props
    },
    ref,
  ) => {
    const {
      value,
      setValue,
      disabled: rootDisabled,
      submit,
      collapsed,
      registerEditor,
    } = useAiPromptInputContext()
    const isDisabled = Boolean(rootDisabled || disabled)
    const [rootRef, setEditorNode] = useEditorNodeRef(registerEditor)
    const scrollEdges = useScrollEdges(rootRef)
    const isComposingRef = React.useRef(false)
    // 程序化 execCommand（相邻 pill 删除 / cut / 纯文本 paste）打标：其 input 事件由
    // onInput 归为独立 "structural" 步，不与相邻打字合并（DEC-044）。
    const structuralInputRef = React.useRef(false)

    // 初始 segments：defaultSegments 优先，否则由 Root 初始 value 生成纯文本 segment
    const [initialSegments] = React.useState<AiPromptInputSegment[]>(
      () => defaultSegments ?? (value ? [{ type: "text", text: value }] : []),
    )
    // 外部 value 桥接的判别基线：记录最近一次上抛的纯文本镜像
    const lastEmittedValueRef = React.useRef(
      segmentsToPlainText(initialSegments),
    )

    const [hosts, setHosts] = React.useState<ReadonlyMap<string, HostEntry>>(
      new Map(),
    )
    const [empty, setEmpty] = React.useState(() => initialSegments.length === 0)

    // 初始 pill 宿主收编（ref callback 触发；幂等）
    const adoptHost = React.useCallback<AdoptHost>((pill, el) => {
      setHosts((prev) => {
        const next = toHostEntry(el, pill)
        const existing = prev.get(pill.id)
        if (
          existing &&
          existing.el === next.el &&
          existing.label === next.label &&
          existing.value === next.value &&
          existing.variant === next.variant &&
          existing.status === next.status
        ) {
          return prev
        }
        return new Map(prev).set(pill.id, next)
      })
    }, [])

    const [initialChildren] = React.useState(() =>
      renderInitialChildren(initialSegments, adoptHost),
    )

    // 自研 undo/redo 历史栈（DEC-044）；emitFromSegments 每次提交都按 kind 记快照。
    const history = usePromptInputHistory(rootRef, initialSegments)

    // segments → 上抛（纯文本镜像经 context 桥接到 Root value，同步 empty 态）+ 记历史
    const emitFromSegments = React.useCallback(
      (
        segments: AiPromptInputSegment[],
        commit: HistoryCommitKind,
        options?: { boundary?: boolean },
      ) => {
        const plain = segmentsToPlainText(segments)
        lastEmittedValueRef.current = plain
        setEmpty(segments.length === 0)
        setValue(plain)
        history.commit(segments, commit, options)
      },
      [setValue, history],
    )

    // DOM→segments 同步 + pill 宿主对账。commit 缺省 "structural"（拖拽/富文本粘贴等
    // 命令式编辑各自独立成步）；打字路径由 onInput 传 "type" 触发合并（见 handleInput）。
    const syncFromDom = React.useCallback(
      (
        commit: HistoryCommitKind = "structural",
        options?: { boundary?: boolean },
      ) => {
        const root = rootRef.current
        if (!root) return
        const { next, changed } = reconcileHosts(root, hosts)
        if (changed) setHosts(next)
        emitFromSegments(readSegmentsFromDom(root), commit, options)
      },
      [rootRef, hosts, emitFromSegments],
    )

    // 外部覆写（整棵重建 + caret 策略），供 reset handle / value 桥接 / 撤销重做复用。
    // 光标不能在 rebuild 当下同步放置：随后 createPortal 挂载会改 pill 宿主 DOM，
    // 冲掉 selection（表现就是光标跳回 pill 前）。改记 pending，等 hosts commit 后再落。
    const pendingCaretRef = React.useRef<"end" | number | null>(null)
    const applyReset = React.useCallback(
      (
        segments: AiPromptInputSegment[],
        caret: "end" | "preserve-best-effort" | number,
        commit: HistoryCommitKind,
      ) => {
        const root = rootRef.current
        if (!root) return
        let pending: "end" | number
        if (caret === "preserve-best-effort") {
          pending = measurePreCaretLength(root) ?? "end"
        } else {
          pending = caret
        }
        setHosts(rebuildDom(root, segments))
        pendingCaretRef.current = pending
        emitFromSegments(readSegmentsFromDom(root), commit)
      },
      [rootRef, emitFromSegments],
    )

    // 撤销/重做回放：把快照落回 DOM，把光标放到字符偏移处；不再记历史（"suppress"）。
    const applySnapshot = React.useCallback(
      (segments: AiPromptInputSegment[], caret: number) => {
        applyReset(segments, caret, "suppress")
      },
      [applyReset],
    )

    React.useLayoutEffect(() => {
      const pending = pendingCaretRef.current
      if (pending == null) return
      pendingCaretRef.current = null
      const root = rootRef.current
      if (!root) return
      root.focus()
      if (typeof pending === "number") placeCaretAtLength(root, pending)
      else placeCaretAtEnd(root)
    }, [rootRef, hosts])

    useValueBridge({
      value,
      initialSegments,
      lastEmittedValueRef,
      emitFromSegments,
      applyReset,
    })
    useBeforeInput({ rootRef, isComposingRef, structuralInputRef, submit })

    const {
      indicator,
      dragging,
      draggingId,
      consumeDragClick,
      pillPointerHandlers,
    } = useDragReorder(rootRef, hosts, syncFromDom)

    const clipboardHandlers = usePromptInputClipboard({
      rootRef,
      structuralInputRef,
      syncFromDom,
    })

    useEditorHandle(ref, {
      rootRef,
      hosts,
      setHosts,
      emitFromSegments,
      applyReset,
    })

    // 接管 Cmd/Ctrl+Z、Cmd+Shift+Z / Ctrl+Y（DEC-044）
    useHistoryKeymap({ rootRef, isComposingRef, history, applySnapshot })

    const { handlePillMouseDown, handlePillClick } = usePillInteraction(
      consumeDragClick,
      onPillClick,
    )

    // onInput / onCompositionStart / onCompositionEnd：打字/结构编辑分级记历史 + IME 保护
    const editorEventHandlers = useEditorEventHandlers({
      rootRef,
      isComposingRef,
      structuralInputRef,
      syncFromDom,
    })

    return (
      <div className={editorShellVariants({ collapsed })}>
        <div
          {...props}
          ref={setEditorNode}
          role="textbox"
          aria-multiline="true"
          aria-label="Prompt editor"
          aria-disabled={isDisabled || undefined}
          contentEditable={!isDisabled}
          suppressContentEditableWarning
          {...clipboardHandlers}
          {...editorEventHandlers}
          className={cn(
            editorVariants({ collapsed }),
            dragging && "select-none",
            isDisabled && "pointer-events-none opacity-50",
            className,
          )}
        >
          {initialChildren}
        </div>
        {empty && placeholder && (
          // leading-6 须与编辑器同步，见文件头 DEC-066
          <span
            aria-hidden="true"
            data-slot="ai-prompt-input-placeholder"
            className={cn(
              "pointer-events-none absolute left-0 top-0 text-sm leading-6 text-muted-foreground",
              placeholderClassName,
            )}
          >
            {placeholder}
          </span>
        )}
        <ScrollEdgeFades {...scrollEdges} />
        {indicator && (
          <span
            aria-hidden
            data-slot="ai-prompt-input-drop-indicator"
            className="pointer-events-none absolute z-20 w-0.5 origin-center animate-enter-scale-y bg-brand-foreground motion-reduce:animate-none"
            style={{
              left: indicator.left,
              top: indicator.top,
              height: indicator.height,
            }}
          />
        )}
        <PromptInputPillPortals
          hosts={hosts}
          disabled={isDisabled}
          draggingId={draggingId}
          renderPill={renderPill}
          renderPillIcon={renderPillIcon}
          onPillMouseDown={handlePillMouseDown}
          onPillClick={handlePillClick}
          pillPointerHandlers={pillPointerHandlers}
        />
      </div>
    )
  },
)
AiPromptInputTextarea.displayName = "AiPromptInputTextarea"

export { AiPromptInputTextarea }
