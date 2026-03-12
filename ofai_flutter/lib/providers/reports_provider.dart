import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../models/report.dart';

class ReportsState {
  final List<UserReport> reports;
  final bool isLoading;
  final String? error;

  const ReportsState({
    this.reports = const [],
    this.isLoading = false,
    this.error,
  });

  ReportsState copyWith({
    List<UserReport>? reports,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return ReportsState(
      reports: reports ?? this.reports,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class ReportsNotifier extends StateNotifier<ReportsState> {
  final ApiClient _api;

  ReportsNotifier(this._api) : super(const ReportsState());

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _api.dio.get(ApiEndpoints.myReports);
      final List<dynamic> data = response.data ?? [];
      final reports = data.map((e) => UserReport.fromJson(e as Map<String, dynamic>)).toList();
      state = state.copyWith(reports: reports, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Nu s-au putut incarca rapoartele');
    }
  }

  Future<bool> withdraw(int id) async {
    try {
      await _api.dio.delete(ApiEndpoints.deleteReport(id));
      state = state.copyWith(
        reports: state.reports.where((r) => r.id != id).toList(),
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}

final reportsProvider = StateNotifierProvider.autoDispose<ReportsNotifier, ReportsState>((ref) {
  return ReportsNotifier(ApiClient());
});
