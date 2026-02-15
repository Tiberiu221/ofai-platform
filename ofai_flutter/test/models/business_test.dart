import 'package:flutter_test/flutter_test.dart';
import 'package:ofai_flutter/models/business.dart';

void main() {
  group('Business', () {
    test('fromJson parses correctly with all fields', () {
      final json = {
        'id': 1,
        'name': 'Test Business',
        'address': 'Str. Test 1',
        'phone': '0712345678',
        'website': 'https://test.ro',
        'lat': 46.77,
        'lng': 23.59,
        'logo_url': 'https://example.com/logo.jpg',
        'cover_image': 'https://example.com/cover.jpg',
        'city': {'id': 1, 'name': 'Cluj-Napoca'},
        'category': {'id': 2, 'name': 'Restaurant'},
        'active_offers_count': 5,
        'rating': 4.2,
        'rating_count': 85,
      };

      final business = Business.fromJson(json);

      expect(business.id, 1);
      expect(business.name, 'Test Business');
      expect(business.address, 'Str. Test 1');
      expect(business.phone, '0712345678');
      expect(business.rating, 4.2);
      expect(business.ratingCount, 85);
      expect(business.activeOffersCount, 5);
      expect(business.city, isNotNull);
      expect(business.city!.name, 'Cluj-Napoca');
      expect(business.category, isNotNull);
      expect(business.category!.name, 'Restaurant');
    });

    test('fromJson handles minimal fields', () {
      final json = {
        'id': 2,
        'name': 'Minimal Biz',
      };

      final business = Business.fromJson(json);

      expect(business.id, 2);
      expect(business.name, 'Minimal Biz');
      expect(business.city, isNull);
      expect(business.category, isNull);
      expect(business.rating, isNull);
      expect(business.logoUrl, isNull);
    });

    test('cityName returns name or empty string', () {
      final withCity = Business(id: 1, name: 'B', city: IdName(id: 1, name: 'Cluj'));
      expect(withCity.cityName, 'Cluj');

      final noCity = Business(id: 2, name: 'B');
      expect(noCity.cityName, '');
    });

    test('categoryName returns name or empty string', () {
      final withCat = Business(id: 1, name: 'B', category: IdName(id: 1, name: 'Spa'));
      expect(withCat.categoryName, 'Spa');

      final noCat = Business(id: 2, name: 'B');
      expect(noCat.categoryName, '');
    });

    test('fromJson handles city as non-map (string) gracefully', () {
      final json = {
        'id': 1,
        'name': 'Biz',
        'city': 'not a map',
      };

      final business = Business.fromJson(json);
      expect(business.city, isNull); // city is not a Map, so it's null
    });
  });

  group('IdName', () {
    test('fromJson parses correctly', () {
      final json = {'id': 5, 'name': 'Test Category'};
      final idName = IdName.fromJson(json);
      expect(idName.id, 5);
      expect(idName.name, 'Test Category');
    });
  });

  group('ReviewSummary', () {
    test('fromJson with text field', () {
      final json = {'text': 'Great place!', 'review_count': 10};
      final review = ReviewSummary.fromJson(json);
      expect(review.text, 'Great place!');
      expect(review.reviewCount, 10);
    });

    test('fromJson with summary field fallback', () {
      final json = {'summary': 'Nice spot', 'review_count': 5};
      final review = ReviewSummary.fromJson(json);
      expect(review.text, 'Nice spot');
    });

    test('fromJson handles null text', () {
      final json = <String, dynamic>{};
      final review = ReviewSummary.fromJson(json);
      expect(review.text, '');
      expect(review.reviewCount, 0);
    });
  });
}
