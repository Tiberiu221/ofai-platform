import 'package:flutter_test/flutter_test.dart';
import 'package:ofai_flutter/models/offer.dart';

void main() {
  group('Offer', () {
    test('fromJson parses correctly with all fields', () {
      final json = {
        'id': 1,
        'title': 'Test Offer',
        'description': 'A great deal',
        'discount_type': 'percentage',
        'discount_value': 25,
        'start_date': '2026-01-01',
        'end_date': '2026-12-31',
        'image_url': 'https://example.com/img.jpg',
        'conditions': 'Must present coupon',
        'is_active': true,
        'business': {
          'id': 10,
          'name': 'Test Business',
          'logo_url': 'https://example.com/logo.jpg',
          'city': 'Cluj-Napoca',
          'category': 'Restaurant',
          'rating': 4.5,
          'rating_count': 120,
        },
        'locations': [
          {'id': 1, 'address': 'Str. Exemple 10', 'lat': 46.77, 'lng': 23.59, 'city_name': 'Cluj'},
        ],
      };

      final offer = Offer.fromJson(json);

      expect(offer.id, 1);
      expect(offer.title, 'Test Offer');
      expect(offer.description, 'A great deal');
      expect(offer.discountType, 'percentage');
      expect(offer.discountValue, 25);
      expect(offer.isActive, true);
      expect(offer.business, isNotNull);
      expect(offer.business!.name, 'Test Business');
      expect(offer.business!.rating, 4.5);
      expect(offer.business!.ratingCount, 120);
      expect(offer.locations, isNotNull);
      expect(offer.locations!.length, 1);
      expect(offer.locations!.first.address, 'Str. Exemple 10');
    });

    test('fromJson handles minimal fields', () {
      final json = {
        'id': 2,
        'title': 'Minimal Offer',
      };

      final offer = Offer.fromJson(json);

      expect(offer.id, 2);
      expect(offer.title, 'Minimal Offer');
      expect(offer.description, isNull);
      expect(offer.business, isNull);
      expect(offer.locations, isNull);
      expect(offer.isActive, true); // default
    });

    test('discountLabel returns correct format for percentage', () {
      final offer = Offer(id: 1, title: 'Test', discountType: 'percentage', discountValue: 30);
      expect(offer.discountLabel, '-30%');
    });

    test('discountLabel returns correct format for fixed', () {
      final offer = Offer(id: 1, title: 'Test', discountType: 'fixed', discountValue: 50);
      expect(offer.discountLabel, '-50 RON');
    });

    test('discountLabel returns empty when null', () {
      final offer = Offer(id: 1, title: 'Test');
      expect(offer.discountLabel, '');
    });

    test('displayImage prefers offer image over business logo', () {
      final offer = Offer(
        id: 1,
        title: 'Test',
        imageUrl: 'https://offer.jpg',
        business: OfferBusiness(id: 1, name: 'B', logoUrl: 'https://logo.jpg'),
      );
      expect(offer.displayImage, 'https://offer.jpg');
    });

    test('displayImage falls back to business logo', () {
      final offer = Offer(
        id: 1,
        title: 'Test',
        business: OfferBusiness(id: 1, name: 'B', logoUrl: 'https://logo.jpg'),
      );
      expect(offer.displayImage, 'https://logo.jpg');
    });

    test('displayImage returns null when no images available', () {
      final offer = Offer(id: 1, title: 'Test');
      expect(offer.displayImage, isNull);
    });
  });

  group('OfferBusiness', () {
    test('fromJson handles city as string', () {
      final json = {'id': 1, 'name': 'Biz', 'city': 'Cluj'};
      final biz = OfferBusiness.fromJson(json);
      expect(biz.city, 'Cluj');
    });

    test('fromJson handles city as map', () {
      final json = {'id': 1, 'name': 'Biz', 'city': {'id': 1, 'name': 'Cluj'}};
      final biz = OfferBusiness.fromJson(json);
      expect(biz.city, 'Cluj');
    });

    test('fromJson handles null city', () {
      final json = {'id': 1, 'name': 'Biz'};
      final biz = OfferBusiness.fromJson(json);
      expect(biz.city, isNull);
    });
  });

  group('Booking', () {
    test('hasBooking returns true when type is set', () {
      final booking = Booking(type: 'phone', phone: '0712345678');
      expect(booking.hasBooking, true);
    });

    test('hasBooking returns false for none', () {
      final booking = Booking(type: 'none');
      expect(booking.hasBooking, false);
    });

    test('hasBooking returns false for null', () {
      final booking = Booking();
      expect(booking.hasBooking, false);
    });
  });
}
