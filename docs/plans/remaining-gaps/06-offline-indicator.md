# 06 - Offline Connectivity Indicator

## Context
App-ul nu are nicio detectie de conectivitate. Doar Dio error handling (timeout). Trebuie un banner persistent cand device-ul e offline.

## Fisiere de creat/modificat

### 1. pubspec.yaml — adauga connectivity_plus
**Fisier:** `ofai_flutter/pubspec.yaml` (dupa qr_flutter, ~linia 31)
```yaml
connectivity_plus: ^6.1.0
```
Ruleaza: `flutter pub get`

### 2. Connectivity provider (NOU)
**Fisier NOU:** `ofai_flutter/lib/providers/connectivity_provider.dart`
```dart
import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final connectivityProvider = StreamProvider<bool>((ref) {
  final connectivity = Connectivity();
  final controller = StreamController<bool>();

  connectivity.checkConnectivity().then((results) {
    controller.add(results.any((r) => r != ConnectivityResult.none));
  });

  final sub = connectivity.onConnectivityChanged.listen((results) {
    controller.add(results.any((r) => r != ConnectivityResult.none));
  });

  ref.onDispose(() { sub.cancel(); controller.close(); });
  return controller.stream;
});
```

### 3. Offline banner widget (NOU)
**Fisier NOU:** `ofai_flutter/lib/widgets/offline_banner.dart`
- ConsumerWidget care watch(connectivityProvider)
- Cand offline: banner rosu slim la top cu "Esti offline" + wifi_off icon
- Cand online: SizedBox.shrink()
- Respecta SafeArea (padding top = MediaQuery.of(context).padding.top)

### 4. Adauga banner in app shell
**Fisier:** `ofai_flutter/lib/app.dart`
In `_ShellScreen.build()`, wrapeaza body-ul Scaffold-ului in Stack:
```dart
body: Stack(
  children: [
    widget.child,
    const Positioned(top: 0, left: 0, right: 0, child: OfflineBanner()),
  ],
),
```

## Verificare
1. `flutter pub get` + `flutter analyze`
2. Device fizic: airplane mode → banner rosu apare
3. Dezactiveaza airplane mode → banner dispare
4. Navigheaza intre tab-uri offline → banner persist
