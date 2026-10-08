import * as React from "react"
import { cva } from "class-variance-authority"
import { File, Loader2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

// runtime 无关（DEC-035）：附件展示族只按 props 渲染（title/meta/status/src…），
// 动作只从事件回调出（onRemove）；文件选择、上传请求、进度计算全归业务。
// 文件类型彩色图标经 icon 槽位由业务传入（推荐 @cloudai/icons 的 FileType*，DEC-043/049），
// 组件本体不内置；缺省渲染 lucide File（muted 色）兜底；meta（如 "excel · 1.21 MB"）由业务拼好传入，
// 组件不做字节格式化（DEC-021 语言中性）。列表渲染归业务 map（DEC-036）。

export type AiAttachmentStatus = "ready" | "uploading" | "error"

// 共用右上角悬浮删除钮（Card / Image 配方）：独立可点击区，stopPropagation
// 避免与卡片本体点击（如触发预览）冲突；键盘聚焦时同样可见。
function AiAttachmentRemoveButton({
  onRemove,
  className,
}: {
  onRemove: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label="Remove attachment"
      onClick={(event) => {
        event.stopPropagation()
        onRemove()
      }}
      className={cn(
        "absolute -right-1.5 -top-1.5 z-20 flex size-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground",
        "opacity-0 transition-[opacity,transform,color] duration-150 ease-standard motion-reduce:transition-none",
        "group-focus-within/att:opacity-100 pointer-fine:group-hover/att:opacity-100",
        "pointer-fine:hover:text-foreground pointer-fine:active:scale-[0.97]",
        "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <X className="size-2.5" strokeWidth={1.75} aria-hidden="true" />
    </button>
  )
}

// 状态图标解析：uploading = Loader2 旋转占据 icon 位（§1.2 设计缺口先行版）；
// 未传 icon 时灰色 lucide File 兜底。unsupported 仍保留业务传入的
// FileTypeUnknown 等正式资产（DEC-043），只在展示层做置灰。
function resolveStatusIcon(icon: React.ReactNode, status: AiAttachmentStatus) {
  if (status === "uploading") {
    return (
      <Loader2
        className="animate-spin text-muted-foreground motion-reduce:animate-none"
        strokeWidth={1.75}
        aria-hidden
      />
    )
  }
  if (icon == null) {
    return <File className="text-muted-foreground" strokeWidth={1.75} />
  }
  return icon
}

// 操作区壳：给业务的 DropdownMenu / Button 一个统一的触发器视觉，菜单本体不内置
// （DEC-035：动作与菜单项是业务语义）。Radix 菜单打开后焦点被 portal 带走，
// group-hover 与 group-focus-within 双双失效，靠 has 变体盯住 data-state=open 兜住。
export type AiAttachmentActionButtonProps = Omit<
  React.ComponentPropsWithoutRef<"button">,
  "type"
>

const AiAttachmentActionButton = React.forwardRef<
  HTMLButtonElement,
  AiAttachmentActionButtonProps
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    data-slot="ai-attachment-action-button"
    className={cn(
      "inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0",
      "transition-control pointer-fine:hover:bg-muted pointer-fine:hover:text-foreground pointer-fine:active:scale-[0.97]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      className,
    )}
    {...props}
  />
))
AiAttachmentActionButton.displayName = "AiAttachmentActionButton"

// 紧凑档 = 输入区附件（170×44，历史默认）；fluid 档 = 消息流结果文件，
// 撑满父容器并按设计稿放大排版（标题 14px、图标盒 36）。
const attachmentCardVariants = cva(
  "group/att relative items-center rounded-xl border border-border bg-card",
  {
    variants: {
      fluid: {
        false: "inline-flex h-11 w-[170px] gap-2 p-1",
        true: "flex w-full gap-2 p-1.5 transition-colors duration-150 ease-standard pointer-fine:hover:bg-muted/40 motion-reduce:transition-none",
      },
    },
    defaultVariants: { fluid: false },
  },
)

const attachmentIconVariants = cva(
  "inline-flex shrink-0 items-center justify-center",
  {
    variants: {
      fluid: {
        false: "size-8 bg-transparent [&_svg]:size-6",
        true: "size-9 rounded-lg bg-muted/50 [&_svg]:size-6",
      },
    },
    defaultVariants: { fluid: false },
  },
)

const attachmentTitleVariants = cva("truncate font-normal", {
  variants: {
    fluid: {
      false: "text-xs leading-4 text-foreground",
      true: "text-sm leading-5 text-foreground",
    },
  },
  defaultVariants: { fluid: false },
})

const attachmentActionsVariants = cva("flex shrink-0 items-center gap-1", {
  variants: {
    visibility: {
      always: "",
      // 菜单打开后焦点在 portal 里，group-hover / focus-within 都失效，靠 has 盯 data-state
      hover:
        "opacity-0 transition-opacity duration-150 ease-standard group-focus-within/att:opacity-100 group-has-[[data-state=open]]/att:opacity-100 pointer-fine:group-hover/att:opacity-100 motion-reduce:transition-none",
    },
  },
  defaultVariants: { visibility: "hover" },
})

function AiAttachmentActions({
  actions,
  visibility,
}: {
  actions: React.ReactNode
  visibility?: "hover" | "always"
}) {
  return (
    <span
      data-slot="ai-attachment-actions"
      className={attachmentActionsVariants({ visibility })}
    >
      {actions}
    </span>
  )
}

export interface AiAttachmentCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** 文件类型图标（业务传彩色资产）；缺省 lucide File（muted） */
  icon?: React.ReactNode
  title?: React.ReactNode
  /** 第二行说明，业务拼好传入（如 "excel · 1.21 MB"） */
  meta?: React.ReactNode
  /** 默认 "ready"；uploading = icon 位 Loader2 旋转；error = destructive 描边与错误说明（§1.2 设计缺口） */
  status?: AiAttachmentStatus
  /** 未知/不支持类型置灰（对照 attachment-02 右下例） */
  unsupported?: boolean
  /** true = 撑满父容器并放大排版（消息流结果文件）；false = 现有 170×44 紧凑卡 */
  fluid?: boolean
  /** 右侧操作插槽（业务用 DropdownMenu / AiAttachmentActionButton 自己组） */
  actions?: React.ReactNode
  /** 操作区显隐，默认 "hover"（含 focus-within 与菜单打开态） */
  actionsVisibility?: "hover" | "always"
  /** 提供时 hover 显示右上角 × 删除钮并触发；不提供则无删除钮 */
  onRemove?: () => void
}

// 卡片形态（对照 attachment-02 上块 / attachment-03）：icon 块 + 标题 + meta 行。
const AiAttachmentCard = React.forwardRef<
  HTMLDivElement,
  AiAttachmentCardProps
>(
  (
    {
      className,
      icon,
      title,
      meta,
      status = "ready",
      unsupported = false,
      fluid = false,
      actions,
      actionsVisibility,
      onRemove,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      data-status={status}
      data-unsupported={unsupported ? "" : undefined}
      data-fluid={fluid ? "" : undefined}
      className={cn(
        attachmentCardVariants({ fluid }),
        status === "error" && "border-destructive/50",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          attachmentIconVariants({ fluid }),
          "[&_svg]:shrink-0",
          unsupported && "grayscale",
        )}
      >
        {resolveStatusIcon(icon, status)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title != null && (
          <span className={attachmentTitleVariants({ fluid })}>{title}</span>
        )}
        {meta != null && (
          <span
            className={cn(
              "truncate text-xs leading-4",
              status === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {meta}
          </span>
        )}
      </span>
      {actions != null && (
        <AiAttachmentActions actions={actions} visibility={actionsVisibility} />
      )}
      {onRemove != null && <AiAttachmentRemoveButton onRemove={onRemove} />}
    </div>
  ),
)
AiAttachmentCard.displayName = "AiAttachmentCard"

export interface AiAttachmentChipProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  icon?: React.ReactNode
  title?: React.ReactNode
  status?: AiAttachmentStatus
  unsupported?: boolean
  /** hover 遮罩式 × 删除（对照 attachment-05 注释：遮罩展示避免布局抖动） */
  onRemove?: () => void
}

// 紧凑 pill 形态（对照 attachment-02 下块）：icon + 文件名单行。
// 删除钮基于遮罩叠加在 pill 右端，不改变 pill 宽度——这是与卡片形态删除钮的
// 关键差异，为 DEC-038 行内混排复用做准备（行内场景布局抖动不可接受）；
// 最弱层级投影使用 DESIGN shadow-sm token（对照 Figma 115:2131）。
const AiAttachmentChip = React.forwardRef<
  HTMLDivElement,
  AiAttachmentChipProps
>(
  (
    {
      className,
      icon,
      title,
      status = "ready",
      unsupported = false,
      onRemove,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      data-status={status}
      data-unsupported={unsupported ? "" : undefined}
      className={cn(
        "group/att relative inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-border bg-card px-2 text-xs shadow-sm",
        status === "error" && "border-destructive/50",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center [&_svg]:size-4 [&_svg]:shrink-0",
          unsupported && "grayscale",
        )}
      >
        {resolveStatusIcon(icon, status)}
      </span>
      {title != null && (
        <span
          className={cn(
            "max-w-40 truncate",
            status === "error" ? "text-destructive" : "text-foreground",
          )}
        >
          {title}
        </span>
      )}
      {onRemove != null && (
        <span
          className={cn(
            "pointer-events-none absolute inset-y-px right-px flex items-center justify-end rounded-r-full bg-gradient-to-l from-card via-card/80 to-transparent pl-6 pr-1",
            "opacity-0 transition-opacity duration-150 ease-standard motion-reduce:transition-none",
            "group-focus-within/att:opacity-100 pointer-fine:group-hover/att:opacity-100",
          )}
        >
          <button
            type="button"
            aria-label="Remove attachment"
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            className={cn(
              "pointer-events-auto flex size-4 items-center justify-center rounded-full text-muted-foreground",
              "transition-control pointer-fine:hover:text-foreground pointer-fine:active:scale-[0.97]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <X className="size-3" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </span>
      )}
    </div>
  ),
)
AiAttachmentChip.displayName = "AiAttachmentChip"

export interface AiAttachmentImageProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "children"
> {
  /** img src 必传；alt 建议业务传 */
  status?: AiAttachmentStatus
  onRemove?: () => void
}

// 图片/视频略缩图（对照 attachment-04）：尺寸默认 size-10，业务可 className 覆盖；
// uploading 叠半透明遮罩 + Loader2（复用 loading-overlay 视觉思路，内联小遮罩不引依赖）。
const AiAttachmentImage = React.forwardRef<
  HTMLImageElement,
  AiAttachmentImageProps
>(({ className, status = "ready", onRemove, alt = "", ...props }, ref) => (
  <span
    data-status={status}
    className="group/att relative inline-block leading-none"
  >
    <img
      ref={ref}
      alt={alt}
      className={cn(
        "size-10 rounded-lg border border-transparent object-cover",
        status === "error" && "border-destructive/50",
        className,
      )}
      {...props}
    />
    {status === "uploading" && (
      <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
        <Loader2
          className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
          strokeWidth={1.75}
          aria-hidden
        />
      </span>
    )}
    {onRemove != null && <AiAttachmentRemoveButton onRemove={onRemove} />}
  </span>
))
AiAttachmentImage.displayName = "AiAttachmentImage"

export interface AiAttachmentPreviewProps {
  /** 触发元素（通常是上面三种形态之一；须是能接受 ref 的单个元素，走 asChild） */
  children: React.ReactNode
  /** 浮层内容（表格预览/大图等，业务渲染）；null/undefined 时不挂浮层 */
  content?: React.ReactNode
  /** 浮层容器 className 透传 */
  contentClassName?: string
  /** 打开延时 ms，默认 75 */
  openDelay?: number
  /** 关闭延时 ms，默认 75 */
  closeDelay?: number
  side?: React.ComponentPropsWithoutRef<typeof HoverCardContent>["side"]
  align?: React.ComponentPropsWithoutRef<typeof HoverCardContent>["align"]
}

// 预览浮层壳（对照 attachment-01 ③预览）：只提供 hover 定位/动画/阴影，
// 浮层内的表格/图片预览由业务渲染 content；内容 padding 与滚动归业务（DEC-035 精神）。
function AiAttachmentPreview({
  children,
  content,
  contentClassName,
  openDelay = 75,
  closeDelay = 75,
  side,
  align,
}: AiAttachmentPreviewProps) {
  // content 为空时直接渲染 children 不挂浮层（零成本退化）。
  if (content == null) {
    return <>{children}</>
  }
  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        className={cn(
          "w-auto max-w-96 rounded-xl border bg-background p-0 shadow-md",
          "motion-hover-preview",
          "data-[state=open]:![--tw-enter-scale:1] data-[state=closed]:![--tw-exit-scale:1]",
          "data-[side=bottom]:![--tw-enter-translate-y:-2px] data-[side=top]:![--tw-enter-translate-y:2px]",
          "data-[side=right]:![--tw-enter-translate-x:-2px] data-[side=left]:![--tw-enter-translate-x:2px]",
          contentClassName,
        )}
      >
        {content}
      </HoverCardContent>
    </HoverCard>
  )
}
AiAttachmentPreview.displayName = "AiAttachmentPreview"

export {
  AiAttachmentActionButton,
  AiAttachmentCard,
  AiAttachmentChip,
  AiAttachmentImage,
  AiAttachmentPreview,
}
