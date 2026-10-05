import { RefObject, useCallback, useEffect, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { useAppRuntime } from '../providers/AppRuntimeProvider';

interface UseWebViewActivityOptions {
  active: boolean;
  injectedScript: string;
  onMessage: (event: any) => void | Promise<void>;
  webViewRef: RefObject<WebView | null>;
}

export const useWebViewActivity = ({
  active,
  injectedScript,
  onMessage,
  webViewRef,
}: UseWebViewActivityOptions) => {
  const { isForeground } = useAppRuntime();
  const injectedScriptRef = useRef(injectedScript);
  const onMessageRef = useRef(onMessage);
  const shouldRunRef = useRef(active && isForeground);

  injectedScriptRef.current = injectedScript;
  onMessageRef.current = onMessage;
  shouldRunRef.current = active && isForeground;

  const setWebViewActivity = useCallback((shouldRun: boolean) => {
    webViewRef.current?.postMessage(JSON.stringify({
      action: 'SET_APP_ACTIVE',
      active: shouldRun,
    }));
  }, [webViewRef]);

  const handleWebViewMessage = useCallback((event: any) => {
    void onMessageRef.current(event);
  }, []);

  const handleWebViewLoadEnd = useCallback(() => {
    webViewRef.current?.injectJavaScript(injectedScriptRef.current);
    setWebViewActivity(shouldRunRef.current);
  }, [setWebViewActivity, webViewRef]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setWebViewActivity(active && isForeground);
    }, 80);
    return () => clearTimeout(timer);
  }, [active, isForeground, setWebViewActivity]);

  return {
    handleWebViewLoadEnd,
    handleWebViewMessage,
  };
};
