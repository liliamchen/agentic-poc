/*
 * CloudAI UI 页面模板的分发副本。抄进你自己的页面后随便改，那正是模板的用途。
 *
 * 抄进你自己的页面之后随便改，那正是页面模板的用途。契约（不可变量 / 插槽 / 状态 /
 * 响应式 / 滚动归属）见 page-templates/app-shell.md，改之前先读它。
 * 填 SLOT 时对照同目录 app-shell.reference.tsx，不要对着空盒子自己发明结构。
 */
import type { KeyboardEvent } from "react"

/** Radix 默认循环 Tab；产品导航在首尾退出并由 Popover 回焦触发器。 */
export function closeNavAtTabBoundary(
  event: KeyboardEvent<HTMLDivElement>,
  onClose: () => void,
) {
  if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey)
    return
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      "button, a[href], input, select, textarea, [tabindex]",
    ),
  ).filter(
    (item) =>
      item.tabIndex >= 0 &&
      !item.matches(":disabled") &&
      item.getClientRects().length > 0,
  )
  const boundary = event.shiftKey ? items[0] : items[items.length - 1]
  if (!boundary || event.target === boundary) {
    event.preventDefault()
    onClose()
  }
}
