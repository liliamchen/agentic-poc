import * as React from "react"

import type {
  AiPromptInputPill,
  AiPromptInputPillStatus,
  AiPromptInputPillVariant,
  AiPromptInputSegment,
  HostEntry,
} from "./prompt-input-pill-dom"
import {
  createPillHostElement,
  findAdjacentPill,
  insertPillAtCaret,
  placeCaretAtEnd,
  readSegmentsFromDom,
  resolvePillStatus,
  toHostEntry,
  writePillHostAttributes,
} from "./prompt-input-pill-dom"
import type { AiPromptInputTextareaHandle } from "./prompt-input-textarea"
import type { HistoryCommitKind } from "./prompt-input-history"

export type AiPromptInputPillPatch = {
  label?: string
  value?: string
  variant?: AiPromptInputPillVariant
  status?: AiPromptInputPillStatus
}

type Caret = "end" | "preserve-best-effort"

type SyncFromDom = (
  commit?: HistoryCommitKind,
  options?: { boundary?: boolean },
) => void

type EmitFromSegments = (
  segments: AiPromptInputSegment[],
  commit: HistoryCommitKind,
) => void
type ApplyReset = (
  segments: AiPromptInputSegment[],
  caret: Caret | number,
  commit: HistoryCommitKind,
) => void

export type EditorHandleDeps = {
  rootRef: React.RefObject<HTMLDivElement | null>
  hosts: ReadonlyMap<string, HostEntry>
  setHosts: React.Dispatch<React.SetStateAction<ReadonlyMap<string, HostEntry>>>
  emitFromSegments: EmitFromSegments
  applyReset: ApplyReset
}

/**
 * 编辑区宿主节点：本地 ref 与 Root 的 registerEditor 各拿一份。
 * Root 拿这份是为了收起态下点容器留白时取焦（DEC-104）。
 */
export function useEditorNodeRef(
  registerEditor: (node: HTMLElement | null) => void,
) {
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const setEditorNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node
      registerEditor(node)
    },
    [registerEditor],
  )
  return [rootRef, setEditorNode] as const
}

// 命令式 API（insertPill / updatePill / removePill / reset / getSegments / focus）
export function useEditorHandle(
  ref: React.ForwardedRef<AiPromptInputTextareaHandle>,
  deps: EditorHandleDeps,
) {
  const { rootRef, hosts, setHosts, emitFromSegments, applyReset } = deps
  React.useImperativeHandle(
    ref,
    () => ({
      insertPill: (pill) => {
        const root = rootRef.current
        if (!root) return
        const el = createPillHostElement(pill)
        insertPillAtCaret(root, el)
        setHosts((prev) => new Map(prev).set(pill.id, toHostEntry(el, pill)))
        emitFromSegments(readSegmentsFromDom(root), "structural")
      },
      updatePill: (id, patch) => {
        const root = rootRef.current
        const entry = hosts.get(id)
        if (!root || !entry) return
        const nextLabel = patch.label ?? entry.label
        const nextValue = "value" in patch ? patch.value : entry.value
        const nextVariant = patch.variant ?? entry.variant
        // 显式 status 优先；仅改 value 时按新 value 重推；否则保留原 status
        let nextStatus = entry.status
        if ("status" in patch && patch.status != null) {
          nextStatus = patch.status
        } else if ("value" in patch) {
          nextStatus = resolvePillStatus({ value: nextValue })
        }
        const nextPill = {
          id,
          label: nextLabel,
          value: nextValue,
          variant: nextVariant,
          status: nextStatus,
        }
        writePillHostAttributes(entry.el, nextPill)
        setHosts((prev) =>
          new Map(prev).set(id, toHostEntry(entry.el, nextPill)),
        )
        emitFromSegments(readSegmentsFromDom(root), "structural")
      },
      removePill: (id) => {
        const root = rootRef.current
        const entry = hosts.get(id)
        if (!root || !entry) return
        entry.el.remove()
        setHosts((prev) => {
          const next = new Map(prev)
          next.delete(id)
          return next
        })
        emitFromSegments(readSegmentsFromDom(root), "structural")
      },
      // reset 是命令式“整棵替换内容”（`/`、`@` 选中后剥触发词+插模板/ pill 的规范路径，
      // DEC-040），记为一个可撤销步（DEC-044）；真正的“新文档=清空历史”只由外部 value
      // 桥接承载（如提交后 setValue("")，见 useValueBridge 的 baseline）。
      reset: (segments, options) =>
        applyReset(segments, options?.caret ?? "end", "structural"),
      getSegments: () => {
        const root = rootRef.current
        return root ? readSegmentsFromDom(root) : []
      },
      focus: () => {
        const root = rootRef.current
        if (!root) return
        const selection = window.getSelection()
        const live =
          selection &&
          selection.rangeCount > 0 &&
          root.contains(selection.anchorNode)
            ? selection.getRangeAt(0).cloneRange()
            : null
        root.focus()
        if (!selection) return
        // 裸 focus() 在无有效选区时会把光标甩到开头（@ 选中后常见）
        if (live) {
          selection.removeAllRanges()
          selection.addRange(live)
        } else {
          placeCaretAtEnd(root)
        }
      },
    }),
    [rootRef, hosts, setHosts, emitFromSegments, applyReset],
  )
}

// 外部 value → 内部 segments 桥接（DEC-038 硬前提 3 允许的「外部受控 value 变化时覆写」）
export function useValueBridge(deps: {
  value: string
  initialSegments: AiPromptInputSegment[]
  lastEmittedValueRef: React.MutableRefObject<string>
  emitFromSegments: EmitFromSegments
  applyReset: ApplyReset
}) {
  const {
    value,
    initialSegments,
    lastEmittedValueRef,
    emitFromSegments,
    applyReset,
  } = deps

  // 首帧把初始 segments 的纯文本镜像上抛，保证 Root value 与初始内容一致。
  // 用 layout effect 在 paint 前完成——否则有 defaultSegments 时首帧 Root value 仍为空，
  // 依赖 value 的 Submit 会先渲染成 disabled 再翻转，出现一帧闪烁。
  const didMountRef = React.useRef(false)
  React.useLayoutEffect(() => {
    if (didMountRef.current) return
    didMountRef.current = true
    // 首帧作为历史基线（不产生撤销步）
    if (initialSegments.length > 0)
      emitFromSegments(initialSegments, "baseline")
  }, [initialSegments, emitFromSegments])

  // 跳过首帧（初始 DOM 已由 initialChildren 渲染正确）；此后 value 若不等于最近上抛的
  // 镜像即判定为外部改写（如提交后 setValue("") 清空），走纯文本重建；相等则打字回声，跳过。
  const bridgeReadyRef = React.useRef(false)
  React.useEffect(() => {
    if (!bridgeReadyRef.current) {
      bridgeReadyRef.current = true
      return
    }
    if (value === lastEmittedValueRef.current) return
    // 外部改写 value 视为“新文档”，清空 undo/redo 历史（DEC-044 baseline）
    applyReset([{ type: "text", text: value }], "end", "baseline")
  }, [value, applyReset, lastEmittedValueRef])
}

// 编辑器事件处理（onInput / onCompositionStart / onCompositionEnd）：
// - onInput：判定打字（"type"，可合并）vs 结构编辑（"structural"，独立步）；IME 组合中
//   只同步 value 不记历史（"suppress"），键入空白字符作为合并断点（boundary）。
// - 程序化 execCommand（相邻 pill 删除 / cut / 纯文本粘贴）由 structuralInputRef 打标，
//   其 input 事件 inputType 与普通打字/删字无法区分，故显式记为独立的 "structural" 步，
//   不与相邻打字合并（DEC-044「结构编辑各自独立成步」）。
// - onCompositionEnd：把整段候选词记为一个撤销步（boundary=true，不与后续打字合并）。
//   此刻 isComposingRef 仍为 true（复位延后到下一帧），组合末尾若有 trailing input 事件
//   仍走 "suppress"，保证一次组合只记一步。Safari 在“确认候选词的 Enter”上 compositionend
//   可能早于该 Enter 的 beforeinput(insertParagraph)，故复位延后到下一帧使其仍落在组合保护
//   窗口内；Chrome 依赖 native.isComposing 判定，不受此延后影响（P0，仍需真机 Safari 手测）。
export function useEditorEventHandlers(deps: {
  rootRef: React.RefObject<HTMLDivElement | null>
  isComposingRef: React.MutableRefObject<boolean>
  structuralInputRef: React.MutableRefObject<boolean>
  syncFromDom: SyncFromDom
}) {
  const { isComposingRef, structuralInputRef, syncFromDom } = deps
  const compositionEndFrameRef = React.useRef<number | null>(null)

  React.useEffect(
    () => () => {
      if (compositionEndFrameRef.current != null) {
        cancelAnimationFrame(compositionEndFrameRef.current)
      }
    },
    [],
  )

  const onInput = React.useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const native = event.nativeEvent as InputEvent
      if (isComposingRef.current) {
        syncFromDom("suppress")
        return
      }
      // 程序化 execCommand 触发的 input：删 pill / cut / 纯文本 paste 归为独立结构步
      if (structuralInputRef.current) {
        structuralInputRef.current = false
        syncFromDom("structural")
        return
      }
      const inputType = native.inputType ?? ""
      const isTyping =
        inputType === "insertText" || inputType.startsWith("delete")
      const boundary =
        inputType === "insertText" && /\s/.test(native.data ?? "")
      syncFromDom(isTyping ? "type" : "structural", { boundary })
    },
    [isComposingRef, structuralInputRef, syncFromDom],
  )

  const onCompositionStart = React.useCallback(() => {
    if (compositionEndFrameRef.current != null) {
      cancelAnimationFrame(compositionEndFrameRef.current)
      compositionEndFrameRef.current = null
    }
    isComposingRef.current = true
  }, [isComposingRef])

  const onCompositionEnd = React.useCallback(() => {
    syncFromDom("type", { boundary: true })
    if (compositionEndFrameRef.current != null) {
      cancelAnimationFrame(compositionEndFrameRef.current)
    }
    compositionEndFrameRef.current = requestAnimationFrame(() => {
      isComposingRef.current = false
      compositionEndFrameRef.current = null
    })
  }, [isComposingRef, syncFromDom])

  return { onInput, onCompositionStart, onCompositionEnd }
}

// 原生 beforeinput：删除类 inputType 不经 React 合成 onBeforeInput，必须原生监听。
// Enter(insertParagraph)=提交；Shift+Enter(insertLineBreak)放行换行；
// 相邻 pill 的 Backspace/Delete 选中整个 span 后 execCommand("delete")；该删除是结构编辑，
// 经 structuralInputRef 打标，由自研历史栈记为独立可撤销步（DEC-044）。
export function useBeforeInput(deps: {
  rootRef: React.RefObject<HTMLDivElement | null>
  isComposingRef: React.MutableRefObject<boolean>
  structuralInputRef: React.MutableRefObject<boolean>
  submit: () => void
}) {
  const { rootRef, isComposingRef, structuralInputRef, submit } = deps
  const deleteAdjacentPill = React.useCallback(
    (native: InputEvent, side: "before" | "after") => {
      const root = rootRef.current
      const selection = window.getSelection()
      if (!root || !selection || selection.rangeCount === 0) return
      if (!selection.isCollapsed) return
      const pill = findAdjacentPill(root, selection.getRangeAt(0), side)
      if (!pill) return
      native.preventDefault()
      const pillRange = document.createRange()
      pillRange.selectNode(pill)
      selection.removeAllRanges()
      selection.addRange(pillRange)
      // 标记随后 execCommand 触发的 input 为结构步（不与相邻打字合并）
      structuralInputRef.current = true
      document.execCommand("delete")
    },
    [rootRef, structuralInputRef],
  )

  React.useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const handleBeforeInput = (native: InputEvent) => {
      // IME 组合期间零干预（纯文本路径保障 P0）
      if (isComposingRef.current || native.isComposing) return
      const { inputType } = native
      if (inputType === "insertParagraph") {
        native.preventDefault()
        submit()
        return
      }
      if (inputType === "deleteContentBackward") {
        deleteAdjacentPill(native, "before")
      } else if (inputType === "deleteContentForward") {
        deleteAdjacentPill(native, "after")
      }
    }
    root.addEventListener("beforeinput", handleBeforeInput)
    return () => root.removeEventListener("beforeinput", handleBeforeInput)
  }, [rootRef, isComposingRef, submit, deleteAdjacentPill])
}

// pill 点击交互：mousedown 时 preventDefault 阻止按钮抢焦/改选区，先存下当前 Range；
// click 时还原 Range 保住光标，再抛 onPillClick；刚完成拖拽的 click 被吞掉。
// （拖拽走 pointer 事件 + setPointerCapture，不受 mousedown 的 preventDefault 影响。）
export function usePillInteraction(
  consumeDragClick: () => boolean,
  onPillClick?: (pill: AiPromptInputPill, host: HTMLElement) => void,
) {
  const savedRangeRef = React.useRef<Range | null>(null)

  const handlePillMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        savedRangeRef.current = selection.getRangeAt(0).cloneRange()
      }
    },
    [],
  )

  const handlePillClick = React.useCallback(
    (pill: AiPromptInputPill, host: HTMLElement) => {
      if (consumeDragClick()) return
      const selection = window.getSelection()
      const saved = savedRangeRef.current
      if (selection && saved) {
        selection.removeAllRanges()
        selection.addRange(saved)
      }
      onPillClick?.(pill, host)
    },
    [consumeDragClick, onPillClick],
  )

  return { handlePillMouseDown, handlePillClick }
}
