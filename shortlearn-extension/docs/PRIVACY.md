# Privacy — ShortLearn Extension

ShortLearn processes visible caption text to render bilingual subtitles. It does not collect YouTube, TikTok, or Instagram cookies or credentials.

ShortLearn account credentials are sent only to the API URL chosen by the user. Session tokens stay in Chrome extension storage and are never inserted into website DOM. Saved words may include the selected word, meaning, caption context, supported platform, real video ID when available, and playback timestamp.

Tab audio capture starts only after an explicit user action and stops on request. The current build does not upload or transcribe audio. A future remote STT mode requires separate explicit consent.

Users can sign out to revoke the backend refresh token and clear the local ShortLearn session. Website account data and platform cookies are unaffected.