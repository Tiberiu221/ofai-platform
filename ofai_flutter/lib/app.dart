import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/page_transitions.dart';
import 'core/storage/preferences.dart';
import 'providers/auth_provider.dart';
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

// Shell for bottom navigation
class _ShellScreen extends StatelessWidget {
  final Widget child;
  final int currentIndex;

  const _ShellScreen({required this.child, required this.currentIndex});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(
            top: BorderSide(color: AppColors.border, width: 1),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: currentIndex,
          onTap: (index) {
            switch (index) {
              case 0:
                context.go('/');
                break;
              case 1:
                context.go('/explore');
                break;
              case 2:
                context.go('/collection');
                break;
              case 3:
                context.go('/account');
                break;
            }
          },
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home),
              label: 'Acasă',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.explore_outlined),
              activeIcon: Icon(Icons.explore),
              label: 'Explorează',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.bookmark_outline),
              activeIcon: Icon(Icons.bookmark),
              label: 'Colecția mea',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              activeIcon: Icon(Icons.person),
              label: 'Cont',
            ),
          ],
        ),
      ),
    );
  }
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

// Router
final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);
  final onboardingDone = ref.watch(onboardingDoneProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isAuth = auth.status == AuthStatus.authenticated;
      final isAuthRoute = state.uri.path == '/login' ||
          state.uri.path == '/register' ||
          state.uri.path == '/forgot-password' ||
          state.uri.path == '/verify-code' ||
          state.uri.path == '/reset-password';

      // Show onboarding if not done yet
      final isOnboardingRoute = state.uri.path == '/onboarding';
      final isDone = onboardingDone.valueOrNull ?? true; // default true while loading
      if (!isDone && !isOnboardingRoute) return '/onboarding';

      // If on auth routes and already authenticated, go home
      if (isAuth && isAuthRoute) return '/';

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
