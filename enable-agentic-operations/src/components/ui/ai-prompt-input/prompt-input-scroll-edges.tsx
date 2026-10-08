import * as React from "react"

/** 输入区内滚到中段时出上下渐变遮罩：顶遮罩仅已上滚、底遮罩仅未到底。 */
export function useScrollEdges(rootRef: React.RefObject<HTMLDivElement>) {
  const [edges, setEdges] = React.useState({ top: false, bottom: false })

  const update = React.useCallback(() => {
    const root = rootRef.current
    if (!root) return

    const hasOverflow = root.scrollHeight - root.clientHeight > 1
    const next = {
      top: hasOverflow && root.scrollTop > 1,
      bottom:
        hasOverflow &&
        root.scrollTop + root.clientHeight < root.scrollHeight - 1,
    }

    setEdges((current) =>
      current.top === next.top && current.bottom === next.bottom
        ? current
        : next,
    )
  }, [rootRef])

  React.useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const frame = requestAnimationFrame(update)
    root.addEventListener("scroll", update, { passive: true })
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
    resizeObserver?.observe(root)

    return () => {
      cancelAnimationFrame(frame)
      root.removeEventListener("scroll", update)
      resizeObserver?.disconnect()
    }
  }, [rootRef, update])

  // contentEditable 的 DOM 变化会经 value / hosts 触发组件重渲染；每次提交后复核
  // scrollHeight，覆盖 ResizeObserver 无法感知的「容器不变、内容高度变化」。
  React.useLayoutEffect(() => {
    const frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  })

  return edges
}

export function ScrollEdgeFades({
  top,
  bottom,
}: {
  top: boolean
  bottom: boolean
}) {
  return (
    <>
      {top && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-card to-transparent"
        />
      )}
      {bottom && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-card to-transparent"
        />
      )}
    </>
  )
}
