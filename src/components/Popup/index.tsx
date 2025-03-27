import { useEffect, useState } from "react"
import browser from "webextension-polyfill"

import { TabGroupList } from "./TabGroupList"

export const Popup = () => {
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

  // 监听错误消息
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === "showError") {
        setErrorState({
          show: true,
          title: message.title || "错误",
          message: message.message || "发生了未知错误"
        })

        // 5秒后自动关闭错误提示
        setTimeout(() => {
          setErrorState((prev) => ({ ...prev, show: false }))
        }, 5000)

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

  return (
    <div className="bg-white">
      <header className="bg-blue-600 text-white py-3 px-4">
        <h1 className="text-xl font-bold">AI 标签分组</h1>
      </header>

      <main>
        <TabGroupList />
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
