export const PILL_ID_ATTR = "data-pill-id"
export const PILL_LABEL_ATTR = "data-pill-label"
export const PILL_VALUE_ATTR = "data-pill-value"
export const PILL_VARIANT_ATTR = "data-pill-variant"
export const PILL_STATUS_ATTR = "data-pill-status"

export type AiPromptInputPillVariant = "slot" | "entity" | "attachment"
export type AiPromptInputPillStatus = "placeholder" | "filled"

export interface AiPromptInputPill {
  id: string
  /** 展示文案（如 "[数据库]"、"@r-2xlarge-1"、"transactions.csv"） */
  label: string
  /** 业务载荷，可与 label 不同（如 fileId、实例 ID）；不参与展示与纯文本降级 */
  value?: string
  /** 视觉形态；缺省 "entity"（DEC-040） */
  variant?: AiPromptInputPillVariant
  /** 填没填；缺省按是否有非空 value 推导（DEC-040） */
  status?: AiPromptInputPillStatus
}

export type AiPromptInputPillSegment = { type: "pill" } & AiPromptInputPill

export type AiPromptInputSegment =
  { type: "text"; text: string } | AiPromptInputPillSegment

export type HostEntry = {
  el: HTMLElement
  label: string
  value?: string
  variant: AiPromptInputPillVariant
  status: AiPromptInputPillStatus
}

export const PILL_VARIANTS: ReadonlySet<string> = new Set([
  "slot",
  "entity",
  "attachment",
])
export const PILL_STATUSES: ReadonlySet<string> = new Set([
  "placeholder",
  "filled",
])

export function resolvePillVariant(
  pill: Pick<AiPromptInputPill, "variant">,
): AiPromptInputPillVariant {
  return pill.variant ?? "entity"
}

export function resolvePillStatus(
  pill: Pick<AiPromptInputPill, "status" | "value">,
): AiPromptInputPillStatus {
  if (pill.status) return pill.status
  return pill.value != null && pill.value !== "" ? "filled" : "placeholder"
}

export function toHostEntry(
  el: HTMLElement,
  pill: AiPromptInputPill,
): HostEntry {
  return {
    el,
    label: pill.label,
    value: pill.value,
    variant: resolvePillVariant(pill),
    status: resolvePillStatus(pill),
  }
}

export function readPillSegment(node: HTMLElement): AiPromptInputPillSegment {
  const value = node.getAttribute(PILL_VALUE_ATTR)
  const variantAttr = node.getAttribute(PILL_VARIANT_ATTR)
  const statusAttr = node.getAttribute(PILL_STATUS_ATTR)
  const variant =
    variantAttr && PILL_VARIANTS.has(variantAttr)
      ? (variantAttr as AiPromptInputPillVariant)
      : undefined
  const status =
    statusAttr && PILL_STATUSES.has(statusAttr)
      ? (statusAttr as AiPromptInputPillStatus)
      : undefined
  const pill: AiPromptInputPill = {
    id: node.getAttribute(PILL_ID_ATTR) ?? "",
    label: node.getAttribute(PILL_LABEL_ATTR) ?? "",
    ...(value !== null ? { value } : {}),
    ...(variant ? { variant } : {}),
    ...(status ? { status } : {}),
  }
  return {
    type: "pill",
    ...pill,
    variant: resolvePillVariant(pill),
    status: resolvePillStatus(pill),
  }
}

export function readSegmentsFromDom(root: HTMLElement): AiPromptInputSegment[] {
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
  const nodes = Array.from(root.childNodes)
  nodes.forEach((node, index) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent ?? "")
      return
    }
    if (node instanceof HTMLElement && node.hasAttribute(PILL_ID_ATTR)) {
      segments.push(readPillSegment(node))
      return
    }
    if (node instanceof HTMLBRElement) {
      // 末尾 <br> 视为浏览器填充符（bogus br），不映射为换行——否则空编辑器
      // 会残留 "\n"、placeholder 失效；非末尾 <br> 才是用户 Shift+Enter 换行。
      if (index === nodes.length - 1) return
      pushText("\n")
      return
    }
    // 其余元素（粘贴兜底残留等）降级取纯文本——纯文本路径保障
    pushText(node.textContent ?? "")
  })
  return segments
}

export function createPillHostElement(pill: AiPromptInputPill): HTMLElement {
  const span = document.createElement("span")
  const variant = resolvePillVariant(pill)
  const status = resolvePillStatus(pill)
  span.setAttribute(PILL_ID_ATTR, pill.id)
  span.setAttribute(PILL_LABEL_ATTR, pill.label)
  // value 缺省不写属性（读回时以属性缺失区分 undefined 与空串）
  if (pill.value != null) span.setAttribute(PILL_VALUE_ATTR, pill.value)
  span.setAttribute(PILL_VARIANT_ATTR, variant)
  span.setAttribute(PILL_STATUS_ATTR, status)
  span.setAttribute("contenteditable", "false")
  return span
}

/** 把 pill 字段写回宿主 DOM（updatePill 用；不碰文本节点） */
export function writePillHostAttributes(
  el: HTMLElement,
  pill: Pick<AiPromptInputPill, "label" | "value" | "variant" | "status"> & {
    label: string
  },
) {
  el.setAttribute(PILL_LABEL_ATTR, pill.label)
  if (pill.value != null) el.setAttribute(PILL_VALUE_ATTR, pill.value)
  else el.removeAttribute(PILL_VALUE_ATTR)
  el.setAttribute(PILL_VARIANT_ATTR, resolvePillVariant(pill))
  el.setAttribute(PILL_STATUS_ATTR, resolvePillStatus(pill))
}

/**
 * 拖拽落点归一（DEC-066）：命中另一颗 pill 内部时对齐到那颗 pill 之前，命中被拖的
 * pill 自身则返回 null（不移动）。指示条与实际插入共用此函数，二者不会再各算一套。
 */
export function resolveDropRange(
  root: HTMLElement,
  pillEl: HTMLElement,
  point: { clientX: number; clientY: number },
): Range | null {
  const range = caretRangeAtPoint(point.clientX, point.clientY)
  if (!range || !root.contains(range.startContainer)) return null
  const containerEl =
    range.startContainer instanceof HTMLElement
      ? range.startContainer
      : range.startContainer.parentElement
  const insidePill = containerEl?.closest(`[${PILL_ID_ATTR}]`)
  if (insidePill === pillEl) return null
  if (insidePill) range.setStartBefore(insidePill)
  range.collapse(true)
  return range
}

/**
 * 落点的行内矩形（拖拽指示条用）。collapsed range 落在**元素边界**时 Chrome 返回
 * 空矩形（实测 0x0，落点归一到另一颗 pill 之前时必然如此），退化为取边界处相邻元素
 * 的左/右边缘；取不到则返回 null（调用方隐藏指示条）。
 */
export function dropCaretRect(range: Range): DOMRect | null {
  const rect = range.getBoundingClientRect()
  if (rect.width !== 0 || rect.height !== 0) return rect
  const { startContainer, startOffset } = range
  const after = startContainer.childNodes[startOffset] ?? null
  if (after instanceof HTMLElement) {
    const box = after.getBoundingClientRect()
    return new DOMRect(box.left, box.top, 0, box.height)
  }
  const before =
    startOffset > 0
      ? (startContainer.childNodes[startOffset - 1] ?? null)
      : null
  if (before instanceof HTMLElement) {
    const box = before.getBoundingClientRect()
    return new DOMRect(box.right, box.top, 0, box.height)
  }
  return null
}

/** 把 pill 宿主插入到 client 坐标对应的光标位置（拖拽落点算法） */
export function movePillToPoint(
  root: HTMLElement,
  pillEl: HTMLElement,
  point: { clientX: number; clientY: number },
): boolean {
  const range = resolveDropRange(root, pillEl, point)
  if (!range) return false
  range.insertNode(pillEl)
  placeCaretAfter(pillEl)
  root.focus()
  return true
}

/** collapsed 光标在 side 方向上的起始兄弟节点（光标不贴边时返回 null） */
function caretEdgeSibling(
  root: HTMLElement,
  range: Range,
  side: "before" | "after",
): Node | null {
  const { startContainer, startOffset } = range
  if (startContainer === root) {
    return side === "before"
      ? (root.childNodes[startOffset - 1] ?? null)
      : (root.childNodes[startOffset] ?? null)
  }
  if (startContainer.nodeType !== Node.TEXT_NODE) return null
  const length = startContainer.textContent?.length ?? 0
  if (side === "before" ? startOffset > 0 : startOffset < length) return null
  return side === "before"
    ? startContainer.previousSibling
    : startContainer.nextSibling
}

/** collapsed 光标紧邻方向上的 pill 宿主（跳过空文本节点） */
export function findAdjacentPill(
  root: HTMLElement,
  range: Range,
  side: "before" | "after",
): HTMLElement | null {
  let node = caretEdgeSibling(root, range, side)
  while (node && node.nodeType === Node.TEXT_NODE && !node.textContent) {
    node = side === "before" ? node.previousSibling : node.nextSibling
  }
  return node instanceof HTMLElement && node.hasAttribute(PILL_ID_ATTR)
    ? node
    : null
}

/** caretRangeFromPoint 兼容层（Chrome/Safari vs Firefox） */
export function caretRangeAtPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null
  }
  if (typeof doc.caretRangeFromPoint === "function") {
    return doc.caretRangeFromPoint(x, y)
  }
  const position = doc.caretPositionFromPoint?.(x, y)
  if (!position) return null
  const range = document.createRange()
  range.setStart(position.offsetNode, position.offset)
  range.collapse(true)
  return range
}

export function placeCaretAfter(node: Node) {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

export function placeCaretAtEnd(root: HTMLElement) {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  const last = root.lastChild
  // 末尾是 contenteditable=false 的 pill 时，selectNodeContents+collapse(false)
  // 在 Chrome 等会落到 pill 前；按 lastChild 类型显式落点。
  if (!last) {
    range.setStart(root, 0)
    range.collapse(true)
  } else if (last.nodeType === Node.TEXT_NODE) {
    range.setStart(last, last.textContent?.length ?? 0)
    range.collapse(true)
  } else {
    range.setStartAfter(last)
    range.collapse(true)
  }
  selection.removeAllRanges()
  selection.addRange(range)
}

/** preserve-best-effort：光标前的字符长度（pill 以 label 长度计，<br> 不计） */
export function measurePreCaretLength(root: HTMLElement): number | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer)) return null
  const pre = range.cloneRange()
  pre.selectNodeContents(root)
  pre.setEnd(range.startContainer, range.startOffset)
  return pre.toString().length
}

/** 把光标落到字符偏移 target 处（pill 以 label 长度计，落到 pill 之后） */
export function placeCaretAtLength(root: HTMLElement, target: number) {
  const selection = window.getSelection()
  if (!selection) return
  let remaining = target
  const range = document.createRange()
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0
      if (remaining <= len) {
        range.setStart(node, remaining)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        return
      }
      remaining -= len
    } else if (node instanceof HTMLElement && node.hasAttribute(PILL_ID_ATTR)) {
      const len = (node.getAttribute(PILL_LABEL_ATTR) ?? "").length
      if (remaining <= len) {
        range.setStartAfter(node)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        return
      }
      remaining -= len
    }
  }
  placeCaretAtEnd(root)
}

function resolveHostEntry(
  el: HTMLElement,
  hosts: ReadonlyMap<string, HostEntry>,
): { entry: HostEntry; reused: boolean } {
  const pill = readPillSegment(el)
  const { id } = pill
  const existing = hosts.get(id)
  if (
    existing &&
    existing.el === el &&
    existing.label === pill.label &&
    existing.value === pill.value &&
    existing.variant === pill.variant &&
    existing.status === pill.status
  ) {
    return { entry: existing, reused: true }
  }
  // undo 恢复的快照克隆节点：清掉旧 portal 渲染残渣，换新引用供 portal 重挂载
  if (!existing || existing.el !== el) el.replaceChildren()
  return { entry: toHostEntry(el, pill), reused: false }
}

/**
 * pill 宿主对账：undo 恢复的快照克隆节点在此被「重新收编」，供 portal 重挂载。
 * label/value/variant/status 任一变化都视为需要刷新的宿主。
 */
export function reconcileHosts(
  root: HTMLElement,
  hosts: ReadonlyMap<string, HostEntry>,
): { next: Map<string, HostEntry>; changed: boolean } {
  const domSpans = Array.from(
    root.querySelectorAll<HTMLElement>(`[${PILL_ID_ATTR}]`),
  )
  let changed = domSpans.length !== hosts.size
  const next = new Map<string, HostEntry>()
  for (const el of domSpans) {
    const id = el.getAttribute(PILL_ID_ATTR) ?? ""
    const { entry, reused } = resolveHostEntry(el, hosts)
    next.set(id, entry)
    if (!reused) changed = true
  }
  return { next, changed }
}

/** 在当前光标处（或末尾）插入 pill 宿主元素并把光标移到其后 */
export function insertPillAtCaret(root: HTMLElement, el: HTMLElement): void {
  root.focus()
  const selection = window.getSelection()
  let range: Range
  if (
    selection &&
    selection.rangeCount > 0 &&
    root.contains(selection.getRangeAt(0).startContainer)
  ) {
    range = selection.getRangeAt(0)
    range.deleteContents()
  } else {
    range = document.createRange()
    range.selectNodeContents(root)
    range.collapse(false)
  }
  range.insertNode(el)
  // 末尾插入时垫一个空格作光标落点（与 rebuildDom 一致）——否则 contentEditable
  // 无法稳定停在末尾 pill 之后，用户接着打字光标会落到 pill 前。
  if (!el.nextSibling) {
    el.after(document.createTextNode(" "))
  }
  placeCaretAfter(el)
}

// 换行策略：本组件生成的文本节点直接保留 "\n"，靠容器 white-space: pre-wrap 渲染换行；
// 用户 Shift+Enter 时浏览器插入 <br>，由 readSegmentsFromDom 的 <br>→"\n" 归一化。
// 二者读回都是 "\n"，双向一致，且避免自造 <br> 引入的填充符/复杂度。

/** 外部覆写：整棵重建 DOM，返回新的宿主注册表 */
export function rebuildDom(
  root: HTMLElement,
  segments: AiPromptInputSegment[],
): Map<string, HostEntry> {
  root.replaceChildren()
  const next = new Map<string, HostEntry>()
  for (const segment of segments) {
    if (segment.type === "text") {
      if (segment.text) root.appendChild(document.createTextNode(segment.text))
    } else {
      const el = createPillHostElement(segment)
      root.appendChild(el)
      next.set(segment.id, toHostEntry(el, segment))
    }
  }
  // 末尾若是 pill，垫一个空格作光标落点——否则 contentEditable 无法稳定停在 pill 后
  const last = root.lastChild
  if (last instanceof HTMLElement && last.hasAttribute(PILL_ID_ATTR)) {
    root.appendChild(document.createTextNode(" "))
  }
  return next
}

export function segmentsToPlainText(segments: AiPromptInputSegment[]): string {
  // 纯文本降级：pill 只出 label，value 载荷不出现（与 Root value 镜像规则一致）
  return segments
    .map((segment) => (segment.type === "text" ? segment.text : segment.label))
    .join("")
}
