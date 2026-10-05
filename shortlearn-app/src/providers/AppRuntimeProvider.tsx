import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface AppRuntimeContextValue {
  appState: AppStateStatus;
  isForeground: boolean;
}

const AppRuntimeContext = createContext<AppRuntimeContextValue | null>(null);

export const AppRuntimeProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  const value = useMemo(() => ({
    appState,
    isForeground: appState === 'active',
  }), [appState]);

  return (
    <AppRuntimeContext.Provider value={value}>
      {children}
    </AppRuntimeContext.Provider>
  );
};

export const useAppRuntime = (): AppRuntimeContextValue => {
  const value = useContext(AppRuntimeContext);
  if (!value) {
    throw new Error('useAppRuntime must be used inside AppRuntimeProvider.');
  }
  return value;
};
