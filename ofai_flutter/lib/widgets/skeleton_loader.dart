import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_spacing.dart';

class SkeletonLoader extends StatelessWidget {
  final int count;
  final SkeletonType type;

  const SkeletonLoader({
    super.key,
    this.count = 3,
    this.type = SkeletonType.offerCard,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.bgSecondary,
      highlightColor: AppColors.bgCard,
      child: ListView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: count,
        itemBuilder: (_, i) {
          switch (type) {
            case SkeletonType.offerCard:
              return _offerSkeleton();
            case SkeletonType.businessCard:
              return _businessSkeleton();
            case SkeletonType.horizontalCard:
              return _horizontalSkeleton();
          }
        },
      ),
    );
  }

  Widget _offerSkeleton() {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Container(
        height: 240,
        decoration: BoxDecoration(
          color: AppColors.bgSecondary,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        ),
      ),
    );
  }

  Widget _businessSkeleton() {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Container(
        height: 80,
        decoration: BoxDecoration(
          color: AppColors.bgSecondary,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        ),
      ),
    );
  }

  Widget _horizontalSkeleton() {
    return Container(
      width: 260,
      height: 200,
      margin: const EdgeInsets.only(right: AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.bgSecondary,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
      ),
    );
  }
}

class SkeletonHorizontalList extends StatelessWidget {
  final int count;

  const SkeletonHorizontalList({super.key, this.count = 3});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 200,
      child: Shimmer.fromColors(
        baseColor: AppColors.bgSecondary,
        highlightColor: AppColors.bgCard,
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
          itemCount: count,
          itemBuilder: (_, __) => Container(
            width: 260,
            margin: const EdgeInsets.only(right: AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.bgSecondary,
              borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
            ),
          ),
        ),
      ),
    );
  }
}

enum SkeletonType { offerCard, businessCard, horizontalCard }
