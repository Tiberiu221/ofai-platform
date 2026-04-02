import 'dart:async';
import 'dart:io';
import 'package:dio/dio.dart';

/// Dio interceptor that retries failed requests with exponential backoff.
///
/// Retries on:
/// - Network errors (connection/receive/send timeout, SocketException)
/// - 5xx server errors
///
/// Does NOT retry on:
/// - 4xx client errors (bad request, unauthorized, forbidden, not found, etc.)
/// - 401 specifically — handled upstream by the AuthInterceptor (token refresh)
class RetryInterceptor extends Interceptor {
  final Dio dio;
  final int maxRetries;

  RetryInterceptor({required this.dio, this.maxRetries = 3});

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (_shouldRetry(err) && _getRetryCount(err) < maxRetries) {
      final retryCount = _getRetryCount(err) + 1;
      // Exponential backoff: 1s, 2s, 4s
      final delay = Duration(seconds: 1 << (retryCount - 1));

      await Future.delayed(delay);

      try {
        final options = err.requestOptions;
        options.extra['retryCount'] = retryCount;
        final response = await dio.fetch(options);
        handler.resolve(response);
        return;
      } on DioException catch (e) {
        // Let the error cascade to the next retry attempt or final handler
        handler.next(e);
        return;
      }
    }
    handler.next(err);
  }

  bool _shouldRetry(DioException err) {
    // Retry on network/timeout errors
    if (err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.sendTimeout ||
        err.error is SocketException) {
      return true;
    }

    // Retry on 5xx server errors only — never retry 4xx client errors
    final statusCode = err.response?.statusCode;
    if (statusCode != null && statusCode >= 500) {
      return true;
    }

    return false;
  }

  int _getRetryCount(DioException err) {
    return err.requestOptions.extra['retryCount'] as int? ?? 0;
  }
}
