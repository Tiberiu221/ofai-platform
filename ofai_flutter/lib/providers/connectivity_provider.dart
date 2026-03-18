import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Emits `true` when online, `false` when offline.
final connectivityProvider = StreamProvider<bool>((ref) {
  final connectivity = Connectivity();
  final controller = StreamController<bool>();

  connectivity.checkConnectivity().then((results) {
    controller.add(results.any((r) => r != ConnectivityResult.none));
  });

  final sub = connectivity.onConnectivityChanged.listen((results) {
    controller.add(results.any((r) => r != ConnectivityResult.none));
  });

  ref.onDispose(() {
    sub.cancel();
    controller.close();
  });

  return controller.stream;
});
