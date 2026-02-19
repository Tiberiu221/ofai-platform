import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_typography.dart';
import 'core/theme/app_spacing.dart';
import 'core/theme/page_transitions.dart';
import 'core/storage/preferences.dart';
import 'providers/auth_provider.dart';
import 'services/push_notification_service.dart';
import 'screens/home/home_screen.dart';
import 'screens/explore/explore_screen.dart';
import 'screens/collection/collection_screen.dart';
import 'screens/account/account_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/auth/forgot_password_screen.dart';
import 'screens/auth/verify_code_screen.dart';
import 'screens/auth/reset_password_screen.dart';
import 'screens/offer/offer_detail_screen.dart';
import 'screens/business/business_detail_screen.dart';
import 'screens/account/edit_profile_screen.dart';
import 'screens/account/preferences_screen.dart';
import 'screens/account/change_password_screen.dart';
import 'screens/account/data_export_screen.dart';
import 'screens/account/delete_account_screen.dart';
import 'screens/onboarding/onboarding_screen.dart';
import 'screens/categories/categories_screen.dart';
import 'screens/cities/cities_screen.dart';
import 'screens/business_request/business_request_screen.dart';
import 'screens/legal/terms_screen.dart';
import 'screens/legal/privacy_screen.dart';
import 'screens/help/help_screen.dart';

// Shell for bottom navigation with glassmorphic effect
class _ShellScreen extends StatelessWidget {
  final Widget child;
  final int currentIndex;

  const _ShellScreen({required this.child, required this.currentIndex});

  static const _items = [
    _NavItem(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Acasa'),
    _NavItem(icon: Icons.explore_outlined, activeIcon: Icons.explore, label: 'Exploreaza'),
    _NavItem(icon: Icons.bookmark_outline, activeIcon: Icons.bookmark, label: 'Colectia mea'),
    _NavItem(icon: Icons.person_outline, activeIcon: Icons.person, label: 'Cont'),
  ];

  static const _routes = ['/', '/explore', '/collection', '/account'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: child,
      bottomNavigationBar: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            height: AppSpacing.bottomNavHeight + MediaQuery.of(context).padding.bottom,
            decoration: const BoxDecoration(
              color: AppColors.bgGlass,
              border: Border(
                top: BorderSide(color: AppColors.borderLight, width: 0.5),
              ),
            ),
            padding: EdgeInsets.only(bottom: MediaQuery.of(context).padding.bottom),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(_items.length, (i) {
                final item = _items[i];
                final isActive = i == currentIndex;
                return Expanded(
                  child: Semantics(
                    label: item.label,
                    selected: isActive,
                    button: true,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => context.go(_routes[i]),
                      child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          isActive ? item.activeIcon : item.icon,
                          size: 24,
                          color: isActive ? AppColors.accent : AppColors.textTertiary,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          item.label,
                          style: AppTypography.labelSmall.copyWith(
                            color: isActive ? AppColors.accent : AppColors.textTertiary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        // Active indicator dot
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          width: isActive ? 4 : 0,
                          height: 4,
                          decoration: BoxDecoration(
                            color: AppColors.accent,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ),
                  ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _NavItem({required this.icon, required this.activeIcon, required this.label});
}

// Tab index helper
int _tabIndex(GoRouterState state) {
  final path = state.uri.path;
  if (path.startsWith('/explore')) return 1;
  if (path.startsWith('/collection')) return 2;
  if (path.startsWith('/account')) return 3;
  return 0;
}

// Onboarding state — loaded once at app startup
final onboardingDoneProvider = FutureProvider<bool>((ref) async {
  return AppPreferences.isOnboardingDone();
});

// Notifier that triggers GoRouter redirect re-evaluation on auth/onboarding changes
class RouterNotifier extends ChangeNotifier {
  final Ref _ref;

  RouterNotifier(this._ref) {
    _ref.listen(authProvider, (prev, next) => notifyListeners());
    _ref.listen(onboardingDoneProvider, (prev, next) => notifyListeners());
  }

  AuthStatus get authStatus => _ref.read(authProvider).status;
  bool get isOnboardingDone => _ref.read(onboardingDoneProvider).valueOrNull ?? true;
}

final _routerNotifierProvider = Provider<RouterNotifier>((ref) => RouterNotifier(ref));

// Router — stable instance, refreshed via RouterNotifier
final routerProvider = Provider<GoRouter>((ref) {
  final notifier = ref.watch(_routerNotifierProvider);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: notifier,
    redirect: (context, state) {
      final isAuth = notifier.authStatus == AuthStatus.authenticated;
      final isAuthRoute = state.uri.path == '/login' ||
          state.uri.path == '/register' ||
          state.uri.path == '/forgot-password' ||
          state.uri.path == '/verify-code' ||
          state.uri.path == '/reset-password';

      // Show onboarding if not done yet
      final isOnboardingRoute = state.uri.path == '/onboarding';
      if (!notifier.isOnboardingDone && !isOnboardingRoute) return '/onboarding';

      // If on auth routes and already authenticated, go home
      if (isAuth && isAuthRoute) return '/';

      // Handle push notification deep links
      if (isAuth && state.uri.path == '/') {
        final deepLink = PushNotificationService().consumePendingDeepLink();
        if (deepLink != null) return deepLink;
      }

      return null;
    },
    routes: [
      // Onboarding
      GoRoute(
        path: '/onboarding',
        pageBuilder: (context, state) => fadeTransition(
          state: state,
          child: const OnboardingScreen(),
        ),
      ),

      // Shell route with bottom nav
      ShellRoute(
        builder: (context, state, child) {
          return _ShellScreen(
            child: child,
            currentIndex: _tabIndex(state),
          );
        },
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const HomeScreen(),
          ),
          GoRoute(
            path: '/explore',
            builder: (context, state) => const ExploreScreen(),
          ),
          GoRoute(
            path: '/collection',
            builder: (context, state) => const CollectionScreen(),
          ),
          GoRoute(
            path: '/account',
            builder: (context, state) => const AccountScreen(),
          ),
        ],
      ),

      // Detail routes (slide up transition)
      GoRoute(
        path: '/offer/:id',
        pageBuilder: (context, state) {
          final id = int.parse(state.pathParameters['id']!);
          return slideUpTransition(
            state: state,
            child: OfferDetailScreen(offerId: id),
          );
        },
      ),
      GoRoute(
        path: '/business/:id',
        pageBuilder: (context, state) {
          final id = int.parse(state.pathParameters['id']!);
          return slideUpTransition(
            state: state,
            child: BusinessDetailScreen(businessId: id),
          );
        },
      ),

      // Auth routes (fade transition)
      GoRoute(
        path: '/login',
        pageBuilder: (context, state) => fadeTransition(
          state: state,
          child: const LoginScreen(),
        ),
      ),
      GoRoute(
        path: '/register',
        pageBuilder: (context, state) => fadeTransition(
          state: state,
          child: const RegisterScreen(),
        ),
      ),

      // Forgot/Reset password routes
      GoRoute(
        path: '/forgot-password',
        pageBuilder: (context, state) => fadeTransition(
          state: state,
          child: const ForgotPasswordScreen(),
        ),
      ),
      GoRoute(
        path: '/verify-code',
        pageBuilder: (context, state) {
          final email = state.uri.queryParameters['email'] ?? '';
          return fadeTransition(
            state: state,
            child: VerifyCodeScreen(email: email),
          );
        },
      ),
      GoRoute(
        path: '/reset-password',
        pageBuilder: (context, state) {
          final email = state.uri.queryParameters['email'] ?? '';
          final code = state.uri.queryParameters['code'] ?? '';
          return fadeTransition(
            state: state,
            child: ResetPasswordScreen(email: email, code: code),
          );
        },
      ),

      // Account sub-routes (no bottom nav)
      GoRoute(
        path: '/account/edit-profile',
        builder: (context, state) => const EditProfileScreen(),
      ),
      GoRoute(
        path: '/account/preferences',
        builder: (context, state) => const PreferencesScreen(),
      ),
      GoRoute(
        path: '/account/change-password',
        builder: (context, state) => const ChangePasswordScreen(),
      ),
      GoRoute(
        path: '/account/data-export',
        builder: (context, state) => const DataExportScreen(),
      ),
      GoRoute(
        path: '/account/delete-account',
        builder: (context, state) => const DeleteAccountScreen(),
      ),

      // Browse routes
      GoRoute(
        path: '/categories',
        builder: (context, state) => const CategoriesScreen(),
      ),
      GoRoute(
        path: '/cities',
        builder: (context, state) => const CitiesScreen(),
      ),
      GoRoute(
        path: '/business-request',
        builder: (context, state) => const BusinessRequestScreen(),
      ),

      // Legal & Help routes
      GoRoute(
        path: '/terms',
        builder: (context, state) => const TermsScreen(),
      ),
      GoRoute(
        path: '/privacy',
        builder: (context, state) => const PrivacyScreen(),
      ),
      GoRoute(
        path: '/help',
        builder: (context, state) => const HelpScreen(),
      ),
    ],
  );
});

class OFAIApp extends ConsumerWidget {
  const OFAIApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'OFAI',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      routerConfig: router,
    );
  }
}
