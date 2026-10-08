import * as React from "react"

/**
 * 「完成自动折叠」：status 变为 "success" 时收起。
 * DEC-029 模式 2——渲染期比对上一次 status 后调用 setter，禁止 effect 顶层同步 setState；
 * 仅非受控时启用（enabled），受控时业务自管。
 */
export function useCollapseOnSuccess(
  status: string,
  enabled: boolean,
  collapse: () => void,
) {
  const [prevStatus, setPrevStatus] = React.useState(status)
  if (prevStatus !== status) {
    setPrevStatus(status)
    if (status === "success" && enabled) {
      collapse()
    }
  }
}
