import type { AiPromptInputSegment } from "./prompt-input-pill-dom"
import {
  PILL_ID_ATTR,
  PILL_STATUSES,
  PILL_VARIANTS,
  createPillHostElement,
  placeCaretAfter,
  readPillSegment,
  segmentsToPlainText,
} from "./prompt-input-pill-dom"

/** 剪贴板自定义 MIME：跨应用可能被剥离，故同时写入 text/html 标记兜底 */
export const CLIPBOARD_SEGMENTS_MIME =
  "application/x-cloudai-inline-pill-segments"
const CLIPBOARD_HTML_MARKER = "cloudai-inline-pill"

function walkNodesToSegments(nodes: NodeList | Node[]): AiPromptInputSegment[] {
  const segments: AiPromptInputSegment[] = []
  const pushText = (text: string) => {
    if (!text) return
    const last = segments[segments.length - 1]
    if (last?.type === "text") {
      last.text += text
    } else {
      segments.push({ type: "text", text })
    }
  }
  Array.from(nodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent ?? "")
      return
    }
    if (node instanceof HTMLElement && node.hasAttribute(PILL_ID_ATTR)) {
      segments.push(readPillSegment(node))
      return
    }
    if (node instanceof HTMLBRElement) {
      pushText("\n")
      return
    }
    pushText(node.textContent ?? "")
  })
  return segments
}

/** 从当前选区提取 segments（含被选中的 pill） */
export function readSegmentsFromRange(range: Range): AiPromptInputSegment[] {
  return walkNodesToSegments(range.cloneContents().childNodes)
}

/** 粘贴时重发 pill id，避免 copy 后重复粘贴撞 id；label/value 原样保留 */
export function remintPillIds(
  segments: AiPromptInputSegment[],
): AiPromptInputSegment[] {
  return segments.map((segment) => {
    if (segment.type !== "pill") return segment
    const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    return { ...segment, id }
  })
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function writeSegmentsToClipboard(
  dataTransfer: DataTransfer,
  segments: AiPromptInputSegment[],
) {
  const plain = segmentsToPlainText(segments)
  const payload = encodeURIComponent(JSON.stringify(segments))
  // JSON 序列化天然携带 value
  dataTransfer.setData(CLIPBOARD_SEGMENTS_MIME, JSON.stringify(segments))
  dataTransfer.setData("text/plain", plain)
  // HTML 兜底：自定义 MIME 在部分环境粘贴时会被剥掉
  dataTransfer.setData(
    "text/html",
    `<!--${CLIPBOARD_HTML_MARKER}:${payload}-->${escapeHtml(plain)}`,
  )
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string"
}

function isValidPillSegment(seg: Record<string, unknown>) {
  return (
    typeof seg.id === "string" &&
    typeof seg.label === "string" &&
    isOptionalString(seg.value) &&
    (seg.variant === undefined || PILL_VARIANTS.has(String(seg.variant))) &&
    (seg.status === undefined || PILL_STATUSES.has(String(seg.status)))
  )
}

// 剪贴板来源不可信（可能被外部程序写入畸形数据），反序列化后必须逐项校验。
function isValidSegments(parsed: unknown): parsed is AiPromptInputSegment[] {
  if (!Array.isArray(parsed)) return false
  return parsed.every((segment) => {
    if (!segment || typeof segment !== "object") return false
    const seg = segment as Record<string, unknown>
    if (seg.type === "text") return typeof seg.text === "string"
    if (seg.type === "pill") return isValidPillSegment(seg)
    return false
  })
}

function parseSegments(raw: string): AiPromptInputSegment[] | null {
  try {
    const parsed = JSON.parse(raw)
    return isValidSegments(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function readSegmentsFromClipboard(
  dataTransfer: DataTransfer,
): AiPromptInputSegment[] | null {
  const raw = dataTransfer.getData(CLIPBOARD_SEGMENTS_MIME)
  if (raw) {
    const parsed = parseSegments(raw)
    if (parsed) return parsed
  }
  const html = dataTransfer.getData("text/html")
  if (!html) return null
  const match = html.match(
    new RegExp(`<!--${CLIPBOARD_HTML_MARKER}:([^>]+)-->`),
  )
  if (!match) return null
  return parseSegments(decodeURIComponent(match[1]))
}

/**
 * 在当前选区插入 segments（先删选区）。
 * 富文本插入走 insertNode，不进原生 undo 栈（与拖拽同限）；纯文本路径仍用 insertText。
 */
export function insertSegmentsAtSelection(
  root: HTMLElement,
  segments: AiPromptInputSegment[],
): void {
  root.focus()
  const selection = window.getSelection()
  let range: Range
  if (
    selection &&
    selection.rangeCount > 0 &&
    root.contains(selection.getRangeAt(0).commonAncestorContainer)
  ) {
    range = selection.getRangeAt(0)
  } else {
    range = document.createRange()
    range.selectNodeContents(root)
    range.collapse(false)
  }
  range.deleteContents()

  const fragment = document.createDocumentFragment()
  let lastNode: Node | null = null
  for (const segment of segments) {
    if (segment.type === "text") {
      if (!segment.text) continue
      lastNode = document.createTextNode(segment.text)
    } else {
      lastNode = createPillHostElement(segment)
    }
    fragment.appendChild(lastNode)
  }
  if (!lastNode) return
  range.insertNode(fragment)
  placeCaretAfter(lastNode)
}
