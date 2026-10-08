import * as React from "react"

import type { HostEntry } from "./prompt-input-pill-dom"
import {
  dropCaretRect,
  movePillToPoint,
  resolveDropRange,
} from "./prompt-input-pill-dom"

// pill 拖拽重排（DEC-038）：pointer 自研（不用 HTML5 DnD——contentEditable 内原生
// 拖拽跨浏览器极脆），阈值 4px 区分单击/拖拽，落点用 caretRangeFromPoint + 原子节点移动。

export type DropIndicator = { left: number; top: number; height: number }

// 拖拽阈值（px）：小于此位移视为单击（开浮层），超过后进入拖拽重排。
const DRAG_THRESHOLD_PX = 4

type DragSession = {
  id: string
  startX: number
  startY: number
  dragging: boolean
}

export function useDragReorder(
  rootRef: React.RefObject<HTMLDivElement | null>,
  hosts: ReadonlyMap<string, HostEntry>,
  onDropped: () => void,
) {
  const sessionRef = React.useRef<DragSession | null>(null)
  // 进入过拖拽态则吞掉同一次 pointer 的后续 click，避免误开浮层
  const dragOccurredRef = React.useRef(false)
  const [indicator, setIndicator] = React.useState<DropIndicator | null>(null)
  const [draggingId, setDraggingId] = React.useState<string | null>(null)

  // 指示条位置 = resolveDropRange 的实际落点（DEC-066），不另算一套裸 caret
  const updateIndicator = React.useCallback(
    (pillEl: HTMLElement, clientX: number, clientY: number) => {
      const root = rootRef.current
      const range = root
        ? resolveDropRange(root, pillEl, { clientX, clientY })
        : null
      if (!root || !range) {
        setIndicator(null)
        return
      }
      const rect = dropCaretRect(range)
      if (!rect) {
        setIndicator(null)
        return
      }
      const rootRect = root.getBoundingClientRect()
      setIndicator({
        left: rect.left - rootRect.left,
        top: rect.top - rootRect.top,
        height: rect.height || 20,
      })
    },
    [rootRef],
  )

  const endSession = React.useCallback(() => {
    sessionRef.current = null
    setIndicator(null)
    setDraggingId(null)
  }, [])

  const handlePillPointerDown = React.useCallback(
    (id: string, event: React.PointerEvent<HTMLButtonElement>) => {
      // 新一次按下即开启新序列：清掉上一次的拖拽标志（DEC-066）。落点后指针几乎必然
      // 落在 pill 按钮之外（宿主被 insertNode 挪走，click 打到编辑器根），拖拽尾随的
      // click 收不到，标志不能指望 consumeDragClick 来清——否则残留会吞掉用户下一次
      // 真实点击，表现为「拖完点一次不开浮层，点第二次才开」。
      dragOccurredRef.current = false
      // 只响应主指针，避免多指干扰
      if (event.button !== 0) return
      sessionRef.current = {
        id,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [],
  )

  const handlePillPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const session = sessionRef.current
      if (!session) return
      const dx = event.clientX - session.startX
      const dy = event.clientY - session.startY
      if (!session.dragging) {
        if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
        session.dragging = true
        dragOccurredRef.current = true
        setDraggingId(session.id)
      }
      // 拖拽中阻止浏览器选中文本
      event.preventDefault()
      const entry = hosts.get(session.id)
      if (entry) updateIndicator(entry.el, event.clientX, event.clientY)
      else setIndicator(null)
    },
    [hosts, updateIndicator],
  )

  const handlePillPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const session = sessionRef.current
      if (!session) return
      if (session.dragging) {
        const root = rootRef.current
        const entry = hosts.get(session.id)
        if (root && entry) {
          movePillToPoint(root, entry.el, event)
          onDropped()
        }
      }
      endSession()
    },
    [rootRef, hosts, onDropped, endSession],
  )

  const consumeDragClick = React.useCallback(() => {
    if (!dragOccurredRef.current) return false
    dragOccurredRef.current = false
    return true
  }, [])

  return {
    indicator,
    dragging: draggingId !== null,
    draggingId,
    consumeDragClick,
    pillPointerHandlers: (id: string) => ({
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) =>
        handlePillPointerDown(id, event),
      onPointerMove: handlePillPointerMove,
      onPointerUp: handlePillPointerUp,
      onPointerCancel: endSession,
    }),
  }
}
