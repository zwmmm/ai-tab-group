import { useEffect, useRef, useState } from "react"

import type { ColorOption } from "../../types"

// Chrome默认颜色
const chromeColors: ColorOption[] = [
  { name: "blue", value: "blue", label: "蓝色", origin: "chrome" },
  { name: "cyan", value: "cyan", label: "青色", origin: "chrome" },
  { name: "green", value: "green", label: "绿色", origin: "chrome" },
  { name: "grey", value: "grey", label: "灰色", origin: "chrome" },
  { name: "orange", value: "orange", label: "橙色", origin: "chrome" },
  { name: "pink", value: "pink", label: "粉色", origin: "chrome" },
  { name: "purple", value: "purple", label: "紫色", origin: "chrome" },
  { name: "red", value: "red", label: "红色", origin: "chrome" },
  { name: "yellow", value: "yellow", label: "黄色", origin: "chrome" }
]
// 颜色选择器弹窗组件
const ColorPickerModal = ({
  isOpen,
  onClose,
  value,
  onChange
}: {
  isOpen: boolean
  onClose: () => void
  value: string
  onChange: (color: string) => void
}) => {
  const [colorType, setColorType] = useState<
    "chrome" | "china" | "japan" | "custom"
  >("chrome")
  const [customColor, setCustomColor] = useState(value)
  const modalRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭弹窗
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onClose])

  // 根据当前选择的颜色类型获取颜色列表
  const getColors = () => {
    return chromeColors
  }

  // 处理颜色选择
  const handleColorSelect = (color: string) => {
    onChange(color)
    onClose()
  }

  // 处理自定义颜色变化
  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomColor(e.target.value)
  }

  // 应用自定义颜色
  const applyCustomColor = () => {
    onChange(customColor)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center backdrop-blur-sm">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl overflow-hidden max-w-md w-full max-h-[90vh] animate-fadeIn"
        style={{ animationDuration: "0.2s" }}>
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">选择颜色</h3>
        </div>

        <div className="p-4">
          <div className="max-h-60 overflow-y-auto pr-1">
            <div className="grid grid-cols-4 gap-2 p-2">
              {getColors().map((color) => (
                <div
                  key={color.name}
                  onClick={() => handleColorSelect(color.value)}
                  className={`cursor-pointer flex flex-col items-center p-1.5 rounded-md hover:bg-gray-100 transition-all ${
                    value === color.value
                      ? "ring-2 ring-blue-500 bg-blue-50"
                      : ""
                  }`}>
                  <div
                    className="w-8 h-8 rounded-full mb-1 shadow-sm"
                    style={{ backgroundColor: color.value }}
                  />
                  <span
                    className="text-xs text-center truncate w-full"
                    title={color.label}>
                    {color.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-100 text-sm mr-2">
            取消
          </button>
          <button
            onClick={() => onChange(value)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
            确认
          </button>
        </div>
      </div>
    </div>
  )
}

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export const ColorPicker = ({ value, onChange }: ColorPickerProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // 获取颜色标签名称
  const getColorLabel = (color: string): string => {
    const colorObj = findColorByValue(color)
    return colorObj?.label || color
  }

  // 打开颜色选择器弹窗
  const openColorPicker = () => {
    setIsModalOpen(true)
  }

  // 关闭颜色选择器弹窗
  const closeColorPicker = () => {
    setIsModalOpen(false)
  }

  return (
    <div>
      <div
        onClick={openColorPicker}
        className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
        <div
          className="w-6 h-6 rounded-full shadow-sm border border-gray-200"
          style={{ backgroundColor: value }}
        />
        <span className="text-sm flex-1">{getColorLabel(value)}</span>
        <span className="text-xs text-blue-600">选择</span>
      </div>

      <ColorPickerModal
        isOpen={isModalOpen}
        onClose={closeColorPicker}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}

// 导出所有颜色列表
export const getAllColors = (): ColorOption[] => {
  return [...chromeColors]
}

// 根据颜色值查找颜色对象
export const findColorByValue = (value: string): ColorOption | undefined => {
  return getAllColors().find((color) => color.value === value)
}

// 根据颜色名称查找颜色对象
export const findColorByName = (name: string): ColorOption | undefined => {
  return getAllColors().find((color) => color.name === name)
}
