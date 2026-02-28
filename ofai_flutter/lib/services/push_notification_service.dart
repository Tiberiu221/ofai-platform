import 'dart:async';
import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../core/storage/secure_storage.dart';

/// Top-level handler for background messages (required by Firebase — must be top-level function)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('[Push] Background message: ${message.messageId}');
}

class PushNotificationService {
  static final PushNotificationService _instance = PushNotificationService._internal();
  factory PushNotificationService() => _instance;
  PushNotificationService._internal();

  // Lazy getter — only access after Firebase.initializeApp() has completed
  FirebaseMessaging get _messaging => FirebaseMessaging.instance;
  String? _currentToken;
  bool _initialized = false;
  StreamSubscription<String>? _tokenRefreshSubscription;

  /// Called after successful login/register to set up push notifications.
  Future<void> initialize() async {
    print('[Push] initialize() called, _initialized=$_initialized');
    if (_initialized) return;

    try {
      // Register background handler
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
      print('[Push] Background handler registered');

      // Request permission (required for Android 13+ and iOS)
      print('[Push] Requesting permission...');
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );
      print('[Push] Permission status: ${settings.authorizationStatus}');

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        print('[Push] Permission denied by user');
        return;
      }

      // Get FCM token
      print('[Push] Getting FCM token...');
      _currentToken = await _messaging.getToken();
      if (_currentToken != null) {
        print('[Push] FCM Token: ${_currentToken!.substring(0, 30)}...');
        await _registerTokenWithBackend(_currentToken!);
      } else {
        print('[Push] FCM token is null!');
      }

      // Listen for token refresh — store subscription so it can be cancelled on logout
      _tokenRefreshSubscription = _messaging.onTokenRefresh.listen((newToken) {
        print('[Push] Token refreshed');
        _currentToken = newToken;
        _registerTokenWithBackend(newToken);
      });

      // Foreground messages
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

      // Notification tap when app was in background
      FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

      // Check if app was opened from a terminated state via notification
      final initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) {
        _handleNotificationTap(initialMessage);
      }

      _initialized = true;
      print('[Push] Service initialized successfully');
    } catch (e, stack) {
      print('[Push] Init error: $e');
      print('[Push] Stack: $stack');
    }
  }

  /// Register FCM token with backend (with retry logic)
  Future<void> _registerTokenWithBackend(String token) async {
    final maxAttempts = 3;

    for (int attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        final accessToken = await SecureStorage.getAccessToken();
        if (accessToken == null) {
          print('[Push] No access token, skipping registration');
          return;
        }

        await ApiClient().dio.post(
          ApiEndpoints.pushTokens,
          data: {
            'token': token,
            'platform': Platform.isAndroid ? 'android' : 'ios',
            'deviceName': '${Platform.operatingSystem} ${Platform.operatingSystemVersion}',
          },
        );
        print('[Push] Token registered with backend (attempt ${attempt + 1})');
        return; // Success, exit early
      } catch (e) {
        if (attempt < maxAttempts - 1) {
          final delaySeconds = (attempt + 1) * 2; // 2s, 4s
          print('[Push] Token registration failed (attempt ${attempt + 1}), retrying in ${delaySeconds}s: $e');
          await Future.delayed(Duration(seconds: delaySeconds));
        } else {
          print('[Push] Failed to register token after $maxAttempts attempts: $e');
        }
      }
    }
  }

  /// Handle foreground notification — just log for now
  void _handleForegroundMessage(RemoteMessage message) {
    print('[Push] Foreground: ${message.notification?.title}');
  }

  /// Handle notification tap — deep link to relevant screen
  void _handleNotificationTap(RemoteMessage message) {
    final data = message.data;
    final type = data['type'];

    if (type == 'new_offer' && data['offerId'] != null) {
      final id = int.tryParse(data['offerId'].toString());
      if (id != null) _pendingDeepLink = '/offer/$id';
    } else if (data['businessId'] != null) {
      final id = int.tryParse(data['businessId'].toString());
      if (id != null) _pendingDeepLink = '/business/$id';
    }

    print('[Push] Notification tap -> $_pendingDeepLink');
  }

  /// Pending deep link from notification tap (consumed by router)
  String? _pendingDeepLink;

  /// Consume the pending deep link (call from router redirect)
  String? consumePendingDeepLink() {
    final link = _pendingDeepLink;
    _pendingDeepLink = null;
    return link;
  }

  /// Called on logout — unregister token from backend and clean up
  Future<void> onLogout() async {
    try {
      if (_currentToken != null) {
        final accessToken = await SecureStorage.getAccessToken();
        if (accessToken != null) {
          await ApiClient().dio.delete(
            ApiEndpoints.pushTokens,
            data: {'token': _currentToken},
          );
        }
      }
      await _messaging.deleteToken();
      await _tokenRefreshSubscription?.cancel();
      _tokenRefreshSubscription = null;
      _currentToken = null;
      _initialized = false;
      print('[Push] Logout cleanup done');
    } catch (e) {
      print('[Push] Logout cleanup error: $e');
    }
  }
}
