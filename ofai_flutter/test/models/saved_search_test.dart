import 'package:flutter_test/flutter_test.dart';
import 'package:ofai_flutter/models/saved_search.dart';

void main() {
  group('SavedSearch', () {
    test('fromJson parses correctly with all fields', () {
      final json = {
        'id': 42,
        'label': 'Restaurante Cluj',
        'query': 'pizza',
        'city_id': 1,
        'category_id': 3,
        'city_name': 'Cluj-Napoca',
        'category_name': 'Restaurant',
        'created_at': '2026-01-15T10:30:00.000Z',
      };

      final saved = SavedSearch.fromJson(json);

      expect(saved.id, 42);
      expect(saved.label, 'Restaurante Cluj');
      expect(saved.query, 'pizza');
      expect(saved.cityId, 1);
      expect(saved.categoryId, 3);
      expect(saved.cityName, 'Cluj-Napoca');
      expect(saved.categoryName, 'Restaurant');
      expect(saved.createdAt, DateTime.parse('2026-01-15T10:30:00.000Z'));
    });

    test('fromJson with null created_at does not crash', () {
      final json = {
        'id': 1,
        'created_at': null,
      };

      final before = DateTime.now();
      final saved = SavedSearch.fromJson(json);
      final after = DateTime.now();

      expect(saved.id, 1);
      expect(saved.createdAt.isAfter(before) || saved.createdAt.isAtSameMomentAs(before), isTrue);
      expect(saved.createdAt.isBefore(after) || saved.createdAt.isAtSameMomentAs(after), isTrue);
    });

    test('fromJson with minimal fields (only id + created_at)', () {
      final json = {
        'id': 7,
        'created_at': '2026-03-01T00:00:00.000Z',
      };

      final saved = SavedSearch.fromJson(json);

      expect(saved.id, 7);
      expect(saved.label, isNull);
      expect(saved.query, isNull);
      expect(saved.cityId, isNull);
      expect(saved.categoryId, isNull);
      expect(saved.cityName, isNull);
      expect(saved.categoryName, isNull);
      expect(saved.createdAt, DateTime.parse('2026-03-01T00:00:00.000Z'));
    });

    group('displayLabel', () {
      test('returns label when label is set', () {
        final saved = SavedSearch(
          id: 1,
          label: 'Oferte Spa',
          createdAt: DateTime.now(),
        );
        expect(saved.displayLabel, 'Oferte Spa');
      });

      test('returns quoted query when label is null but query is set', () {
        final saved = SavedSearch(
          id: 1,
          query: 'pizza',
          createdAt: DateTime.now(),
        );
        expect(saved.displayLabel, '"pizza"');
      });

      test('returns city · category when label and query are null', () {
        final saved = SavedSearch(
          id: 1,
          cityName: 'Cluj-Napoca',
          categoryName: 'Restaurant',
          createdAt: DateTime.now(),
        );
        expect(saved.displayLabel, 'Cluj-Napoca · Restaurant');
      });

      test('returns fallback string when everything is null', () {
        final saved = SavedSearch(
          id: 1,
          createdAt: DateTime.now(),
        );
        expect(saved.displayLabel, 'Cautare salvata');
      });
    });
  });
}
