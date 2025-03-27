import browser from "webextension-polyfill"

import type { AIProviderConfig, TabGroup, UserSettings } from "../types"
import { getAllTabs, getRules } from "./tabService"

// 获取当前AI配置
const getAIConfig = async (): Promise<AIProviderConfig> => {
  const data = await browser.storage.local.get("settings")
  const defaultConfig: AIProviderConfig = {
    endpoint: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-3.5-turbo",
    systemPrompt: ""
  }

  const settings = data.settings as UserSettings | undefined
  if (!settings?.aiProvider) {
    return defaultConfig
  }

  return settings.aiProvider
}

// 调用AI服务进行标签页分组
export const callAiApi = async (
  tabs: browser.Tabs.Tab[],
  forceAI: boolean = false
): Promise<TabGroup[]> => {
  const tabData = tabs.map((tab) => ({
    title: tab.title || "无标题",
    url: tab.url || ""
  }))

  try {
    const aiConfig = await getAIConfig()
    const data = await browser.storage.local.get("settings")
    const settings = data.settings as UserSettings | undefined

    // 如果没有设置API密钥或AI未启用（除非强制使用AI），则跳过AI分组
    if (!aiConfig.apiKey || (!settings?.aiEnabled && !forceAI)) {
      console.warn("AI未启用或未设置API密钥，跳过AI分组")
      return []
    }

    // 默认系统提示语
    const defaultSystemPrompt = `你是一个浏览器标签页分组助手。
你的任务是将用户的标签页按照主题、内容相关性进行分组。
返回JSON格式的分组结果，格式为: { "groups": [{ "name": "分组名称", "color": "颜色", "tabIds": [标签页索引数组] }] }
可用的颜色有: "blue", "red", "green", "yellow", "purple", "cyan", "orange", "pink", "grey"
每个标签页的索引就是它在提供的标签页列表中的位置（从0开始）。
尝试创建5个以内的分组，每个分组至少包含2个标签页。
如果某些标签页不适合任何分组，可以放在名为"其他"的分组中。`

    // 构建请求体
    const requestBody = {
      model: aiConfig.model,
      messages: [
        {
          role: "system",
          content: aiConfig.systemPrompt || defaultSystemPrompt
        },
        {
          role: "user",
          content: `请将以下标签页进行分组:\n${JSON.stringify(tabData, null, 2)}`
        }
      ],
      temperature: 0.2,
      max_tokens: 4000
    }

    // 发送请求到AI服务
    const response = await fetch(`${aiConfig.endpoint}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiConfig.apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    const data2 = await response.json()

    // 检查响应
    if (!response.ok) {
      throw new Error(data2.error?.message || "AI 分组请求失败")
    }

    // 解析AI响应
    const aiResponse = data2.choices[0]?.message?.content
    if (!aiResponse) {
      throw new Error("AI 返回内容为空")
    }

    // 提取JSON
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("AI 响应中未找到有效的JSON数据")
    }

    const jsonData = JSON.parse(jsonMatch[0])

    if (!jsonData.groups || !Array.isArray(jsonData.groups)) {
      throw new Error("AI 响应数据格式不正确")
    }

    // 转换为TabGroup格式
    const tabGroups: TabGroup[] = jsonData.groups
      .map((group, index) => {
        // 确保tabIds是数组
        const tabIds = Array.isArray(group.tabIds) ? group.tabIds : []

        // 根据tabIds获取对应的标签页
        const groupTabs = tabIds
          .filter((id) => id >= 0 && id < tabs.length)
          .map((id) => tabs[id])
          .filter((tab) => tab !== undefined)

        // 只返回至少有两个标签页的分组
        if (groupTabs.length < 2) {
          return null
        }

        return {
          id: `ai-group-${Date.now()}-${index}`,
          name: group.name || `分组 ${index + 1}`,
          color:
            group.color ||
            [
              "blue",
              "red",
              "green",
              "yellow",
              "purple",
              "cyan",
              "orange",
              "pink",
              "grey"
            ][index % 9],
          tabs: groupTabs
        }
      })
      .filter(Boolean) as TabGroup[]
    console.log("AI生成的分组:", tabGroups)
    return tabGroups
  } catch (error) {
    console.error("AI 分组请求失败:", error)
    // 如果 AI 服务失败，fallback 到基于域名的分组
    return []
  }
}

/**
 * 生成标签分组建议
 * 分组策略优先级：
 * 1. 自定义规则 (即使只有1个标签)
 * 2. AI 分组 (不使用API时跳过)
 * 3. 同域名分组 (需要至少2个标签)
 */
export const generateTabGroups = async (
  inputTabs: browser.Tabs.Tab[] | null = null
): Promise<TabGroup[]> => {
  try {
    console.log("生成标签分组建议")
    const tabs = inputTabs || (await getAllTabs())
    console.log("🚀 ~ tabs:", tabs)
    const groups: TabGroup[] = []
    let remainingTabs = [...tabs] // 创建一个副本用于跟踪未分组的标签

    // 获取用户设置
    const data = await browser.storage.local.get("settings")
    const settings = data.settings as { aiEnabled?: boolean } | undefined
    console.log("🚀 ~ settings:", settings)
    const aiEnabled = settings?.aiEnabled !== false // 默认启用AI

    // 1. 首先尝试基于规则分组
    console.log("步骤1: 使用自定义规则分组")
    try {
      const rules = await getRules()
      const enabledRules = rules.filter((rule) => rule.enabled)

      // 处理每个启用的规则
      for (const rule of enabledRules) {
        if (rule.type === "domain" && rule.pattern) {
          // 提取域名模式并处理每个域名
          const domains = rule.pattern.split(",").map((d) => d.trim())
          const matchingTabs: browser.Tabs.Tab[] = []

          // 查找匹配此规则的标签
          remainingTabs = remainingTabs.filter((tab) => {
            if (!tab.url) return true // 保留无URL的标签

            try {
              const url = new URL(tab.url)
              const hostname = url.hostname

              // 如果标签的主机名包含任何目标域名，则匹配
              if (domains.some((domain) => hostname.includes(domain))) {
                matchingTabs.push(tab)
                return false // 从剩余标签中移除
              }
              return true // 保留不匹配的标签
            } catch (error) {
              console.error("处理URL时出错:", tab.url, error)
              return true // 出错时保留该标签
            }
          })

          // 即使只有一个标签也创建组 (自定义规则特性)
          if (matchingTabs.length > 0) {
            groups.push({
              id: `rule-${rule.id}`,
              name: rule.name,
              color: rule.color || "blue",
              tabs: matchingTabs
            })
            console.log(
              `规则 "${rule.name}" 匹配了 ${matchingTabs.length} 个标签`
            )
          }
        } else if (rule.type === "custom") {
          // 处理自定义正则表达式规则
          if (rule.pattern) {
            try {
              const regex = new RegExp(rule.pattern)
              const matchingTabs: browser.Tabs.Tab[] = []

              // 过滤匹配正则表达式的标签
              remainingTabs = remainingTabs.filter((tab) => {
                if (!tab.url) return true // 保留无URL的标签

                try {
                  const url = new URL(tab.url)
                  const hostname = url.hostname

                  // 如果标签的主机名匹配正则表达式
                  if (regex.test(hostname)) {
                    matchingTabs.push(tab)
                    return false // 从剩余标签中移除
                  }
                  return true // 保留不匹配的标签
                } catch (error) {
                  console.error("处理URL时出错:", tab.url, error)
                  return true // 出错时保留该标签
                }
              })

              // 即使只有一个标签也创建组 (自定义规则特性)
              if (matchingTabs.length > 0) {
                groups.push({
                  id: `rule-${rule.id}`,
                  name: rule.name,
                  color: rule.color || "blue",
                  tabs: matchingTabs
                })
                console.log(
                  `自定义规则 "${rule.name}" 匹配了 ${matchingTabs.length} 个标签`
                )
              }
            } catch (error) {
              console.error("正则表达式解析失败:", rule.pattern, error)
            }
          }
        }
      }

      console.log(`规则分组后剩余未分组标签: ${remainingTabs.length}`)
    } catch (error) {
      console.error("规则分组失败:", error)
    }

    // 2. 如果开启了AI并且有剩余标签，尝试AI分组
    if (aiEnabled && remainingTabs.length >= 2) {
      console.log("步骤2: 尝试使用AI分组剩余标签：", remainingTabs)
      try {
        const aiGroups = await callAiApi(remainingTabs, true)

        // 过滤只有1个标签的AI分组
        const validAiGroups = aiGroups.filter((group) => group.tabs.length >= 2)

        // 将有效的AI分组添加到结果中
        if (validAiGroups.length > 0) {
          // 创建一个已分组标签的ID集合
          const groupedTabIds = new Set<number>()

          for (const group of validAiGroups) {
            // 将分组添加到结果
            groups.push(group)

            // 记录已分组的标签ID
            group.tabs.forEach((tab) => {
              if (tab.id) groupedTabIds.add(tab.id)
            })
          }

          // 更新剩余标签，移除已经被AI分组的标签
          remainingTabs = remainingTabs.filter(
            (tab) => !groupedTabIds.has(tab.id!)
          )
          console.log(
            `AI分组创建了 ${validAiGroups.length} 个组，剩余未分组标签: ${remainingTabs.length}`
          )
        }
      } catch (error) {
        console.error("AI分组失败:", error)
      }
    } else if (remainingTabs.length > 0) {
      console.log("跳过AI分组: AI已禁用或剩余标签不足")
    }

    // 3. 最后为剩余的标签根据域名分组
    if (remainingTabs.length >= 2) {
      console.log("步骤3: 对剩余标签执行域名分组")

      const domainGroups: Record<string, browser.Tabs.Tab[]> = {}

      // 按域名收集标签
      for (const tab of remainingTabs) {
        if (!tab.url) continue

        try {
          const url = new URL(tab.url)
          const hostname = url.hostname
          const parts = hostname.split(".")

          // 提取主域名 (例如 example.com)
          const mainDomain =
            parts.length > 1
              ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}`
              : hostname

          if (!domainGroups[mainDomain]) {
            domainGroups[mainDomain] = []
          }

          domainGroups[mainDomain].push(tab)
        } catch (error) {
          console.error("解析URL失败:", tab.url, error)
        }
      }

      // 创建域名分组，但只有至少2个标签的情况
      for (const [domain, domainTabs] of Object.entries(domainGroups)) {
        if (domainTabs.length >= 2) {
          groups.push({
            id: `domain-${domain}`,
            name: domain,
            color: "blue", // 为域名组使用默认蓝色
            tabs: domainTabs
          })
          console.log(
            `为域名 "${domain}" 创建了组，包含 ${domainTabs.length} 个标签`
          )
        }
      }
    }

    // 返回生成的所有分组
    console.log(`总共生成了 ${groups.length} 个标签组`)
    return groups
  } catch (error) {
    console.error("生成标签分组失败:", error)
    // 返回一个空数组，以免调用者出错
    return []
  }
}
