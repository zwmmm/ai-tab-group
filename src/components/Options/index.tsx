import { useEffect, useState } from "react"
import browser from "webextension-polyfill"

import { checkAiApiConnection } from "../../services/aiService"
import type { AIProviderConfig, UserSettings } from "../../types"
import { GroupRuleList } from "./GroupRuleList"

// 预设模型列表
const presetModels = [
  "gpt-3.5-turbo",
  "gpt-4",
  "gpt-4-turbo",
  "claude-3-haiku",
  "claude-3-sonnet",
  "claude-3-opus",
  "custom"
]

export const Options = () => {
  const [settings, setSettings] = useState<UserSettings>({
    autoGroupEnabled: true,
    rules: [],
    aiEnabled: true,
    aiGroupingInterval: 30,
    autoReschedule: true,
    aiProvider: {
      endpoint: "https://api.openai.com/v1",
      apiKey: "",
      model: "gpt-3.5-turbo",
      systemPrompt: ""
    },
    customColors: []
  })

  // 添加自定义模型名称状态
  const [customModelName, setCustomModelName] = useState("")

  // 错误提示状态
  const [errorState, setErrorState] = useState<{
    show: boolean
    title: string
    message: string
  }>({
    show: false,
    title: "",
    message: ""
  })

  // 添加测试 API 连接的状态
  const [apiTestStatus, setApiTestStatus] = useState<{
    loading: boolean
    result: null | { success: boolean; message: string }
  }>({
    loading: false,
    result: null
  })

  // 监听错误消息
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === "showError") {
        setErrorState({
          show: true,
          title: message.title || "错误",
          message: message.message || "发生了未知错误"
        })

        return true
      }
    }

    // 添加消息监听器
    browser.runtime.onMessage.addListener(handleMessage)

    // 组件卸载时移除监听器
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  // 关闭错误提示
  const closeError = () => {
    setErrorState((prev) => ({ ...prev, show: false }))
  }

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      const data = await browser.storage.local.get("settings")
      if (data.settings) {
        setSettings(data.settings as UserSettings)

        // 如果当前模型不在预设列表中，设置为自定义模型
        const currentModel = (data.settings as UserSettings).aiProvider.model

        if (!presetModels.includes(currentModel)) {
          setCustomModelName(currentModel)
        }
      }
    }

    loadSettings()
  }, [])

  // 保存设置到存储
  const saveSettings = async (settings: UserSettings) => {
    setSettings(settings)
    await browser.storage.local.set({ settings })
    console.log("🚀 ~ saveSettings ~ settings:", settings)
  }

  // 更新自动分组设置
  const handleAutoGroupToggle = (enabled: boolean) => {
    saveSettings({ ...settings, autoGroupEnabled: enabled })
  }

  // 更新 AI 设置
  const handleAiToggle = (enabled: boolean) => {
    saveSettings({ ...settings, aiEnabled: enabled })
  }

  // 更新 AI 分组间隔
  const handleIntervalChange = (interval: number) => {
    saveSettings({ ...settings, aiGroupingInterval: interval })
  }

  // 更新 AI 提供商配置
  const handleAIProviderChange = (
    field: keyof AIProviderConfig,
    value: string
  ) => {
    saveSettings({
      ...settings,
      aiProvider: {
        ...settings.aiProvider,
        [field]: value
      }
    })
  }

  // 处理模型选择变化
  const handleModelChange = (value: string) => {
    if (value === "custom") {
      // 如果选择自定义，将模型设置为"custom"
      handleAIProviderChange("model", "custom")
    } else {
      // 如果选择预设模型，直接更新
      handleAIProviderChange("model", value)
      setCustomModelName("")
    }
  }

  // 处理自定义模型名称变化
  const handleCustomModelNameChange = (value: string) => {
    setCustomModelName(value)
    // 当有实际输入时，直接更新到模型配置中
    if (value.trim()) {
      handleAIProviderChange("model", value)
    } else {
      // 如果输入为空，保持为"custom"
      handleAIProviderChange("model", "custom")
    }
  }

  // 更新自动重新分组设置
  const handleAutoRescheduleToggle = (enabled: boolean) => {
    saveSettings({ ...settings, autoReschedule: enabled })
  }

  // 测试 API 连接
  const handleTestApiConnection = async () => {
    try {
      setApiTestStatus({ loading: true, result: null })
      // 先保存当前设置以确保使用最新的配置
      await browser.storage.local.set({ settings })

      // 调用测试函数
      const result = await checkAiApiConnection()
      setApiTestStatus({ loading: false, result })

      // 如果测试失败，显示错误提示
      if (!result.success) {
        setErrorState({
          show: true,
          title: "API 连接测试失败",
          message: result.message
        })
      }
    } catch (error) {
      setApiTestStatus({
        loading: false,
        result: {
          success: false,
          message: error instanceof Error ? error.message : "未知错误"
        }
      })

      setErrorState({
        show: true,
        title: "API 连接测试出错",
        message: error instanceof Error ? error.message : "未知错误"
      })
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <header className="bg-blue-600 text-white py-4 px-6">
        <h1 className="text-2xl font-bold">AI 标签分组设置</h1>
      </header>

      <main className="p-6">
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">常规设置</h2>

          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">启用自动标签分组</h3>
                <p className="text-sm text-gray-600">
                  当打开新标签页时，自动应用分组规则
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.autoGroupEnabled}
                  onChange={(e) => handleAutoGroupToggle(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">启用 AI 分组</h3>
                <p className="text-sm text-gray-600">
                  使用 AI 分析标签页内容并自动创建分组
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.aiEnabled}
                  onChange={(e) => handleAiToggle(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">定期自动重新分组</h3>
                <p className="text-sm text-gray-600">
                  根据下方设置的间隔时间自动重新分组所有标签页
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.autoReschedule}
                  onChange={(e) => handleAutoRescheduleToggle(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="pt-2">
              <h3 className="font-medium mb-2">AI 分组间隔（分钟）</h3>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={settings.aiGroupingInterval}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>5</span>
                <span>15</span>
                <span>30</span>
                <span>45</span>
                <span>60</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                当前设置: 每 {settings.aiGroupingInterval} 分钟执行一次自动分组
                {!settings.autoReschedule && "（当前已禁用）"}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">AI 大模型配置</h2>
          <div className="space-y-4 p-4 border rounded-lg">
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900">
                API 域名
              </label>
              <input
                type="text"
                value={settings.aiProvider.endpoint}
                onChange={(e) =>
                  handleAIProviderChange("endpoint", e.target.value)
                }
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                placeholder="https://api.openai.com/v1"
              />
              <p className="text-xs text-gray-500 mt-1">
                默认为 OpenAI 的 API 地址，如需使用其他兼容服务，请更改
              </p>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900">
                API 密钥
              </label>
              <input
                type="password"
                value={settings.aiProvider.apiKey}
                onChange={(e) =>
                  handleAIProviderChange("apiKey", e.target.value)
                }
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                placeholder="sk-..."
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">
                  输入 API 密钥，密钥仅保存在本地
                </p>
                <button
                  onClick={handleTestApiConnection}
                  disabled={
                    apiTestStatus.loading || !settings.aiProvider.apiKey
                  }
                  className={`px-3 py-1 text-xs rounded-md ${
                    apiTestStatus.loading
                      ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                      : apiTestStatus.result?.success
                        ? "bg-green-500 text-white"
                        : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}>
                  {apiTestStatus.loading
                    ? "测试中..."
                    : apiTestStatus.result?.success
                      ? "连接正常"
                      : "测试连接"}
                </button>
              </div>
              {apiTestStatus.result && (
                <p
                  className={`text-xs mt-1 ${apiTestStatus.result.success ? "text-green-600" : "text-red-600"}`}>
                  {apiTestStatus.result.message}
                </p>
              )}
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900">
                模型名称
              </label>
              <select
                value={
                  presetModels.includes(settings.aiProvider.model)
                    ? settings.aiProvider.model
                    : "custom"
                }
                onChange={(e) => handleModelChange(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="claude-3-haiku">Claude 3 Haiku</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                <option value="claude-3-opus">Claude 3 Opus</option>
                <option value="custom">自定义...</option>
              </select>
              {(settings.aiProvider.model === "custom" ||
                !presetModels.includes(settings.aiProvider.model)) && (
                <input
                  type="text"
                  value={customModelName}
                  onChange={(e) => handleCustomModelNameChange(e.target.value)}
                  className="mt-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  placeholder="输入自定义模型名称"
                />
              )}
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900">
                系统提示语
              </label>
              <textarea
                value={settings.aiProvider.systemPrompt}
                onChange={(e) =>
                  handleAIProviderChange("systemPrompt", e.target.value)
                }
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                rows={5}
                placeholder="输入自定义的系统提示语，不填写将使用默认提示语"
              />
              <p className="text-xs text-gray-500 mt-1">
                设置AI模型的系统提示语，可以用来定制AI的行为。必须指导AI以JSON格式返回，格式为:{" "}
                {
                  '{"groups": [{"name": "分组名称", "color": "颜色", "tabIds": [标签页索引数组]}]}'
                }
              </p>
            </div>
          </div>
        </section>

        <section>
          <GroupRuleList />
        </section>
      </main>

      {/* 错误提示弹窗 */}
      {errorState.show && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-600">
                {errorState.title}
              </h3>
              <button
                onClick={closeError}
                className="text-gray-500 hover:text-gray-700">
                ×
              </button>
            </div>
            <p className="text-gray-700 mb-6">{errorState.message}</p>
            <button
              onClick={closeError}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
