# SentinelWatch Mobile

Flutter rebuild scaffold for **SentinelWatch** (`com.sentinelwatch.sentinelwatch_mobile`) v1.4.0.

## Setup

```bash
export PATH="$HOME/.local/flutter/bin:$PATH"
flutter pub get
flutter run
```

## Layout

```
lib/
  main.dart
  app.dart
  theme/app_theme.dart
  models/crisis_event.dart
  services/
    auth_service.dart
    crisis_data_service.dart
    offline_cache_service.dart
  screens/
    splash → onboarding → auth → home (map) → settings
  widgets/
    splash_screen, crisis map marker, crisis info sheet
```

## Notes

- Reference APK: `_incoming/sentinelwatch-latest.apk` (pulled from phone)
- Brand assets: `assets/icon.png`, `assets/logo.svg`
- API base URL defaults to `http://10.0.2.2:8001` (Android emulator → host). Override with `--dart-define=API_BASE_URL=...`
