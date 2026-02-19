import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../core/network/api_exceptions.dart';
import '../core/theme/app_colors.dart';

class ErrorHandler {
  static String userMessage(dynamic error) {
    if (error is ApiException) return error.message;
    if (error is DioException) return ApiException.fromDioError(error).message;
    return 'Ceva nu a mers bine. Incearca din nou.';
  }

  static void show(BuildContext context, dynamic error) {
    final msg = userMessage(error);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: AppColors.bgSecondary,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
      ),
    );
  }
}
