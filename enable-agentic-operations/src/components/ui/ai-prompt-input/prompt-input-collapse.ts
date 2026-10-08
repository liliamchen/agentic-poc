import * as React from "react"

// ============================================================================
// 单行收起态 ↔ 多行展开态的形变动画（DEC-104）。
//
// 两态的差异是布局本身：收起态 Root 是一行（Toolbar 改 display:contents，输入区靠
// order 插到按钮与发送钮中间），展开态 Root 是两行（输入区独占首行）。这种重排在 CSS
// 里没有可过渡的中间态，只能测量前后位置再补一段动画，属 DEC-050 第 7 条允许的
// 「起终点必须实测」，故走 WAAPI 而不是 transition。
//
// 曲线与 duration 同 ease-toggle / 180ms（展开收起语义），WAAPI 取不到工具类，
// 只能字面量手写；改动须同步 tools/emitters/templates/v3-runtime.js。
// ============================================================================

const MORPH_DURATION = 180
const MORPH_EASING = "cubic-bezier(0.65, 0, 0.35, 1)"

/** 阈值：亚像素级的位移不值得起一条动画 */
const MORPH_EPSILON = 0.5

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * 参与形变的盒子。Toolbar 在收起态是 `display:contents`（自身没有盒），两态都下钻取它
 * 的子节点，前后两次测量才是同一批元素；装饰层（bloom）不参与。
 */
function collectMorphTargets(root: HTMLElement): HTMLElement[] {
  const targets: HTMLElement[] = []
  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement)) continue
    if (child.dataset.slot === "ai-prompt-input-border-beam") continue
    if (child.dataset.slot === "ai-prompt-input-toolbar") {
      for (const item of Array.from(child.children)) {
        if (item instanceof HTMLElement) targets.push(item)
      }
      continue
    }
    targets.push(child)
  }
  return targets
}

type MorphSnapshot = {
  height: number
  boxes: Map<HTMLElement, DOMRect>
}

/**
 * 返回 `captureMorph`：在触发展开/收起的事件里**同步**调用，先记下切换前的几何；
 * 随后的 layout effect 量到新几何后补一段 FLIP（Root 走 height，子节点走 translate）。
 *
 * 动画进行中再次切换时，capture 量到的是动画当下的位置（`getBoundingClientRect` 含
 * transform），layout effect 里先 `cancel()` 旧动画再量终点，于是新动画从当前视觉位置续上。
 */
export function useCollapseMorph(rootRef: React.RefObject<HTMLDivElement>) {
  const animationsRef = React.useRef<Animation[]>([])
  const snapshotRef = React.useRef<MorphSnapshot | null>(null)

  const captureMorph = React.useCallback(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return
    const boxes = new Map<HTMLElement, DOMRect>()
    for (const el of collectMorphTargets(root)) {
      boxes.set(el, el.getBoundingClientRect())
    }
    snapshotRef.current = {
      height: root.getBoundingClientRect().height,
      boxes,
    }
  }, [rootRef])

  // 无依赖数组：每次提交都跑，但只有 capture 过才有活干。
  React.useLayoutEffect(() => {
    const snapshot = snapshotRef.current
    if (!snapshot) return
    snapshotRef.current = null
    const root = rootRef.current
    if (!root) return

    for (const animation of animationsRef.current) animation.cancel()
    const animations: Animation[] = []
    const options = { duration: MORPH_DURATION, easing: MORPH_EASING }

    // 只动 height。圆角必须留给 CSS transition：v3 通道开着 `important: true`，
    // `rounded-*` 带 `!important`，按 CSS 级联，transition 能压过它、animation 压不过
    // ——WAAPI 写了 borderRadius 关键帧也是静默不动（height 没有对应工具类，故不受影响）。
    const { height } = root.getBoundingClientRect()
    if (Math.abs(height - snapshot.height) > MORPH_EPSILON) {
      animations.push(
        root.animate(
          [{ height: `${snapshot.height}px` }, { height: `${height}px` }],
          options,
        ),
      )
    }

    for (const [el, from] of snapshot.boxes) {
      if (!root.contains(el)) continue
      const to = el.getBoundingClientRect()
      const dx = from.left - to.left
      const dy = from.top - to.top
      if (Math.abs(dx) < MORPH_EPSILON && Math.abs(dy) < MORPH_EPSILON) continue
      animations.push(
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
          options,
        ),
      )
    }

    animationsRef.current = animations
  })

  React.useEffect(
    () => () => {
      for (const animation of animationsRef.current) animation.cancel()
    },
    [],
  )

  return captureMorph
}
