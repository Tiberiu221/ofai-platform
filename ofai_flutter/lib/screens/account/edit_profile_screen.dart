import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';
import 'package:dio/dio.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../providers/auth_provider.dart';
import '../../models/user.dart';
import '../../core/network/api_exceptions.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _firstNameCtrl;
  late TextEditingController _lastNameCtrl;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).user;
    _firstNameCtrl = TextEditingController(text: user?.firstName ?? '');
    _lastNameCtrl = TextEditingController(text: user?.lastName ?? '');
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);

    try {
      await ApiClient().dio.put(ApiEndpoints.userMe, data: {
        'first_name': _firstNameCtrl.text.trim(),
        'last_name': _lastNameCtrl.text.trim(),
      });
      await ref.read(authProvider.notifier).refreshUser();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context)!.profileUpdated),
            backgroundColor: AppColors.bgSecondary,
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        String errorMessage = AppLocalizations.of(context)!.saveError;
        if (e is DioException && e.response?.statusCode == 429) {
          final data = e.response?.data;
          if (data is Map) {
            errorMessage = data['message'] as String? ?? errorMessage;
          }
        } else {
          errorMessage = friendlyError(e);
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalizations.of(context)!.editProfileTitle),
        backgroundColor: AppColors.bgPrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.pagePadding),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: AppSpacing.lg),
              Text(AppLocalizations.of(context)!.firstName, style: AppTypography.labelMedium),
              const SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _firstNameCtrl,
                decoration: InputDecoration(hintText: AppLocalizations.of(context)!.firstNameHint),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? AppLocalizations.of(context)!.firstNameRequired : null,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: AppSpacing.xxl),
              Text(AppLocalizations.of(context)!.lastName, style: AppTypography.labelMedium),
              const SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _lastNameCtrl,
                decoration: InputDecoration(hintText: AppLocalizations.of(context)!.lastNameHint),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? AppLocalizations.of(context)!.lastNameRequired : null,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.done,
              ),
              const SizedBox(height: AppSpacing.xxl),

              // Email (read-only)
              Text(AppLocalizations.of(context)!.email, style: AppTypography.labelMedium),
              const SizedBox(height: AppSpacing.sm),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.bgSecondary,
                  borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                ),
                child: Text(
                  ref.watch(authProvider).user?.email ?? '',
                  style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                ),
              ),

              const SizedBox(height: AppSpacing.md),
              Text(
                AppLocalizations.of(context)!.nameChangeLimit,
                style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
              ),

              const SizedBox(height: AppSpacing.xxl),

              // Show picture in reviews toggle
              Row(
                children: [
                  const Icon(Icons.face_outlined, color: AppColors.textSecondary, size: 20),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Text(AppLocalizations.of(context)!.showPictureInReviews, style: AppTypography.bodyMedium),
                  ),
                  Switch(
                    value: ref.watch(authProvider).user?.showPictureInReviews ?? true,
                    activeColor: AppColors.accent,
                    onChanged: (val) async {
                      try {
                        await ref.read(authProvider.notifier).updateShowPictureInReviews(val);
                      } catch (_) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(AppLocalizations.of(context)!.saveError), backgroundColor: AppColors.danger),
                        );
                      }
                    },
                  ),
                ],
              ),

              // Badges section
              if (ref.watch(authProvider).user?.badges case final userBadges? when userBadges.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xxl),
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                    child: Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                            child: Row(
                              children: [
                                Text(AppLocalizations.of(context)!.badgesEarned, style: AppTypography.labelLarge),
                                const Spacer(),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppColors.accent,
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    '${userBadges.length}',
                                    style: AppTypography.labelSmall.copyWith(
                                      color: AppColors.bgPrimary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 2, 16, 4),
                            child: Text(AppLocalizations.of(context)!.selectForReviews, style: AppTypography.captionMuted),
                          ),
                          SizedBox(
                            height: 110,
                            child: ShaderMask(
                              shaderCallback: (Rect bounds) {
                                return LinearGradient(
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                  colors: [
                                    Colors.transparent,
                                    Colors.white,
                                    Colors.white,
                                    Colors.transparent,
                                  ],
                                  stops: const [0.0, 0.05, 0.95, 1.0],
                                ).createShader(bounds);
                              },
                              blendMode: BlendMode.dstIn,
                              child: ListView(
                                scrollDirection: Axis.horizontal,
                                physics: const BouncingScrollPhysics(),
                                padding: const EdgeInsets.fromLTRB(12, 14, 12, 0),
                                children: [
                                  _BadgeChip(
                                    badge: null,
                                    isSelected: ref.watch(authProvider).user?.displayBadgeId == null,
                                    onTap: () => _updateDisplayBadge(ref, null),
                                  ),
                                  ...userBadges.map((badge) => _BadgeChip(
                                    badge: badge,
                                    isSelected: ref.watch(authProvider).user?.displayBadgeId == badge.id,
                                    onTap: () => _updateDisplayBadge(ref, badge.id),
                                  )),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 4),
                        ],
                      ),
                    ),
                  ),
                ),
              ],

              const SizedBox(height: AppSpacing.xxl),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.bgPrimary,
                          ),
                        )
                      : Text(AppLocalizations.of(context)!.save),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _updateDisplayBadge(WidgetRef ref, int? badgeId) async {
    try {
      await ref.read(authProvider.notifier).updateDisplayBadge(badgeId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(badgeId != null ? AppLocalizations.of(context)!.badgeSelected : AppLocalizations.of(context)!.badgeDeselected)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Eroare: ${friendlyError(e)}')),
      );
    }
  }
}

Color _parseBadgeColor(String hex) {
  var h = hex.replaceFirst('#', '');
  if (h.length == 6) h = 'FF$h';
  return Color(int.parse(h, radix: 16));
}

class _BadgeChip extends StatelessWidget {
  final UserBadge? badge;
  final bool isSelected;
  final VoidCallback? onTap;
  const _BadgeChip({this.badge, this.isSelected = false, this.onTap});

  @override
  Widget build(BuildContext context) {
    final isNone = badge == null;
    final color = isNone ? AppColors.textTertiary : _parseBadgeColor(badge!.color);
    final label = isNone ? 'Fără insignă' : badge!.name;

    return GestureDetector(
      onTap: onTap,
      child: Tooltip(
        message: badge?.description ?? label,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: SizedBox(
            width: 80,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedScale(
                  scale: isSelected ? 1.08 : 1.0,
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOut,
                  child: SizedBox(
                    width: 58,
                    height: 58,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          curve: Curves.easeOut,
                          width: 54,
                          height: 54,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isNone
                                ? AppColors.bgSecondary
                                : color.withValues(alpha: 0.12),
                            border: Border.all(
                              color: isSelected
                                  ? color
                                  : color.withValues(alpha: 0.30),
                              width: isSelected ? 2.5 : 1,
                            ),
                            boxShadow: isSelected && !isNone
                                ? [BoxShadow(color: color.withValues(alpha: 0.40), blurRadius: 14)]
                                : [],
                          ),
                          child: Center(
                            child: Icon(
                              isNone ? Icons.close_rounded : Icons.star_rounded,
                              size: isNone ? 20 : 24,
                              color: isNone
                                  ? AppColors.textTertiary
                                  : (isSelected ? color : color.withValues(alpha: 0.7)),
                            ),
                          ),
                        ),
                        if (isSelected && !isNone)
                          Positioned(
                            right: 0,
                            bottom: 0,
                            child: Container(
                              width: 18,
                              height: 18,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: color,
                                border: Border.all(color: AppColors.bgPrimary, width: 2),
                              ),
                              child: const Icon(Icons.check, size: 10, color: Colors.white),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: AppTypography.caption.copyWith(
                    fontSize: 10,
                    height: 1.2,
                    color: isSelected ? color : AppColors.textTertiary,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
