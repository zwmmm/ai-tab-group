import {
  AdjustmentsHorizontalIcon,
  QueueListIcon,
  TrashIcon
} from "@heroicons/react/24/outline"
import { useEffect, useState } from "react"
import browser from "webextension-polyfill"

import type { TabGroup } from "../../types"

export const TabGroupList = () => {
  const [groups, setGroups] = useState<TabGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [isDeletingGroups, setIsDeletingGroups] = useState(false)
  const [isRegrouping, setIsRegrouping] = useState(false)

  const fetchGroups = async () => {
    setLoading(true)
    try {
      // 获取当前实际存在的标签分组
      const tabGroupsInfo = await browser.tabGroups.query({})

      // 将标签分组信息转换为我们使用的TabGroup格式
      const tabGroups: TabGroup[] = await Promise.all(
        tabGroupsInfo.map(async (group) => {
          // 获取该分组下的所有标签
          // @ts-ignore - Chrome API的groupId在某些类型定义中可能缺失
          const groupTabs = await browser.tabs.query({ groupId: group.id })

          return {
            id: `group-${group.id}`,
            name: group.title || "未命名分组",
            color: group.color || "blue",
            tabs: groupTabs
          }
        })
      )

      // 更新状态
      setGroups(tabGroups)
    } catch (error) {
      console.error("获取标签组失败:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [])

  // 删除所有标签页分组
  const handleDeleteAllGroups = async () => {
    if (!window.confirm("确定要删除所有分组吗？此操作不可恢复。")) {
      return
    }

    setIsDeletingGroups(true)
    try {
      // 发送消息到background脚本执行删除操作
      await browser.runtime.sendMessage({ action: "deleteAllGroups" })
      // 删除成功后刷新分组列表
      await fetchGroups()
      setIsDeletingGroups(false)
    } catch (error) {
      console.error("删除分组失败:", error)
      setIsDeletingGroups(false)
    }
  }

  const navigateToOptions = () => {
    browser.runtime.openOptionsPage()
  }

  // 重新分组所有标签页
  const handleRegroupAllTabs = async () => {
    setIsRegrouping(true)
    try {
      // 发送消息到background脚本执行重新分组操作
      const result = await browser.runtime.sendMessage({
        action: "regroupAllTabs"
      })
      console.log("重新分组结果:", result)

      // 重新分组成功后关闭弹窗
      window.close()
    } catch (error) {
      console.error("重新分组失败:", error)
      setIsRegrouping(false)
    }
  }

  // 计算要显示的分组
  const displayGroups = groups

  return (
    <div className="p-4 min-w-[350px]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">当前标签组</h2>
        <div className="flex space-x-2">
          <button
            onClick={navigateToOptions}
            className="p-1.5 rounded-md hover:bg-gray-100"
            title="设置">
            <AdjustmentsHorizontalIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {displayGroups.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {loading ? "正在分析标签页..." : "当前没有标签分组"}
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
            {displayGroups.map((group) => (
              <div
                key={group.id}
                className="p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: group.color }}
                  />
                  <h3 className="font-medium">{group.name}</h3>
                  <span className="ml-auto text-sm text-gray-500">
                    {group.tabs.length} 个标签页
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-600 line-clamp-2">
                  {group.tabs.map((tab) => tab.title).join(", ")}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleRegroupAllTabs}
            disabled={isRegrouping || isDeletingGroups}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 flex items-center justify-center gap-2">
            <QueueListIcon className="w-5 h-5" />
            <span>{isRegrouping ? "分组中..." : "重新分组"}</span>
          </button>
          <button
            onClick={handleDeleteAllGroups}
            disabled={isDeletingGroups || groups.length === 0}
            className={`py-2 ${groups.length === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"} text-white rounded-lg disabled:bg-gray-400 flex items-center justify-center gap-2`}>
            <TrashIcon className="w-5 h-5" />
            <span>{isDeletingGroups ? "删除中..." : "删除分组"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
