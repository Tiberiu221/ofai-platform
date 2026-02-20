import 'dart:async';
import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';
import 'api_endpoints.dart';
import 'api_exceptions.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;
  bool _isRefreshing = false;
  final List<Completer<void>> _refreshQueue = [];

  // Callback to notify auth state when refresh fails
  void Function()? onAuthFailure;

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Client': 'mobile',
        },
      ),
    );

    dio.interceptors.add(_AuthInterceptor(this));
  }

  // Perform token refresh
  Future<bool> _refreshToken() async {
    final refreshToken = await SecureStorage.getRefreshToken();
    if (refreshToken == null) return false;

    try {
      // Use a separate Dio instance to avoid interceptor loop
      final refreshDio = Dio(BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
      ));

      final response = await refreshDio.post(
        ApiEndpoints.refresh,
        data: {'refreshToken': refreshToken},
      );

      final data = response.data;
      final newAccessToken = data['token'] as String?;
      final newRefreshToken = data['refreshToken'] as String?;

      if (newAccessToken != null) {
        await SecureStorage.setAccessToken(newAccessToken);
        if (newRefreshToken != null) {
          await SecureStorage.setRefreshToken(newRefreshToken);
        }
        return true;
      }
    } catch (_) {
      // Refresh failed — clear tokens
      await SecureStorage.clearAll();
    }
    return false;
  }
}

class _AuthInterceptor extends Interceptor {
  final ApiClient _client;

  _AuthInterceptor(this._client);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // Skip auth header for auth endpoints (login, register, refresh)
    final isAuthEndpoint = options.path == ApiEndpoints.login ||
        options.path == ApiEndpoints.register ||
        options.path == ApiEndpoints.refresh ||
        options.path == ApiEndpoints.forgotPassword ||
        options.path == ApiEndpoints.verifyResetCode ||
        options.path == ApiEndpoints.resetPassword ||
        options.path == ApiEndpoints.googleAuth;

    if (!isAuthEndpoint) {
      final token = await SecureStorage.getAccessToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }

    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    // Only attempt refresh on 401
    if (err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    // Don't retry refresh endpoint
    if (err.requestOptions.path == ApiEndpoints.refresh) {
      _client.onAuthFailure?.call();
      handler.next(err);
      return;
    }

    // Dedup refresh: if already refreshing, wait for it
    if (_client._isRefreshing) {
      final completer = Completer<void>();
      _client._refreshQueue.add(completer);
      try {
        await completer.future;
        // Retry original request with new token
        final token = await SecureStorage.getAccessToken();
        if (token != null) {
          err.requestOptions.headers['Authorization'] = 'Bearer $token';
          final response = await _client.dio.fetch(err.requestOptions);
          handler.resolve(response);
          return;
        }
      } catch (_) {
        // Refresh failed
      }
      handler.next(err);
      return;
    }

    // Perform refresh
    _client._isRefreshing = true;
    final success = await _client._refreshToken();
    _client._isRefreshing = false;

    // Resolve all queued requests
    for (final completer in _client._refreshQueue) {
      if (success) {
        completer.complete();
      } else {
        completer.completeError('Refresh failed');
      }
    }
    _client._refreshQueue.clear();

    if (success) {
      // Retry original request
      final token = await SecureStorage.getAccessToken();
      if (token != null) {
        err.requestOptions.headers['Authorization'] = 'Bearer $token';
        try {
          final response = await _client.dio.fetch(err.requestOptions);
          handler.resolve(response);
          return;
        } catch (e) {
          handler.next(err);
          return;
        }
      }
    }

    // Refresh failed — notify auth failure
    _client.onAuthFailure?.call();
    handler.next(err);
  }
}
