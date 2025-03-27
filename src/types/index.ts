import type { Tabs } from "webextension-polyfill"

// 标签组颜色定义
export interface ColorOption {
  name: string
  value: string // 实际CSS颜色值
  label: string // 显示的名称
  origin: "china" | "japan" | "chrome" | "custom" // 颜色来源
}

// 标签组类型定义
export interface TabGroup {
  id: string
  name: string
  color?: string
  tabs: Tabs.Tab[]
}

// 分组规则类型
export interface GroupRule {
  id: string
  name: string
  type: "domain" | "ai" | "custom"
  pattern?: string // 用于自定义规则，如域名匹配模式
  enabled: boolean
  color?: string
}

// AI提供商配置
export interface AIProviderConfig {
  endpoint: string
  apiKey: string
  model: string
  systemPrompt: string // 系统提示语
}

// 用户设置类型
export interface UserSettings {
  autoGroupEnabled: boolean
  rules: GroupRule[]
  aiEnabled: boolean
  aiGroupingInterval: number // 自动分组的间隔时间（分钟）
  autoReschedule: boolean // 是否自动重新分组
  aiProvider: AIProviderConfig // AI提供商配置
  customColors: ColorOption[] // 用户自定义颜色
}
