import { createContext, useContext, useState } from 'react'

const UiChromeContext = createContext(null)

export function UiChromeProvider({ children }) {
  const [hideChrome, setHideChrome] = useState(false)

  return (
    <UiChromeContext.Provider value={{ hideChrome, setHideChrome }}>
      {children}
    </UiChromeContext.Provider>
  )
}

export function useUiChrome() {
  return useContext(UiChromeContext)
}
