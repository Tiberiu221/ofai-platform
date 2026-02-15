import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ofai_flutter/models/offer.dart';
import 'package:ofai_flutter/providers/auth_provider.dart';
import 'package:ofai_flutter/providers/favorites_provider.dart';
import 'package:ofai_flutter/providers/location_provider.dart';
import 'package:ofai_flutter/core/network/api_client.dart';
import 'package:ofai_flutter/widgets/offer_card.dart';

/// Helper to wrap widget with necessary providers and router
Widget _buildTestApp(Widget child) {
  return ProviderScope(
    overrides: [
      // Override auth — use real notifier but it starts as initial/unauthenticated
      authProvider.overrideWith(
        (ref) => AuthNotifier(ApiClient()),
      ),
      // Override favorites — use real notifier with empty state
      favoritesProvider.overrideWith(
        (ref) => FavoritesNotifier(ApiClient()),
      ),
      // Override location as null (no GPS in tests)
      userLocationProvider.overrideWith(
        (ref) => Future.value(null),
      ),
    ],
    child: MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(child: child),
      ),
    ),
  );
}

void main() {
  group('OfferCard vertical', () {
    testWidgets('renders offer title', (tester) async {
      final offer = Offer(id: 1, title: 'Super Deal');

      await tester.pumpWidget(_buildTestApp(OfferCard(offer: offer)));
      await tester.pump();

      expect(find.text('Super Deal'), findsOneWidget);
    });

    testWidgets('renders business name when available', (tester) async {
      final offer = Offer(
        id: 1,
        title: 'Deal',
        business: OfferBusiness(id: 1, name: 'Café Central'),
      );

      await tester.pumpWidget(_buildTestApp(OfferCard(offer: offer)));
      await tester.pump();

      expect(find.text('Café Central'), findsOneWidget);
    });

    testWidgets('renders description when available', (tester) async {
      final offer = Offer(
        id: 1,
        title: 'Deal',
        description: 'Get 50% off your first order',
      );

      await tester.pumpWidget(_buildTestApp(OfferCard(offer: offer)));
      await tester.pump();

      expect(find.text('Get 50% off your first order'), findsOneWidget);
    });

    testWidgets('does not render description when null', (tester) async {
      final offer = Offer(id: 1, title: 'Deal');

      await tester.pumpWidget(_buildTestApp(OfferCard(offer: offer)));
      await tester.pump();

      expect(find.text('Deal'), findsOneWidget);
    });

    testWidgets('renders discount badge when discount exists', (tester) async {
      final offer = Offer(
        id: 1,
        title: 'Deal',
        discountType: 'percentage',
        discountValue: 30,
      );

      await tester.pumpWidget(_buildTestApp(OfferCard(offer: offer)));
      await tester.pump();

      expect(find.text('-30%'), findsOneWidget);
    });

    testWidgets('renders rating stars when business has rating', (tester) async {
      final offer = Offer(
        id: 1,
        title: 'Deal',
        business: OfferBusiness(id: 1, name: 'Biz', rating: 4.5, ratingCount: 10),
      );

      await tester.pumpWidget(_buildTestApp(OfferCard(offer: offer)));
      await tester.pump();

      expect(find.text('4.5'), findsOneWidget);
      expect(find.byIcon(Icons.star), findsAtLeastNWidgets(1));
    });

    testWidgets('does not show rating when business has no rating', (tester) async {
      final offer = Offer(
        id: 1,
        title: 'Deal',
        business: OfferBusiness(id: 1, name: 'Biz'),
      );

      await tester.pumpWidget(_buildTestApp(OfferCard(offer: offer)));
      await tester.pump();

      expect(find.byIcon(Icons.star), findsNothing);
    });

    testWidgets('shows placeholder when no image URL', (tester) async {
      final offer = Offer(id: 1, title: 'No Image');

      await tester.pumpWidget(_buildTestApp(OfferCard(offer: offer)));
      await tester.pump();

      expect(find.byIcon(Icons.local_offer_outlined), findsOneWidget);
    });
  });

  group('OfferCard horizontal', () {
    testWidgets('renders in horizontal mode', (tester) async {
      final offer = Offer(
        id: 1,
        title: 'Horizontal Deal',
        business: OfferBusiness(id: 1, name: 'Shop'),
      );

      await tester.pumpWidget(
        _buildTestApp(OfferCard(offer: offer, horizontal: true)),
      );
      await tester.pump();

      expect(find.text('Horizontal Deal'), findsOneWidget);
      expect(find.text('Shop'), findsOneWidget);
    });
  });
}
