import browser from "webextension-polyfill"

import { debounce } from "~node_modules/es-toolkit/dist"

import { generateTabGroups } from "./services/aiService"
import { getRules } from "./services/tabService"
import type { TabGroup, UserSettings } from "./types"

// 显示错误通知函数
const showErrorNotification = async (title: string, message: string) => {
  try {
    await browser.notifications.create({
      type: "basic",
      iconUrl: browser.runtime.getURL("assets/icon128.png"),
      title,
      message
    })
  } catch (error) {
    console.error("无法显示通知:", error)
  }
}

// 初始化默认规则
const initDefaultRules = async () => {
  const rules = await getRules()

  if (rules.length === 0) {
    // 设置一些默认规则
    await browser.storage.local.set({
      rules: [
        {
          id: "default-social",
          name: "社交媒体",
          type: "domain",
          pattern: "facebook.com,twitter.com,instagram.com,weibo.com",
          enabled: true,
          color: "blue" // 蓝色
        },
        {
          id: "default-search",
          name: "搜索引擎",
          type: "domain",
          pattern: "google.com,bing.com,baidu.com",
          enabled: true,
          color: "green" // 绿色
        },
        {
          id: "default-localhost",
          name: "开发调试",
          type: "domain",
          pattern: "localhost,127.0.0.1",
          enabled: true,
          color: "purple" // 紫色
        }
      ]
    })
  }

  // 初始化默认设置
  const data = await browser.storage.local.get("settings")
  const defaultSettings = {
    autoGroupEnabled: true,
    rules: [],
    aiEnabled: true,
    aiGroupingInterval: 60, // 默认改为60分钟
    autoReschedule: true, // 是否自动重新分组
    aiProvider: {
      endpoint: "https://api.openai.com/v1",
      apiKey: "",
      model: "gpt-3.5-turbo",
      systemPrompt: ""
    },
    customColors: [] // 初始化空的自定义颜色列表
  }

  if (!data.settings) {
    await browser.storage.local.set({ settings: defaultSettings })
  } else {
    // 确保现有设置中有必要的字段
    const settings = data.settings as Partial<UserSettings>
    let updated = false

    if (!settings.aiProvider) {
      settings.aiProvider = defaultSettings.aiProvider
      updated = true
    }

    if (!settings.customColors) {
      settings.customColors = []
      updated = true
    }

    // 设置默认的自动重新分组选项
    if (settings.autoReschedule === undefined) {
      settings.autoReschedule = true
      updated = true
    }

    // 确保AI分组间隔为60分钟
    if (settings.aiGroupingInterval === 30) {
      settings.aiGroupingInterval = 60
      updated = true
    }

    if (updated) {
      await browser.storage.local.set({ settings })
    }
  }
}

// 标签页更新时的处理函数
const handleTabUpdated = async (
  tabId: number,
  changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
  tab: browser.Tabs.Tab
) => {
  // 只在标签页完成加载时处理
  if (changeInfo.status !== "complete" || !tab.url) {
    return
  }

  // 获取设置
  const data = await browser.storage.local.get("settings")
  const settings = data.settings as
    | UserSettings
    | {
        autoGroupEnabled: boolean
        aiEnabled: boolean
      }

  // 如果启用了自动分组
  if (settings.autoGroupEnabled) {
    try {
      // 尝试将此标签加入到现有分组或创建新分组
      await groupNewTab(tab)
    } catch (error) {
      console.error("处理标签页更新失败:", error)
      showErrorNotification(
        "分组失败",
        `处理标签页更新失败: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}

// 将新标签尝试加入现有分组或创建新分组
const groupNewTab = debounce(async (tab: browser.Tabs.Tab) => {
  // 检查标签是否已经在分组中
  if (tab.groupId !== undefined && tab.groupId !== -1) {
    console.log("标签已在分组中，跳过:", tab.id, tab.groupId)
    return
  }

  try {
    // 首先尝试根据规则匹配已有分组
    const tabs = await browser.tabs.query({})
    const newTabs = tabs.filter((t) => t.groupId === -1)
    console.log("🚀 ~ 有新的标签页加入:", newTabs)
    const tabGroups = await generateTabGroups(newTabs)
    await applyAiGroups(tabGroups)
    // 如果上面的所有尝试都失败，则不对标签进行分组
    console.log(`标签 ${tab.id} 不符合任何分组条件，保持未分组状态`)
  } catch (error) {
    console.error("分组新标签失败:", error)
    throw error // 向上传递错误
  }
}, 200)

// 使用AI分组标签页并应用
const applyAiGroups = async (aiGroups: TabGroup[]) => {
  console.log("🚀 ~ applyAiGroups ~ aiGroups:", aiGroups)
  if (!aiGroups || aiGroups.length === 0) return

  try {
    // 获取所有现有分组
    const existingGroups = await browser.tabGroups.query({})

    // 为每个AI建议的组创建标签组
    for (const group of aiGroups) {
      // 检查是否已存在同名分组
      const existingGroup = existingGroups.find(
        (g) => g.title === group.name && g.color === group.color
      )

      if (existingGroup) {
        // 如果分组已存在，将标签添加到现有分组
        const tabIds = group.tabs.map((tab) => tab.id)
        await browser.tabs.group({
          groupId: existingGroup.id,
          tabIds
        })
        console.log(`将标签添加到现有分组: ${group.name}`)
      } else {
        // 如果分组不存在，创建新分组
        const tabIds = group.tabs.map((tab) => tab.id)
        const groupId = await browser.tabs.group({ tabIds })
        await browser.tabGroups.update(groupId, {
          title: group.name,
          color: group.color as browser.TabGroups.ColorEnum
        })
        console.log(
          `已创建AI标签组: ${group.name}, 包含${tabIds.length}个标签页`
        )
      }
    }
  } catch (error) {
    console.error("应用AI标签组失败:", error)
    showErrorNotification(
      "AI分组失败",
      `应用AI标签组时出错: ${error instanceof Error ? error.message : String(error)}`
    )
    throw error // 重新抛出错误以便调用者知道操作失败
  }
}

// 重新对所有标签进行分组
const regroupAllTabs = async () => {
  try {
    console.log("开始重新对所有标签页进行分组")
    // 获取设置
    // 获取所有标签
    const tabs = await browser.tabs.query({})

    const tabGroups = await generateTabGroups(tabs)
    // 解散所有现有分组
    await deleteAllGroups()

    await applyAiGroups(tabGroups)

    console.log("成功重新分组所有标签页")
    return { success: true, message: "已成功对所有标签页进行分组" }
  } catch (error) {
    console.error("重新分组所有标签页失败:", error)
    showErrorNotification(
      "分组失败",
      `重新分组所有标签页失败: ${error instanceof Error ? error.message : String(error)}`
    )
    return {
      success: false,
      message: `分组失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

// 定期使用 AI 分组
const scheduleAiGrouping = async () => {
  // 获取设置
  const data = await browser.storage.local.get("settings")
  const settings = data.settings as
    | UserSettings
    | {
        aiEnabled: boolean
        aiGroupingInterval: number
        autoReschedule: boolean
      }

  // 检查是否启用AI分组并且允许自动重新分组
  if (settings.aiEnabled && settings.autoReschedule) {
    try {
      console.log("执行定期AI分组")
      await regroupAllTabs() // 强制使用AI

      // 设置下一次 AI 分组的计划
      setTimeout(scheduleAiGrouping, settings.aiGroupingInterval * 60 * 1000)
    } catch (error) {
      console.error("AI 分组失败:", error)
      showErrorNotification(
        "AI分组失败",
        `自动AI分组失败: ${error instanceof Error ? error.message : String(error)}`
      )
      // 如果失败，5分钟后重试
      setTimeout(scheduleAiGrouping, 5 * 60 * 1000)
    }
  } else {
    // 如果 AI 分组被禁用或不允许自动重新分组，1分钟后检查一次设置
    setTimeout(scheduleAiGrouping, 60 * 1000)
  }
}

// 监听标签页创建
browser.tabs.onCreated.addListener(async (tab) => {
  // 获取设置
  const data = await browser.storage.local.get("settings")
  const settings = data.settings as
    | UserSettings
    | { aiEnabled: boolean; autoGroupEnabled: boolean }

  try {
    // 如果自动分组启用，执行规则分组
    if (settings.autoGroupEnabled && tab.url) {
      await groupNewTab(tab)
    }
  } catch (error) {
    console.error("标签页创建时应用分组失败:", error)
    showErrorNotification(
      "分组失败",
      `标签页创建时应用分组失败: ${error instanceof Error ? error.message : String(error)}`
    )
  }
})

// 监听来自选项页面的消息
browser.runtime.onMessage.addListener(async (message) => {
  if (message.action === "deleteAllGroups") {
    return await deleteAllGroups()
  } else if (message.action === "regroupAllTabs") {
    // 使用所有策略重新分组，但不强制使用AI
    return await regroupAllTabs()
  }
})

// 删除所有标签分组
const deleteAllGroups = async () => {
  try {
    // 获取所有标签组
    const groups = await browser.tabGroups.query({})

    if (groups.length === 0) {
      return { success: true, message: "没有找到标签分组" }
    }

    console.log("找到标签分组:", groups.length, "个")

    // 依次解散每个标签组
    for (const group of groups) {
      try {
        // 获取该组中的所有标签
        // @ts-ignore - groupId 在 Chrome API 中存在但类型定义可能不完整
        const tabs = await browser.tabs.query({ groupId: group.id })

        if (tabs.length > 0) {
          const tabIds = tabs.map((tab) => tab.id!)
          console.log(`正在解散组 ${group.id}，包含 ${tabIds.length} 个标签`)

          // 使用 chrome.tabs.ungroup 方法解散组
          // 注意：某些环境下可能需要使用不同的API
          try {
            // 方法一：直接使用 ungroup API (最佳)
            // @ts-ignore - Chrome API 可能不在类型定义中
            await browser.tabs.ungroup(tabIds)
          } catch (ungroupError) {
            console.error("使用 ungroup 方法失败，尝试备选方案:", ungroupError)

            // 方法二：如果ungroup不可用，尝试将标签合并到一个新组然后移除
            try {
              // 重置标签的 groupId
              for (const tab of tabs) {
                // 一个隐蔽的技巧：将标签先放入一个临时组再快速删除该组
                await browser.tabs.update(tab.id!, { active: true })
                // 模拟点击"从组中移除"
                await browser.tabs.update(tab.id!, { pinned: true })
                await browser.tabs.update(tab.id!, { pinned: false })
              }
            } catch (e) {
              console.error("备选方案也失败:", e)
            }
          }
        }
      } catch (e) {
        console.error(`解散组 ${group.id} 时出错:`, e)
        showErrorNotification(
          "解散分组失败",
          `解散组 ${group.id} 时出错: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    // 再次检查是否所有组都已解散
    const remainingGroups = await browser.tabGroups.query({})
    if (remainingGroups.length > 0) {
      console.warn("有些组无法解散:", remainingGroups.length)
    }

    return { success: true, message: "已成功删除所有分组" }
  } catch (error) {
    console.error("删除所有分组失败:", error)
    showErrorNotification(
      "删除分组失败",
      `删除所有分组失败: ${error instanceof Error ? error.message : String(error)}`
    )
    return {
      success: false,
      message: `删除失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

// 插件安装或更新时的处理函数
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install" || details.reason === "update") {
    await initDefaultRules()
  }

  // 开始 AI 分组调度
  scheduleAiGrouping()
})

// 监听标签页更新
browser.tabs.onUpdated.addListener(handleTabUpdated)
