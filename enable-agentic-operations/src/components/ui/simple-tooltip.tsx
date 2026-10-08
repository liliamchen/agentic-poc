"use client"

import * as React from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface SimpleTooltipProps {
  title: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: React.ComponentPropsWithoutRef<typeof TooltipContent>["side"]
  align?: React.ComponentPropsWithoutRef<typeof TooltipContent>["align"]
  sideOffset?: React.ComponentPropsWithoutRef<
    typeof TooltipContent
  >["sideOffset"]
  contentClassName?: string
  children: React.ReactNode
}

const SimpleTooltip = React.memo(
  ({
    title,
    defaultOpen,
    open,
    onOpenChange,
    side,
    align,
    sideOffset,
    contentClassName,
    children,
  }: SimpleTooltipProps) => (
    <TooltipProvider>
      <Tooltip
        delayDuration={0}
        defaultOpen={defaultOpen}
        open={open}
        onOpenChange={onOpenChange}
      >
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          sideOffset={sideOffset}
          className={contentClassName}
        >
          {title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
)
SimpleTooltip.displayName = "SimpleTooltip"

export { SimpleTooltip }
