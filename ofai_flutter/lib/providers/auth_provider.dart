import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../core/network/api_exceptions.dart';
import '../core/storage/secure_storage.dart';
import '../models/user.dart';
import '../services/push_notification_service.dart';

// Auth state
enum AuthStatus { initial, authenticated, unauthenticated, loading }

class AuthState {
  final AuthStatus status;
  final User? user;
  final String? error;

  const AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.error,
  });

  AuthState copyWith({AuthStatus? status, User? user, String? error}) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      error: error,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _api;

  AuthNotifier(this._api) : super(const AuthState()) {
    _api.onAuthFailure = _onAuthFailure;
    _checkAuth();
  }

  void _onAuthFailure() {
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  Future<void> _checkAuth() async {
    final token = await SecureStorage.getAccessToken();
    if (token == null) {
      state = const AuthState(status: AuthStatus.unauthenticated);
      return;
    }

    try {
      final response = await _api.dio.get(ApiEndpoints.me);
      final user = User.fromJson(response.data['user'] ?? response.data);
      state = AuthState(status: AuthStatus.authenticated, user: user);

      // Re-register push on app restart
      PushNotificationService().initialize();
    } catch (_) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading, error: null);
    try {
      final response = await _api.dio.post(ApiEndpoints.login, data: {
        'email': email,
        'password': password,
      });

      final data = response.data;
      await SecureStorage.setAccessToken(data['token']);
      if (data['refreshToken'] != null) {
        await SecureStorage.setRefreshToken(data['refreshToken']);
      }

      final user = User.fromJson(data['user']);
      state = AuthState(status: AuthStatus.authenticated, user: user);

      // Register for push notifications
      PushNotificationService().initialize();
    } catch (e) {
      final msg = e is ApiException ? e.message : 'Eroare la autentificare';
      state = state.copyWith(status: AuthStatus.unauthenticated, error: msg);
      rethrow;
    }
  }

  Future<void> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phone,
    required bool acceptTerms,
    required bool acceptPrivacy,
  }) async {
    state = state.copyWith(status: AuthStatus.loading, error: null);
    try {
      final response = await _api.dio.post(ApiEndpoints.register, data: {
        'email': email,
        'password': password,
        'first_name': firstName,
        'last_name': lastName,
        if (phone != null) 'phone': phone,
        'accept_terms': acceptTerms,
        'accept_privacy': acceptPrivacy,
      });

      final data = response.data;
      await SecureStorage.setAccessToken(data['token']);
      if (data['refreshToken'] != null) {
        await SecureStorage.setRefreshToken(data['refreshToken']);
      }

      final user = User.fromJson(data['user']);
      state = AuthState(status: AuthStatus.authenticated, user: user);

      // Register for push notifications
      PushNotificationService().initialize();
    } catch (e) {
      final msg = e is ApiException ? e.message : 'Eroare la înregistrare';
      state = state.copyWith(status: AuthStatus.unauthenticated, error: msg);
      rethrow;
    }
  }

  Future<void> logout() async {
    // Unregister push token before clearing auth
    await PushNotificationService().onLogout();

    try {
      final refreshToken = await SecureStorage.getRefreshToken();
      if (refreshToken != null) {
        await _api.dio.post(ApiEndpoints.logout, data: {
          'refreshToken': refreshToken,
        });
      }
    } catch (_) {
      // Best effort — even if server fails, clear local state
    }

    await SecureStorage.clearAll();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  Future<void> refreshUser() async {
    try {
      final response = await _api.dio.get(ApiEndpoints.me);
      final user = User.fromJson(response.data['user'] ?? response.data);
      state = state.copyWith(user: user);
    } catch (_) {
      // Silent fail — keep existing user
    }
  }
}

// Provider
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ApiClient());
});
