import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { AiAttachmentChip } from "@/components/ui/ai-attachment"

import type { AiPromptInputPill, HostEntry } from "./prompt-input-pill-dom"
import { resolvePillStatus, resolvePillVariant } from "./prompt-input-pill-dom"

export type AiPromptInputPillRenderContext = {
  pill: AiPromptInputPill
  disabled: boolean
  dragging: boolean
}

type PillPointerHandlers = {
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void
  onPointerCancel: () => void
}

/** portal 交互壳：拖拽/点击挂外层，视觉走默认皮或 renderPill */
export function PromptInputPillHost({
  pill,
  entry,
  disabled,
  dragging,
  content,
  onMouseDown,
  onClick,
  pointerHandlers,
}: {
  pill: AiPromptInputPill
  entry: HostEntry
  disabled: boolean
  dragging: boolean
  content: React.ReactNode
  onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void
  onClick: () => void
  pointerHandlers: PillPointerHandlers
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      aria-label={pill.label}
      data-slot="ai-prompt-input-pill"
      data-pill-variant={entry.variant}
      data-pill-status={entry.status}
      data-dragging={dragging ? "" : undefined}
      className={cn(
        "inline-flex max-w-48 cursor-grab touch-none items-center border-0 bg-transparent p-0 text-left active:cursor-grabbing",
        "transition-pill origin-center animate-enter-pop motion-reduce:animate-none",
        // hover/按压反馈只在精确指针下给，触屏不需要且会与长按拖拽抢反馈。
        "pointer-fine:hover:opacity-[0.82] pointer-fine:active:scale-[0.98]",
        dragging &&
          "-translate-y-0.5 scale-[1.02] cursor-grabbing opacity-[0.72] pointer-fine:hover:opacity-[0.72]",
      )}
      onMouseDown={onMouseDown}
      onClick={onClick}
      {...pointerHandlers}
    >
      {content}
    </button>
  )
}

/**
 * 全部 pill 宿主的 portal 渲染集合：为每个宿主 span 经 createPortal 挂一颗交互壳，
 * 视觉走 renderPill 逃逸舱或默认皮（renderPillIcon 注入图标）。从 Textarea 本体抽出。
 */
export function PromptInputPillPortals({
  hosts,
  disabled,
  draggingId,
  renderPill,
  renderPillIcon,
  onPillMouseDown,
  onPillClick,
  pillPointerHandlers,
}: {
  hosts: ReadonlyMap<string, HostEntry>
  disabled: boolean
  draggingId: string | null
  renderPill?: (ctx: AiPromptInputPillRenderContext) => React.ReactNode
  renderPillIcon?: (pill: AiPromptInputPill) => React.ReactNode
  onPillMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void
  onPillClick: (pill: AiPromptInputPill, host: HTMLElement) => void
  pillPointerHandlers: (id: string) => PillPointerHandlers
}) {
  return (
    <>
      {Array.from(hosts.entries()).map(([id, entry]) => {
        const dragging = draggingId === id
        const pill: AiPromptInputPill = {
          id,
          label: entry.label,
          value: entry.value,
          variant: entry.variant,
          status: entry.status,
        }
        const content = renderPill?.({ pill, disabled, dragging }) ?? (
          <DefaultPromptInputPillContent
            pill={pill}
            icon={renderPillIcon?.(pill)}
          />
        )
        return createPortal(
          <PromptInputPillHost
            pill={pill}
            entry={entry}
            disabled={disabled}
            dragging={dragging}
            content={content}
            onMouseDown={onPillMouseDown}
            onClick={() => onPillClick(pill, entry.el)}
            pointerHandlers={pillPointerHandlers(id)}
          />,
          entry.el,
          id,
        )
      })}
    </>
  )
}

/**
 * 库内置三形态默认皮（DEC-040，对照 qc-03 / qc-05 / attachment-05）。
 * icon 由 renderPillIcon 注入；整颗自定义走 renderPill 逃逸舱。
 */
export function DefaultPromptInputPillContent({
  pill,
  icon,
}: {
  pill: AiPromptInputPill
  icon?: React.ReactNode
}) {
  const variant = resolvePillVariant(pill)
  const status = resolvePillStatus(pill)

  if (variant === "slot" && status === "placeholder") {
    const innerLabel =
      pill.label.startsWith("[") && pill.label.endsWith("]")
        ? pill.label.slice(1, -1)
        : null
    const displayLabel = innerLabel?.trim() ? innerLabel : pill.label

    // 占位空槽：底色与实体一致，文字更浅一档（对照设计稿 qc-03），提示"待填"。
    // h-6 与编辑器 leading-6 等高，配合宿主 align-top 保证与正文基线对齐（DEC-066）。
    return (
      <span className="inline-flex h-6 max-w-48 items-center truncate rounded-md bg-brand-1 px-1.5 text-sm text-brand-foreground/70">
        <span className="truncate">{displayLabel}</span>
      </span>
    )
  }

  if (variant === "attachment") {
    return (
      <AiAttachmentChip
        icon={icon}
        title={pill.label}
        className="pointer-events-none max-w-48"
      />
    )
  }

  // entity，以及 filled 的 slot：Brand 浅色阶底 + Brand 前景色（对照 qc-05 / composer-04）
  return (
    <span className="inline-flex h-6 max-w-48 items-center gap-1 truncate rounded-md bg-brand-1 px-1.5 text-sm text-brand-foreground">
      {icon != null && (
        <span
          aria-hidden="true"
          className="inline-flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5 [&_svg]:shrink-0"
        >
          {icon}
        </span>
      )}
      <span className="truncate">{pill.label}</span>
    </span>
  )
}
