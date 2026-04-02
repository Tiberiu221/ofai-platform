import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/reports_provider.dart';
import '../../models/report.dart';
import '../../widgets/empty_state.dart';
import 'package:intl/intl.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';

class MyReportsScreen extends ConsumerStatefulWidget {
  const MyReportsScreen({super.key});

  @override
  ConsumerState<MyReportsScreen> createState() => _MyReportsScreenState();
}

class _MyReportsScreenState extends ConsumerState<MyReportsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(reportsProvider.notifier).fetch());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(reportsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalizations.of(context)!.myReportsTitle),
        backgroundColor: AppColors.bgPrimary,
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
          : state.reports.isEmpty
              ? EmptyState(
                  icon: Icons.flag_outlined,
                  title: AppLocalizations.of(context)!.myReportsEmpty,
                  subtitle: AppLocalizations.of(context)!.myReportsEmptySubtitle,
                )
              : RefreshIndicator(
                  color: AppColors.accent,
                  backgroundColor: AppColors.bgCard,
                  onRefresh: () async {
                    await ref.read(reportsProvider.notifier).fetch();
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.pagePadding),
                    itemCount: state.reports.length,
                    separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
                    itemBuilder: (context, index) {
                      final report = state.reports[index];
                      return _ReportTile(
                        report: report,
                        onWithdraw: report.isPending
                            ? () => _withdrawReport(report.id)
                            : null,
                      );
                    },
                  ),
                ),
    );
  }

  Future<void> _withdrawReport(int id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        title: Text(AppLocalizations.of(context)!.reportWithdrawTitle),
        content: Text(AppLocalizations.of(context)!.reportWithdrawBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(AppLocalizations.of(context)!.cancelAction),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(AppLocalizations.of(context)!.reportWithdrawConfirm, style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final success = await ref.read(reportsProvider.notifier).withdraw(id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? AppLocalizations.of(context)!.reportWithdrawn : AppLocalizations.of(context)!.reportWithdrawError),
            backgroundColor: success ? AppColors.success : AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }
}

class _ReportTile extends StatelessWidget {
  final UserReport report;
  final VoidCallback? onWithdraw;

  const _ReportTile({required this.report, this.onWithdraw});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                report.targetType == 'offer' ? Icons.local_offer_outlined : Icons.store_outlined,
                size: 16,
                color: AppColors.textTertiary,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                report.targetType == 'offer' ? AppLocalizations.of(context)!.reportOfferTarget(report.targetId) : AppLocalizations.of(context)!.reportBusinessTarget(report.targetId),
                style: AppTypography.labelMedium.copyWith(color: AppColors.textSecondary),
              ),
              const Spacer(),
              _StatusChip(status: report.status),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(report.reason, style: AppTypography.bodyMedium),
          if (report.details != null && report.details!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              report.details!,
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Text(
                DateFormat('d MMM yyyy').format(report.createdAt),
                style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
              ),
              const Spacer(),
              if (onWithdraw != null)
                GestureDetector(
                  onTap: onWithdraw,
                  child: Text(
                    AppLocalizations.of(context)!.reportWithdrawConfirm,
                    style: AppTypography.labelSmall.copyWith(color: AppColors.danger),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final (label, color) = switch (status) {
      'pending' => (l10n.reportStatusPending, AppColors.warning),
      'reviewed' => (l10n.reportStatusReviewed, AppColors.info),
      'resolved' => (l10n.reportStatusResolved, AppColors.success),
      _ => (l10n.reportStatusUnknown, AppColors.textTertiary),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
      ),
      child: Text(
        label,
        style: AppTypography.captionMuted.copyWith(color: color, fontSize: 11),
      ),
    );
  }
}
