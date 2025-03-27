import browser from "webextension-polyfill"

import type { GroupRule, TabGroup } from "../types"

// 颜色名称到Chrome颜色枚举的映射
const colorNameToEnum: Record<string, browser.TabGroups.ColorEnum> = {
  "#4285F4": "blue", // 蓝色
  "#EA4335": "red", // 红色
  "#34A853": "green", // 绿色
  "#FBBC05": "yellow", // 黄色
  "#A142F4": "purple", // 紫色
  "#24C1E0": "cyan", // 青色
  "#FA7B17": "orange", // 橙色
  "#F06292": "pink", // 粉色
  "#9AA0A6": "grey" // 灰色
}

// 将十六进制颜色转换为Chrome支持的颜色枚举
const hexToColorEnum = (hexColor: string): browser.TabGroups.ColorEnum => {
  // 如果直接匹配到了预定义的颜色，直接返回
  if (colorNameToEnum[hexColor]) {
    return colorNameToEnum[hexColor]
  }

  // 否则，找到最接近的颜色
  // 将十六进制转换为RGB
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)

  // 计算与预定义颜色的距离，选择最接近的
  let minDistance = Infinity
  let closestColor: browser.TabGroups.ColorEnum = "blue" // 默认为蓝色

  Object.entries(colorNameToEnum).forEach(([hex, colorEnum]) => {
    const r2 = parseInt(hex.slice(1, 3), 16)
    const g2 = parseInt(hex.slice(3, 5), 16)
    const b2 = parseInt(hex.slice(5, 7), 16)

    // 计算欧几里得距离
    const distance = Math.sqrt(
      Math.pow(r - r2, 2) + Math.pow(g - g2, 2) + Math.pow(b - b2, 2)
    )

    if (distance < minDistance) {
      minDistance = distance
      closestColor = colorEnum
    }
  })

  return closestColor
}

// 获取所有打开的标签页
export const getAllTabs = async (): Promise<browser.Tabs.Tab[]> => {
  try {
    return await browser.tabs.query({})
  } catch (error) {
    console.error("获取标签页失败:", error)
    return []
  }
}

// 根据域名获取标签页分组
export const getTabsByDomain = async (): Promise<
  Record<string, browser.Tabs.Tab[]>
> => {
  const tabs = await getAllTabs()
  const groupedTabs: Record<string, browser.Tabs.Tab[]> = {}

  tabs.forEach((tab) => {
    if (!tab.url) return

    try {
      const url = new URL(tab.url)
      const domain = url.hostname

      if (!groupedTabs[domain]) {
        groupedTabs[domain] = []
      }

      groupedTabs[domain].push(tab)
    } catch (error) {
      console.error("解析URL失败:", tab.url, error)
    }
  })

  return groupedTabs
}

// 根据规则创建标签组
export const createTabGroups = async (rules: GroupRule[]): Promise<void> => {
  const domainTabs = await getTabsByDomain()
  const activeRules = rules.filter((rule) => rule.enabled)

  for (const rule of activeRules) {
    if (rule.type === "domain" && rule.pattern) {
      const domains = rule.pattern.split(",").map((d) => d.trim())

      const matchingDomains = Object.keys(domainTabs).filter((domain) =>
        domains.some((d) => domain.includes(d))
      )

      for (const domain of matchingDomains) {
        const tabs = domainTabs[domain]
        if (tabs.length > 1) {
          try {
            // 创建新标签组
            const groupId = await browser.tabs.group({
              tabIds: tabs.map((tab) => tab.id).filter(Boolean) as number[]
            })

            // 获取适合的颜色枚举
            const colorEnum = rule.color?.startsWith("#")
              ? hexToColorEnum(rule.color)
              : (rule.color as browser.TabGroups.ColorEnum) || "blue"

            // 更新标签组信息
            await browser.tabGroups.update(groupId, {
              title: rule.name || domain,
              color: colorEnum
            })
          } catch (error) {
            console.error(`为域名 ${domain} 创建标签组失败:`, error)
          }
        }
      }
    }
  }
}

// 保存用户规则
export const saveRules = async (rules: GroupRule[]): Promise<void> => {
  await browser.storage.local.set({ rules })
}

// 获取用户规则
export const getRules = async (): Promise<GroupRule[]> => {
  const data = await browser.storage.local.get("rules")
  return Array.isArray(data.rules) ? data.rules : []
}

// 应用 AI 生成的分组建议
export const applyAiGroups = async (groups: TabGroup[]): Promise<void> => {
  console.log("🚀 ~ applyAiGroups ~ groups:", groups)
  for (const group of groups) {
    const tabIds = group.tabs.map((tab) => tab.id).filter(Boolean) as number[]

    if (tabIds.length > 1) {
      try {
        // 创建新标签组
        const groupId = await browser.tabs.group({ tabIds })

        // 获取适合的颜色枚举
        const colorEnum = group.color?.startsWith("#")
          ? hexToColorEnum(group.color)
          : (group.color as browser.TabGroups.ColorEnum) || "blue"

        // 更新标签组信息
        await browser.tabGroups.update(groupId, {
          title: group.name,
          color: colorEnum
        })
      } catch (error) {
        console.error(`创建 AI 标签组 "${group.name}" 失败:`, error)
      }
    }
  }
}
