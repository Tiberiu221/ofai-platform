import 'package:flutter_test/flutter_test.dart';
import 'package:ofai_flutter/models/collection.dart';

void main() {
  group('OfferCollection', () {
    test('fromJson parses correctly with full data including nested offers', () {
      final json = {
        'id': 5,
        'title': 'Top Restaurante',
        'description': 'Cele mai bune restaurante din oras',
        'image_url': 'https://example.com/collection.jpg',
        'offer_count': 3,
        'offers': [
          {
            'id': 101,
            'title': 'Oferta 1',
            'business': {'id': 1, 'name': 'Biz A'},
          },
          {
            'id': 102,
            'title': 'Oferta 2',
            'business': {'id': 2, 'name': 'Biz B'},
          },
          {
            'id': 103,
            'title': 'Oferta 3',
            'business': {'id': 3, 'name': 'Biz C'},
          },
        ],
      };

      final collection = OfferCollection.fromJson(json);

      expect(collection.id, 5);
      expect(collection.title, 'Top Restaurante');
      expect(collection.description, 'Cele mai bune restaurante din oras');
      expect(collection.imageUrl, 'https://example.com/collection.jpg');
      expect(collection.offerCount, 3);
      expect(collection.offers, isNotNull);
      expect(collection.offers!.length, 3);
      expect(collection.offers!.first.id, 101);
      expect(collection.offers!.first.title, 'Oferta 1');
    });

    test('fromJson with empty offers list', () {
      final json = {
        'id': 6,
        'title': 'Colectie Goala',
        'offer_count': 0,
        'offers': <dynamic>[],
      };

      final collection = OfferCollection.fromJson(json);

      expect(collection.id, 6);
      expect(collection.title, 'Colectie Goala');
      expect(collection.offerCount, 0);
      expect(collection.offers, isNotNull);
      expect(collection.offers!.isEmpty, isTrue);
    });

    test('fromJson with null offers yields null offers field', () {
      final json = {
        'id': 7,
        'title': 'Fara Oferte',
        'offer_count': 2,
      };

      final collection = OfferCollection.fromJson(json);

      expect(collection.id, 7);
      expect(collection.offers, isNull);
    });

    test('offerCount parses integer value correctly', () {
      final json = {
        'id': 8,
        'title': 'Test',
        'offer_count': 12,
      };

      final collection = OfferCollection.fromJson(json);

      expect(collection.offerCount, 12);
    });

    test('offerCount parses string value via int.tryParse', () {
      final json = {
        'id': 9,
        'title': 'Test',
        'offer_count': '7',
      };

      final collection = OfferCollection.fromJson(json);

      expect(collection.offerCount, 7);
    });

    test('offerCount defaults to 0 when null', () {
      final json = {
        'id': 10,
        'title': 'Test',
      };

      final collection = OfferCollection.fromJson(json);

      expect(collection.offerCount, 0);
    });

    test('fromJson handles null description and imageUrl', () {
      final json = {
        'id': 11,
        'title': 'Minimal',
      };

      final collection = OfferCollection.fromJson(json);

      expect(collection.description, isNull);
      expect(collection.imageUrl, isNull);
    });
  });
}
