import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 组件源码统一用它合并 className，冲突时后者胜。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
