import * as React from "react"

import {
  insertSegmentsAtSelection,
  readSegmentsFromClipboard,
  readSegmentsFromRange,
  remintPillIds,
  writeSegmentsToClipboard,
} from "./prompt-input-pill-clipboard-dom"

/**
 * copy/cut/paste：选区含 pill 时把 segments 写入剪贴板并在粘贴时还原，
 * 修复 Ctrl+X → Ctrl+V 把 pill 摊成纯文本的问题。value/variant/status 随 JSON 保真。
 */
export function usePromptInputClipboard(deps: {
  rootRef: React.RefObject<HTMLDivElement | null>
  structuralInputRef: React.MutableRefObject<boolean>
  syncFromDom: () => void
}) {
  const { rootRef, structuralInputRef, syncFromDom } = deps
  const handleCopyOrCut = React.useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>, isCut: boolean) => {
      const root = rootRef.current
      const selection = window.getSelection()
      if (
        !root ||
        !selection ||
        selection.isCollapsed ||
        !event.clipboardData
      ) {
        return
      }
      if (selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      if (!root.contains(range.commonAncestorContainer)) return
      const segments = readSegmentsFromRange(range)
      if (segments.length === 0) return
      // 选区无 pill 时放行浏览器默认（纯文本路径零干预）
      if (!segments.some((segment) => segment.type === "pill")) return
      event.preventDefault()
      writeSegmentsToClipboard(event.clipboardData, segments)
      if (isCut) {
        // 剪贴板已写好；删除为结构编辑，打标使随后 execCommand 的 input 记为独立步（DEC-044）
        structuralInputRef.current = true
        document.execCommand("delete")
      }
    },
    [rootRef, structuralInputRef],
  )

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault()
      const root = rootRef.current
      if (!root || !event.clipboardData) return
      const rich = readSegmentsFromClipboard(event.clipboardData)
      if (rich && rich.length > 0) {
        // 重发 pill id，避免重复粘贴撞 id；插入后 sync 收编宿主（structural 独立步）
        insertSegmentsAtSelection(root, remintPillIds(rich))
        syncFromDom()
        return
      }
      // 外部纯文本 / 富文本：只留 plain；粘贴为结构编辑，打标使 execCommand 的 input 记为独立步
      const text = event.clipboardData.getData("text/plain")
      if (text) {
        structuralInputRef.current = true
        document.execCommand("insertText", false, text)
      }
    },
    [rootRef, structuralInputRef, syncFromDom],
  )

  return {
    onCopy: (event: React.ClipboardEvent<HTMLDivElement>) =>
      handleCopyOrCut(event, false),
    onCut: (event: React.ClipboardEvent<HTMLDivElement>) =>
      handleCopyOrCut(event, true),
    onPaste: handlePaste,
  }
}
