import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../core/storage/secure_storage.dart';

/// Top-level handler for background messages (required by Firebase — must be top-level function)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('[Push] Background message: ${message.messageId}');
}

class PushNotificationService {
  static final PushNotificationService _instance = PushNotificationService._internal();
  factory PushNotificationService() => _instance;
  PushNotificationService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  String? _currentToken;
  bool _initialized = false;

  /// Called after successful login/register to set up push notifications.
  Future<void> initialize() async {
    if (_initialized) return;

    try {
      // Register background handler
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      // Request permission (required for Android 13+ and iOS)
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('[Push] Permission denied by user');
        return;
      }

      // Get FCM token
      _currentToken = await _messaging.getToken();
      if (_currentToken != null) {
        debugPrint('[Push] FCM Token: ${_currentToken!.substring(0, 30)}...');
        await _registerTokenWithBackend(_currentToken!);
      }

      // Listen for token refresh
      _messaging.onTokenRefresh.listen((newToken) {
        debugPrint('[Push] Token refreshed');
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
      debugPrint('[Push] Service initialized');
    } catch (e) {
      debugPrint('[Push] Init error: $e');
    }
  }

  /// Register FCM token with backend
  Future<void> _registerTokenWithBackend(String token) async {
    try {
      final accessToken = await SecureStorage.getAccessToken();
      if (accessToken == null) return;

      await ApiClient().dio.post(
        ApiEndpoints.pushTokens,
        data: {
          'token': token,
          'platform': Platform.isAndroid ? 'android' : 'ios',
          'deviceName': '${Platform.operatingSystem} ${Platform.operatingSystemVersion}',
        },
      );
      debugPrint('[Push] Token registered with backend');
    } catch (e) {
      debugPrint('[Push] Token registration failed: $e');
    }
  }

  /// Handle foreground notification — just log for now
  void _handleForegroundMessage(RemoteMessage message) {
    debugPrint('[Push] Foreground: ${message.notification?.title}');
    // Foreground notifications are shown automatically by Firebase on Android
    // if a notification channel is configured. For custom handling, use
    // flutter_local_notifications package.
  }

  /// Handle notification tap — deep link to relevant screen
  void _handleNotificationTap(RemoteMessage message) {
    final data = message.data;
    final type = data['type'];

    // Navigation will be handled by the app's GoRouter.
    // Store the pending deep link for the router to pick up.
    if (type == 'new_offer' && data['offerId'] != null) {
      _pendingDeepLink = '/offer/${data['offerId']}';
    } else if (data['businessId'] != null) {
      _pendingDeepLink = '/business/${data['businessId']}';
    }

    debugPrint('[Push] Notification tap → $_pendingDeepLink');
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
      _currentToken = null;
      _initialized = false;
      debugPrint('[Push] Logout cleanup done');
    } catch (e) {
      debugPrint('[Push] Logout cleanup error: $e');
    }
  }
}
