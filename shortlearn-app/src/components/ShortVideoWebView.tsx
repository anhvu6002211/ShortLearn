import React from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { VideoPlatform } from '../services/videoPlatform';

interface ShortVideoWebViewProps {
  platform: VideoPlatform;
  uri: string;
  injectedScript: string;
  webViewRef: React.RefObject<WebView | null>;
  onLoadEnd: () => void;
  onMessage: (event: any) => void;
}

export const ShortVideoWebView = React.memo<ShortVideoWebViewProps>(({
  platform,
  uri,
  injectedScript,
  webViewRef,
  onLoadEnd,
  onMessage,
}) => (
  <WebView
    key={platform}
    ref={webViewRef}
    source={{ uri }}
    userAgent="Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    injectedJavaScriptBeforeContentLoaded={injectedScript}
    injectedJavaScript={injectedScript}
    onLoadEnd={onLoadEnd}
    onMessage={onMessage}
    onShouldStartLoadWithRequest={(request) => {
      const url = request.url.toLowerCase();
      if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
      return url.includes('youtube.com/') || url.includes('googlevideo.com/');
    }}
    onOpenWindow={() => undefined}
    setSupportMultipleWindows={false}
    style={styles.webView}
    allowsInlineMediaPlayback
    mediaPlaybackRequiresUserAction={false}
    javaScriptEnabled
    domStorageEnabled
    cacheEnabled
    androidLayerType="hardware"
    overScrollMode="never"
    scrollEnabled
    nestedScrollEnabled
  />
));

ShortVideoWebView.displayName = 'ShortVideoWebView';

const styles = StyleSheet.create({
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
