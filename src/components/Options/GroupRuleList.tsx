import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon
} from "@heroicons/react/24/outline"
import { useEffect, useState } from "react"

import { getRules, saveRules } from "../../services/tabService"
import type { GroupRule } from "../../types"
import { ColorPicker, findColorByValue } from "./ColorPicker"

export const GroupRuleList = () => {
  const [rules, setRules] = useState<GroupRule[]>([])
  const [newRule, setNewRule] = useState<Partial<GroupRule>>({
    name: "",
    type: "domain",
    pattern: "",
    enabled: true,
    color: "#4285F4" // 默认蓝色，使用十六进制颜色值
  })

  // 跟踪正在编辑的规则
  const [editingRule, setEditingRule] = useState<string | null>(null)

  // 编辑规则的临时状态
  const [editFormData, setEditFormData] = useState<Partial<GroupRule>>({})

  // 页面加载时获取现有规则
  useEffect(() => {
    const fetchRules = async () => {
      const savedRules = await getRules()
      if (savedRules.length > 0) {
        // 转换旧的颜色名称为十六进制值
        const updatedRules = savedRules.map((rule) => {
          // 如果颜色是旧式名称（例如"blue"）则转换为十六进制值
          if (rule.color && !rule.color.startsWith("#")) {
            const chromeColorMap: Record<string, string> = {
              blue: "#4285F4",
              red: "#EA4335",
              green: "#34A853",
              yellow: "#FBBC05",
              purple: "#A142F4",
              cyan: "#24C1E0",
              orange: "#FA7B17",
              pink: "#F06292",
              grey: "#9AA0A6"
            }
            return { ...rule, color: chromeColorMap[rule.color] || "#4285F4" }
          }
          return rule
        })
        setRules(updatedRules)
      }
    }

    fetchRules()
  }, [])

  // 保存规则到存储
  const handleSaveRules = async () => {
    await saveRules(rules)
  }

  // 规则变更时自动保存
  useEffect(() => {
    if (rules.length > 0) {
      handleSaveRules()
    }
  }, [rules])

  // 添加新规则
  const handleAddRule = () => {
    if (!newRule.name || !newRule.pattern) return

    const rule: GroupRule = {
      id: `rule-${Date.now()}`,
      name: newRule.name,
      type: newRule.type as "domain" | "ai" | "custom",
      pattern: newRule.pattern,
      enabled: true,
      color: newRule.color
    }

    setRules([...rules, rule])
    setNewRule({
      name: "",
      type: "domain",
      pattern: "",
      enabled: true,
      color: "#4285F4"
    })
  }

  // 删除规则
  const handleDeleteRule = (id: string) => {
    setRules(rules.filter((rule) => rule.id !== id))
    if (editingRule === id) {
      setEditingRule(null)
    }
  }

  // 更新规则状态
  const handleToggleRule = (id: string) => {
    setRules(
      rules.map((rule) =>
        rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
      )
    )
  }

  // 处理颜色变更
  const handleColorChange = (value: string) => {
    setNewRule({ ...newRule, color: value })
  }

  // 开始编辑规则
  const startEditRule = (rule: GroupRule) => {
    setEditFormData({ ...rule })
    setEditingRule(rule.id)
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingRule(null)
    setEditFormData({})
  }

  // 保存编辑后的规则
  const saveEditedRule = () => {
    if (!editFormData.name || !editFormData.pattern || !editingRule) return

    setRules(
      rules.map((rule) =>
        rule.id === editingRule
          ? {
              ...rule,
              name: editFormData.name || rule.name,
              type:
                (editFormData.type as "domain" | "ai" | "custom") || rule.type,
              pattern: editFormData.pattern || rule.pattern,
              color: editFormData.color || rule.color
            }
          : rule
      )
    )

    setEditingRule(null)
    setEditFormData({})
  }

  // 处理编辑表单变更
  const handleEditFormChange = (field: keyof GroupRule, value: any) => {
    setEditFormData({ ...editFormData, [field]: value })
  }

  // 获取颜色标签名称
  const getColorLabel = (color: string): string => {
    const colorObj = findColorByValue(color)
    return colorObj?.label || color
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">分组规则</h2>

      <div className="mb-6 p-4 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-medium mb-3">添加新规则</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              规则名称
            </label>
            <input
              type="text"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例如: 社交媒体"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              规则类型
            </label>
            <select
              value={newRule.type}
              onChange={(e) =>
                setNewRule({ ...newRule, type: e.target.value as any })
              }
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="domain">域名匹配</option>
              <option value="custom">自定义匹配</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              匹配模式
            </label>
            <input
              type="text"
              value={newRule.pattern}
              onChange={(e) =>
                setNewRule({ ...newRule, pattern: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={
                newRule.type === "domain"
                  ? "例如: facebook.com, twitter.com"
                  : "自定义匹配规则"
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              标签组颜色
            </label>
            <ColorPicker
              value={newRule.color || "#4285F4"}
              onChange={handleColorChange}
            />
          </div>
        </div>

        <button
          onClick={handleAddRule}
          disabled={!newRule.name || !newRule.pattern}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          <span>添加规则</span>
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          没有配置规则，请添加一条规则来开始
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="border rounded-lg hover:bg-gray-50">
              {editingRule === rule.id ? (
                // 编辑模式
                <div className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium">编辑规则</h3>
                    <button
                      onClick={cancelEdit}
                      className="p-1 text-gray-500 hover:text-gray-700">
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        规则名称
                      </label>
                      <input
                        type="text"
                        value={editFormData.name || ""}
                        onChange={(e) =>
                          handleEditFormChange("name", e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        规则类型
                      </label>
                      <select
                        value={editFormData.type || "domain"}
                        onChange={(e) =>
                          handleEditFormChange("type", e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border rounded-md">
                        <option value="domain">域名匹配</option>
                        <option value="custom">自定义匹配</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        匹配模式
                      </label>
                      <input
                        type="text"
                        value={editFormData.pattern || ""}
                        onChange={(e) =>
                          handleEditFormChange("pattern", e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        标签组颜色
                      </label>
                      <ColorPicker
                        value={editFormData.color || "#4285F4"}
                        onChange={(color) =>
                          handleEditFormChange("color", color)
                        }
                      />
                    </div>
                  </div>

                  <div className="flex justify-end mt-3">
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1 mr-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100">
                      取消
                    </button>
                    <button
                      onClick={saveEditedRule}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                // 查看模式
                <div className="flex items-center px-4 py-3 justify-between">
                  <div className="flex items-center mr-2">
                    <div
                      className="w-4 h-4 rounded-full mr-2 flex-shrink-0"
                      style={{ backgroundColor: rule.color }}
                    />
                    <div className="overflow-hidden">
                      <h3 className="font-medium text-sm truncate">
                        {rule.name}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">
                        {rule.type === "domain" ? "域名: " : "自定义: "}
                        <span className="font-mono">{rule.pattern}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full mr-2 ${
                        rule.enabled
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                      {rule.enabled ? "已启用" : "已禁用"}
                    </span>

                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className={`px-2 py-1 text-xs rounded ${
                        rule.enabled
                          ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                          : "bg-green-100 text-green-800 hover:bg-green-200"
                      }`}>
                      {rule.enabled ? "禁用" : "启用"}
                    </button>

                    <button
                      onClick={() => startEditRule(rule)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="编辑规则">
                      <PencilIcon className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="删除规则">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
