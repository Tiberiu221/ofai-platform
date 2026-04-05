import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';
import 'package:ofai_flutter/models/business.dart';
import 'package:ofai_flutter/widgets/business_card.dart';

/// Helper to wrap widget in a MaterialApp + ProviderScope for testing
Widget _buildTestApp(Widget child) {
  return ProviderScope(
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('ro'),
      home: Scaffold(
        body: SingleChildScrollView(child: child),
      ),
    ),
  );
}

void main() {
  group('BusinessCard', () {
    testWidgets('renders business name', (tester) async {
      final business = Business(id: 1, name: 'Test Business');

      await tester.pumpWidget(_buildTestApp(BusinessCard(business: business)));
      await tester.pump();

      expect(find.text('Test Business'), findsOneWidget);
    });

    testWidgets('renders category and city', (tester) async {
      final business = Business(
        id: 1,
        name: 'Test Biz',
        city: IdName(id: 1, name: 'Cluj'),
        category: IdName(id: 2, name: 'Restaurant'),
      );

      await tester.pumpWidget(_buildTestApp(BusinessCard(business: business)));
      await tester.pump();

      expect(find.textContaining('Restaurant'), findsOneWidget);
      expect(find.textContaining('Cluj'), findsOneWidget);
    });

    testWidgets('renders rating when available', (tester) async {
      final business = Business(
        id: 1,
        name: 'Rated Biz',
        rating: 4.8,
        ratingCount: 50,
      );

      await tester.pumpWidget(_buildTestApp(BusinessCard(business: business)));
      await tester.pump();

      expect(find.text('4.8'), findsOneWidget);
      expect(find.byIcon(Icons.star), findsOneWidget);
    });

    testWidgets('does not render rating when null', (tester) async {
      final business = Business(id: 1, name: 'No Rating Biz');

      await tester.pumpWidget(_buildTestApp(BusinessCard(business: business)));
      await tester.pump();

      expect(find.byIcon(Icons.star), findsNothing);
    });

    testWidgets('renders offers count when available', (tester) async {
      final business = Business(
        id: 1,
        name: 'Active Biz',
        activeOffersCount: 5,
      );

      await tester.pumpWidget(_buildTestApp(BusinessCard(business: business)));
      await tester.pump();

      expect(find.text('5 oferte'), findsOneWidget);
    });

    testWidgets('shows initial when no logo', (tester) async {
      final business = Business(id: 1, name: 'Test Biz');

      await tester.pumpWidget(_buildTestApp(BusinessCard(business: business)));
      await tester.pump();

      expect(find.text('T'), findsOneWidget); // First letter of "Test Biz"
    });

    testWidgets('renders chevron icon', (tester) async {
      final business = Business(id: 1, name: 'Biz');

      await tester.pumpWidget(_buildTestApp(BusinessCard(business: business)));
      await tester.pump();

      expect(find.byIcon(Icons.chevron_right), findsOneWidget);
    });

    testWidgets('handles empty category and city gracefully', (tester) async {
      final business = Business(id: 1, name: 'Minimal Biz');

      await tester.pumpWidget(_buildTestApp(BusinessCard(business: business)));
      await tester.pump();

      // Should still render without crash
      expect(find.text('Minimal Biz'), findsOneWidget);
    });
  });
}
