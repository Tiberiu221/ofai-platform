import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../core/network/api_exceptions.dart';
import '../core/storage/secure_storage.dart';
import '../models/user.dart';
import '../services/push_notification_service.dart';
import 'favorites_provider.dart';
import 'subscriptions_provider.dart';

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
  final Ref _ref;

  AuthNotifier(this._api, this._ref) : super(const AuthState()) {
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
      PushNotificationService().initialize().catchError((e) {
        print('[Push] Init failed: $e');
      });
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

      // Invalidate stale favorites/subscriptions from any previous session
      _ref.invalidate(favoritesProvider);
      _ref.invalidate(subscriptionsProvider);

      // Register for push notifications
      PushNotificationService().initialize().catchError((e) {
        print('[Push] Init failed: $e');
      });
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

      // Invalidate stale favorites/subscriptions from any previous session
      _ref.invalidate(favoritesProvider);
      _ref.invalidate(subscriptionsProvider);

      // Register for push notifications
      PushNotificationService().initialize().catchError((e) {
        print('[Push] Init failed: $e');
      });
    } catch (e) {
      final msg = e is ApiException ? e.message : 'Eroare la înregistrare';
      state = state.copyWith(status: AuthStatus.unauthenticated, error: msg);
      rethrow;
    }
  }

  Future<void> loginWithGoogle() async {
    state = state.copyWith(status: AuthStatus.loading, error: null);
    try {
      final googleUser = await GoogleSignIn(
        serverClientId: AppConfig.googleClientId,
      ).signIn();
      if (googleUser == null) {
        state = state.copyWith(status: AuthStatus.unauthenticated);
        return;
      }

      final googleAuth = await googleUser.authentication;
      final idToken = googleAuth.idToken;
      if (idToken == null) {
        state = state.copyWith(status: AuthStatus.unauthenticated, error: 'Nu s-a putut obține token-ul Google');
        return;
      }

      final response = await _api.dio.post(ApiEndpoints.googleAuth, data: {
        'idToken': idToken,
      });

      final data = response.data;
      await SecureStorage.setAccessToken(data['token']);
      if (data['refreshToken'] != null) {
        await SecureStorage.setRefreshToken(data['refreshToken']);
      }

      final user = User.fromJson(data['user']);
      state = AuthState(status: AuthStatus.authenticated, user: user);

      // Invalidate stale favorites/subscriptions from any previous session
      _ref.invalidate(favoritesProvider);
      _ref.invalidate(subscriptionsProvider);

      PushNotificationService().initialize().catchError((e) {
        print('[Push] Init failed: $e');
      });
    } catch (e) {
      final msg = e is ApiException ? e.message : 'Eroare la autentificarea cu Google';
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

    // Clear cached data from other providers
    _ref.read(favoritesProvider.notifier).clear();
    _ref.read(subscriptionsProvider.notifier).clear();

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

  Future<void> updateProfilePicture(String filePath) async {
    try {
      final formData = FormData.fromMap({
        'profile_picture': await MultipartFile.fromFile(filePath, filename: 'profile.jpg'),
      });
      final response = await _api.dio.post(
        ApiEndpoints.userProfilePicture,
        data: formData,
      );
      final url = response.data['profile_picture_url'] as String?;
      if (url != null && state.user != null) {
        final u = state.user!;
        state = state.copyWith(user: User(
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          preferredCityIds: u.preferredCityIds,
          preferredCategoryIds: u.preferredCategoryIds,
          points: u.points,
          createdAt: u.createdAt,
          profilePictureUrl: url,
          hasPassword: u.hasPassword,
          badges: u.badges,
          showPictureInReviews: u.showPictureInReviews,
        ));
      }
    } catch (e) {
      final msg = e is ApiException ? e.message : 'Eroare la încărcarea pozei';
      throw ApiException(message: msg);
    }
  }

  Future<void> updateShowPictureInReviews(bool value) async {
    await _api.dio.put(ApiEndpoints.userMe, data: {
      'show_picture_in_reviews': value,
    });
    await refreshUser();
  }

  Future<void> deleteProfilePicture() async {
    try {
      await _api.dio.delete(ApiEndpoints.userProfilePicture);
      if (state.user != null) {
        final u = state.user!;
        state = state.copyWith(user: User(
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          preferredCityIds: u.preferredCityIds,
          preferredCategoryIds: u.preferredCategoryIds,
          points: u.points,
          createdAt: u.createdAt,
          profilePictureUrl: null,
          hasPassword: u.hasPassword,
          badges: u.badges,
          showPictureInReviews: u.showPictureInReviews,
          displayBadgeId: u.displayBadgeId,
        ));
      }
    } catch (e) {
      final msg = e is ApiException ? e.message : 'Eroare la ștergerea pozei';
      throw ApiException(message: msg);
    }
  }

  Future<void> updateDisplayBadge(int? badgeId) async {
    try {
      await _api.dio.put(ApiEndpoints.userMe, data: {'display_badge_id': badgeId});
      if (state.user != null) {
        final u = state.user!;
        state = state.copyWith(user: User(
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          preferredCityIds: u.preferredCityIds,
          preferredCategoryIds: u.preferredCategoryIds,
          points: u.points,
          createdAt: u.createdAt,
          profilePictureUrl: u.profilePictureUrl,
          hasPassword: u.hasPassword,
          badges: u.badges,
          showPictureInReviews: u.showPictureInReviews,
          displayBadgeId: badgeId,
        ));
      }
    } catch (e) {
      final msg = e is ApiException ? e.message : 'Eroare la actualizarea insignei';
      throw ApiException(message: msg);
    }
  }
}

// Provider
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ApiClient(), ref);
});
