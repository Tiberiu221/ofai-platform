import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';

/// Report reason option
class _ReportReason {
  final String key;
  final String label;
  const _ReportReason(this.key, this.label);
}

const _offerReasons = [
  _ReportReason('fake_offer', 'Oferta nu este reala'),
  _ReportReason('misleading_price', 'Pret inselator'),
  _ReportReason('inappropriate_content', 'Continut inadecvat'),
  _ReportReason('spam', 'Spam / publicitate agresiva'),
  _ReportReason('other', 'Altul'),
];

const _businessReasons = [
  _ReportReason('closed_business', 'Business inchis / inexistent'),
  _ReportReason('inappropriate_content', 'Continut inadecvat'),
  _ReportReason('spam', 'Spam / publicitate agresiva'),
  _ReportReason('other', 'Altul'),
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

  List<_ReportReason> get _reasons =>
      widget.targetType == 'offer' ? _offerReasons : _businessReasons;

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selectedReason == null) return;
    if (_selectedReason == 'other' && _detailsController.text.trim().length < 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Te rugam sa descrii problema (minim 5 caractere).')),
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
        String msg = 'Eroare la trimiterea raportului.';
        if (e is dynamic && e.response?.statusCode == 409) {
          msg = 'Ai raportat deja aceasta resursa.';
        } else if (e is dynamic && e.response?.statusCode == 429) {
          msg = 'Ai atins limita de rapoarte pentru astazi.';
        }
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
            'Raporteaza ${widget.targetType == "offer" ? "oferta" : "business-ul"}',
            style: AppTypography.headlineSmall,
          ),
          const SizedBox(height: 4),
          Text(
            'Selecteaza motivul raportarii:',
            style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 16),
          ..._reasons.map((r) => RadioListTile<String>(
            value: r.key,
            groupValue: _selectedReason,
            onChanged: (v) => setState(() => _selectedReason = v),
            title: Text(r.label, style: AppTypography.bodyMedium),
            activeColor: AppColors.accent,
            contentPadding: EdgeInsets.zero,
            visualDensity: VisualDensity.compact,
          )),
          if (_selectedReason == 'other') ...[
            const SizedBox(height: 8),
            TextField(
              controller: _detailsController,
              maxLength: 500,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Descrie problema...',
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
                  : const Text('Trimite raportul'),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
