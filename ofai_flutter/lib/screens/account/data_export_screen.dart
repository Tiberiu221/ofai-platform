import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';

class DataExportScreen extends StatefulWidget {
  const DataExportScreen({super.key});

  @override
  State<DataExportScreen> createState() => _DataExportScreenState();
}

class _DataExportScreenState extends State<DataExportScreen> {
  Map<String, dynamic>? _data;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchExport();
  }

  Future<void> _fetchExport() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await ApiClient().dio.get(ApiEndpoints.userExport);
      setState(() {
        _data = response.data as Map<String, dynamic>;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _shareJson() async {
    if (_data == null) return;
    final jsonStr = const JsonEncoder.withIndent('  ').convert(_data);
    await Share.share(jsonStr, subject: 'OFAI - Datele mele');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Datele mele'),
        backgroundColor: AppColors.bgPrimary,
        actions: [
          if (_data != null)
            IconButton(
              icon: const Icon(Icons.share),
              onPressed: _shareJson,
            ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.accent));
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Eroare la export', style: AppTypography.headlineSmall),
            const SizedBox(height: AppSpacing.md),
            ElevatedButton(onPressed: _fetchExport, child: const Text('Reîncearcă')),
          ],
        ),
      );
    }

    if (_data == null) return const SizedBox.shrink();

    final jsonStr = const JsonEncoder.withIndent('  ').convert(_data);

    return Column(
      children: [
        // Info banner
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.md),
          margin: const EdgeInsets.all(AppSpacing.pagePadding),
          decoration: BoxDecoration(
            color: AppColors.accentMuted,
            borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
            border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              const Icon(Icons.info_outline, color: AppColors.accent, size: 20),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Acestea sunt toate datele tale stocate pe platforma OFAI, conform GDPR.',
                  style: AppTypography.bodySmall.copyWith(color: AppColors.accent),
                ),
              ),
            ],
          ),
        ),

        // JSON content
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.bgSecondary,
                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
              ),
              child: SelectableText(
                jsonStr,
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.textSecondary,
                  fontFamily: 'monospace',
                ),
              ),
            ),
          ),
        ),

        // Share button
        Padding(
          padding: const EdgeInsets.all(AppSpacing.pagePadding),
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _shareJson,
              icon: const Icon(Icons.share),
              label: const Text('Partajează datele'),
            ),
          ),
        ),
      ],
    );
  }
}
