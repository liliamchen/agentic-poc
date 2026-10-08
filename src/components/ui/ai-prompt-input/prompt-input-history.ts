import * as React from "react"

import type {
  AiPromptInputPillSegment,
  AiPromptInputSegment,
} from "./prompt-input-pill-dom"
import {
  measurePreCaretLength,
  segmentsToPlainText,
} from "./prompt-input-pill-dom"

// ============================================================================
// DEC-044 自研 segments 快照 undo/redo 栈（取代浏览器原生 contentEditable undo 栈）。
//
// 为什么不再用原生栈：原「半原生半程序化」模型里，打字/删除走原生栈，而 insertPill /
// 拖拽 / 富文本粘贴走 range.insertNode 绕过原生栈——原生栈内部快照与真实 DOM 脱节，
// 导致 pill 插入撤不掉、撤销回放旧 diff 把内容错位追加、纯文本撤销粒度只能听浏览器
// （一次一大块）。自研快照栈把所有编辑统一入栈，粒度可控、行为可预测。
//
// 硬前提对照（DEC-038 硬前提 3 不回退）：记快照是只读遍历（DOM→segments），打字期间
// 不反向重写 DOM；仅在「撤销/重做」这一显式用户动作时才 state→DOM 覆写（复用 applyReset
// → rebuildDom 通道，与 reset() 同性质）。IME 组合期间不接管键盘（交回输入法）。
// ============================================================================

export type HistoryCommitKind = "type" | "structural" | "baseline" | "suppress"

type Snapshot = {
  segments: AiPromptInputSegment[]
  /** 光标字符偏移（pill 以 label 长度计）；撤销/重做后 best-effort 还原 */
  caret: number
}

/** 撤销/重做回放：把快照落回 DOM 并把光标放到字符偏移 caret 处 */
export type ApplySnapshot = (
  segments: AiPromptInputSegment[],
  caret: number,
) => void

// 连续打字合并窗口：同类打字在此毫秒内合并为一个撤销步；停顿或键入空白即断点（词级粒度）。
const TYPING_COALESCE_MS = 500
// 历史栈上限，防止长时间编辑无限增长。
const HISTORY_LIMIT = 200

function snapshotCaret(
  root: HTMLElement,
  segments: AiPromptInputSegment[],
): number {
  // 无有效选区时（如外部 baseline 覆写）退化为落到内容末尾。
  return measurePreCaretLength(root) ?? segmentsToPlainText(segments).length
}

// segments 内容等价判断：仅内容变化才产生撤销步，避免拖拽落回原位 / 无实质变更的
// updatePill 等 no-op 污染历史栈（DEC-044）。光标移动不算内容变化。
function pillSegmentEqual(
  x: AiPromptInputPillSegment,
  y: AiPromptInputPillSegment,
): boolean {
  return (
    x.id === y.id &&
    x.label === y.label &&
    x.value === y.value &&
    x.variant === y.variant &&
    x.status === y.status
  )
}

function segmentEqual(
  x: AiPromptInputSegment,
  y: AiPromptInputSegment,
): boolean {
  if (x.type !== y.type) return false
  if (x.type === "text" && y.type === "text") return x.text === y.text
  if (x.type === "pill" && y.type === "pill") return pillSegmentEqual(x, y)
  return false
}

function segmentsEqual(
  a: AiPromptInputSegment[],
  b: AiPromptInputSegment[],
): boolean {
  if (a.length !== b.length) return false
  return a.every((seg, i) => segmentEqual(seg, b[i]))
}

export type PromptInputHistory = {
  /**
   * 记录一次编辑后的状态。
   * - "type"：打字，`TYPING_COALESCE_MS` 内且非空白边界时与上一步合并；
   * - "structural"：pill 增删改 / 拖拽 / 剪贴板 / 命令式 reset() 等，独立成步；
   * - "baseline"：外部 value 桥接（如提交后 setValue("")），清空历史当作新文档；
   * - "suppress"：撤销/重做自身回放，不记录。
   *
   * 内容与当前快照等价（segmentsEqual）时不产生撤销步，仅同步光标。
   */
  commit: (
    segments: AiPromptInputSegment[],
    kind: HistoryCommitKind,
    options?: { boundary?: boolean },
  ) => void
  undo: (apply: ApplySnapshot) => void
  redo: (apply: ApplySnapshot) => void
}

// 连续打字合并判定：仅同为 "type" 且在合并窗口内、非空白断点时才与上一步合并。
function canCoalesceTyping(args: {
  kind: HistoryCommitKind
  lastKind: HistoryCommitKind | null
  elapsed: number
  boundary?: boolean
}): boolean {
  return (
    args.kind === "type" &&
    args.lastKind === "type" &&
    args.elapsed < TYPING_COALESCE_MS &&
    !args.boundary
  )
}

export function usePromptInputHistory(
  rootRef: React.RefObject<HTMLDivElement | null>,
  initialSegments: AiPromptInputSegment[],
): PromptInputHistory {
  const undoStackRef = React.useRef<Snapshot[]>([])
  const redoStackRef = React.useRef<Snapshot[]>([])
  const currentRef = React.useRef<Snapshot>({
    segments: initialSegments,
    caret: segmentsToPlainText(initialSegments).length,
  })
  const lastKindRef = React.useRef<HistoryCommitKind | null>(null)
  const lastTypeAtRef = React.useRef(0)

  const commit = React.useCallback<PromptInputHistory["commit"]>(
    (segments, kind, options) => {
      if (kind === "suppress") return
      const root = rootRef.current
      if (!root) return

      if (kind === "baseline") {
        undoStackRef.current = []
        redoStackRef.current = []
        currentRef.current = { segments, caret: snapshotCaret(root, segments) }
        lastKindRef.current = null
        return
      }

      // 内容无实质变化（拖拽落回原位 / 无变更 updatePill 等）：不入栈，仅同步光标，
      // 避免用户 Ctrl+Z 撤到一个视觉无差别的步。
      if (segmentsEqual(segments, currentRef.current.segments)) {
        currentRef.current = {
          segments,
          caret: snapshotCaret(root, segments),
        }
        return
      }

      const now = Date.now()
      const canCoalesce = canCoalesceTyping({
        kind,
        lastKind: lastKindRef.current,
        elapsed: now - lastTypeAtRef.current,
        boundary: options?.boundary,
      })
      if (!canCoalesce) {
        undoStackRef.current.push(currentRef.current)
        if (undoStackRef.current.length > HISTORY_LIMIT) {
          undoStackRef.current.shift()
        }
        // 任何新编辑作废重做栈
        redoStackRef.current = []
      }
      currentRef.current = { segments, caret: snapshotCaret(root, segments) }
      lastKindRef.current = kind
      if (kind === "type") lastTypeAtRef.current = now
    },
    [rootRef],
  )

  const undo = React.useCallback<PromptInputHistory["undo"]>((apply) => {
    const target = undoStackRef.current.pop()
    if (!target) return
    redoStackRef.current.push(currentRef.current)
    currentRef.current = target
    // 撤销后下一次打字不与撤销前的步合并
    lastKindRef.current = null
    apply(target.segments, target.caret)
  }, [])

  const redo = React.useCallback<PromptInputHistory["redo"]>((apply) => {
    const target = redoStackRef.current.pop()
    if (!target) return
    undoStackRef.current.push(currentRef.current)
    currentRef.current = target
    lastKindRef.current = null
    apply(target.segments, target.caret)
  }, [])

  return React.useMemo(() => ({ commit, undo, redo }), [commit, undo, redo])
}

// 从 keydown 解析 undo/redo 意图：Cmd/Ctrl+Z=undo，Cmd+Shift+Z / Ctrl+Y=redo。
function resolveHistoryAction(event: KeyboardEvent): "undo" | "redo" | null {
  if (!(event.metaKey || event.ctrlKey)) return null
  const key = event.key.toLowerCase()
  if (key === "y") return "redo"
  if (key !== "z") return null
  return event.shiftKey ? "redo" : "undo"
}

// 键盘接管：native keydown 拦截 undo/redo，preventDefault 掉浏览器原生 undo；
// IME 组合期间不接管。不占用 React onKeyDown 透传（DEC-036）。
export function useHistoryKeymap(deps: {
  rootRef: React.RefObject<HTMLDivElement | null>
  isComposingRef: React.MutableRefObject<boolean>
  history: PromptInputHistory
  applySnapshot: ApplySnapshot
}) {
  const { rootRef, isComposingRef, history, applySnapshot } = deps

  React.useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = resolveHistoryAction(event)
      if (!action) return
      // IME 组合期间交给输入法（compositionstart 到 end 之间不接管）
      if (event.isComposing || isComposingRef.current) return
      event.preventDefault()
      if (action === "redo") history.redo(applySnapshot)
      else history.undo(applySnapshot)
    }
    root.addEventListener("keydown", handleKeyDown)
    return () => root.removeEventListener("keydown", handleKeyDown)
  }, [rootRef, isComposingRef, history, applySnapshot])
}
