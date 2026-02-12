import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';

  // Access token
  static Future<String?> getAccessToken() =>
      _storage.read(key: _accessTokenKey);

  static Future<void> setAccessToken(String token) =>
      _storage.write(key: _accessTokenKey, value: token);

  static Future<void> deleteAccessToken() =>
      _storage.delete(key: _accessTokenKey);

  // Refresh token
  static Future<String?> getRefreshToken() =>
      _storage.read(key: _refreshTokenKey);

  static Future<void> setRefreshToken(String token) =>
      _storage.write(key: _refreshTokenKey, value: token);

  static Future<void> deleteRefreshToken() =>
      _storage.delete(key: _refreshTokenKey);

  // Clear all
  static Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
