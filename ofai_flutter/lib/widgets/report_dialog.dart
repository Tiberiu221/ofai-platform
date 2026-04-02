import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/network/api_client.dart';
import 'package:dio/dio.dart';
import '../core/network/api_endpoints.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';

/// Report reason option
class _ReportReason {
  final String key;
  final String label;
  const _ReportReason(this.key, this.label);
}

List<_ReportReason> _getOfferReasons(AppLocalizations l10n) => [
  _ReportReason('fake_offer', l10n.reportFakeOffer),
  _ReportReason('misleading_price', l10n.reportMisleadingPrice),
  _ReportReason('inappropriate_content', l10n.reportInappropriate),
  _ReportReason('spam', l10n.reportSpam),
  _ReportReason('other', l10n.reportOther),
];

List<_ReportReason> _getBusinessReasons(AppLocalizations l10n) => [
  _ReportReason('closed_business', l10n.reportClosedBusiness),
  _ReportReason('inappropriate_content', l10n.reportInappropriate),
  _ReportReason('spam', l10n.reportSpam),
  _ReportReason('other', l10n.reportOther),
];

/// Shows a report bottom sheet for an offer or business.
/// Returns true if report was submitted successfully.
Future<bool> showReportDialog({
  required BuildContext context,
  required String targetType,
  required int targetId,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.bgSecondary,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => _ReportSheet(targetType: targetType, targetId: targetId),
  );
  return result ?? false;
}

class _ReportSheet extends StatefulWidget {
  final String targetType;
  final int targetId;

  const _ReportSheet({required this.targetType, required this.targetId});

  @override
  State<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<_ReportSheet> {
  String? _selectedReason;
  final _detailsController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context)!;
    if (_selectedReason == null) return;
    if (_selectedReason == 'other' && _detailsController.text.trim().length < 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.reportDetailsMinLength)),
      );
      return;
    }

    setState(() => _submitting = true);

    try {
      await ApiClient().dio.post(
        ApiEndpoints.reports,
        data: {
          'target_type': widget.targetType,
          'target_id': widget.targetId,
          'reason': _selectedReason,
          if (_detailsController.text.trim().isNotEmpty)
            'details': _detailsController.text.trim(),
        },
      );
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        final l10n = AppLocalizations.of(context)!;
        String msg = l10n.reportErrorGeneric;
        if (e is DioException && e.response?.statusCode == 409) {
          msg = l10n.reportErrorDuplicate;
        } else if (e is DioException && e.response?.statusCode == 429) {
          msg = l10n.reportErrorRateLimit;
        }
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final reasons = widget.targetType == 'offer'
        ? _getOfferReasons(l10n)
        : _getBusinessReasons(l10n);

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle bar
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.textTertiary,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            widget.targetType == 'offer' ? l10n.reportOfferTitle : l10n.reportBusinessTitle,
            style: AppTypography.headlineSmall,
          ),
          const SizedBox(height: 4),
          Text(
            l10n.reportSelectReason,
            style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 16),
          RadioGroup<String>(
            groupValue: _selectedReason ?? '',
            onChanged: (v) => setState(() => _selectedReason = v),
            child: Column(
              children: reasons.map((r) => RadioListTile<String>(
                value: r.key,
                title: Text(r.label, style: AppTypography.bodyMedium),
                activeColor: AppColors.accent,
                contentPadding: EdgeInsets.zero,
                visualDensity: VisualDensity.compact,
              )).toList(),
            ),
          ),
          if (_selectedReason == 'other') ...[
            const SizedBox(height: 8),
            TextField(
              controller: _detailsController,
              maxLength: 500,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: l10n.reportDetailsHint,
                hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.textTertiary.withValues(alpha: 0.3)),
                ),
              ),
              style: AppTypography.bodyMedium,
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _selectedReason != null && !_submitting ? _submit : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(l10n.reportSubmitBtn),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
