import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic data;

  ApiException({
    required this.message,
    this.statusCode,
    this.data,
  });

  factory ApiException.fromDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException(
          message: 'Conexiunea a expirat. Verifică conexiunea la internet.',
          statusCode: null,
        );

      case DioExceptionType.connectionError:
        return ApiException(
          message: 'Nu s-a putut conecta la server.',
          statusCode: null,
        );

      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        final data = error.response?.data;
        String message = 'Eroare server';

        if (data is Map<String, dynamic>) {
          message = data['error'] as String? ??
              data['message'] as String? ??
              'Eroare necunoscută';
        }

        return ApiException(
          message: message,
          statusCode: statusCode,
          data: data,
        );

      case DioExceptionType.cancel:
        return ApiException(message: 'Cererea a fost anulată.');

      default:
        return ApiException(message: 'Eroare de rețea necunoscută.');
    }
  }

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class UnauthorizedException extends ApiException {
  UnauthorizedException() : super(message: 'Sesiunea a expirat.', statusCode: 401);
}

/// Convert any error to a user-friendly Romanian message.
/// Use this instead of `e.toString()` in providers.
String friendlyError(dynamic e) {
  if (e is ApiException) return e.message;
  if (e is DioException) return ApiException.fromDioError(e).message;
  return 'Eroare neasteptata. Incearca din nou.';
}
