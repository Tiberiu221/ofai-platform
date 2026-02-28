import 'package:flutter_test/flutter_test.dart';
import 'package:ofai_flutter/core/utils/formatters.dart';

void main() {
  group('Formatters.discountLabel', () {
    test('formats percentage', () {
      expect(Formatters.discount(25), '-25%');
      expect(Formatters.discount(50), '-50%');
    });

    test('returns empty for null', () {
      expect(Formatters.discount(null), '');
    });
  });

  group('Formatters.price', () {
    test('formats price with RON', () {
      expect(Formatters.price(99.9), '99.90 RON');
    });

    test('returns empty for null', () {
      expect(Formatters.price(null), '');
    });
  });

  group('Formatters.compactNumber', () {
    test('returns number for < 1000', () {
      expect(Formatters.compactNumber(530), '530');
    });

    test('returns k format for >= 1000', () {
      expect(Formatters.compactNumber(1148), '1.1k');
      expect(Formatters.compactNumber(10000), '10.0k');
    });

    test('returns 0 for null', () {
      expect(Formatters.compactNumber(null), '0');
    });
  });

  group('Formatters.timeLeft', () {
    test('returns null for null input', () {
      expect(Formatters.timeLeft(null), isNull);
    });

    test('returns null for invalid date', () {
      expect(Formatters.timeLeft('not-a-date'), isNull);
    });

    test('returns Expirata for past dates', () {
      final pastDate = DateTime.now().subtract(const Duration(days: 1)).toIso8601String();
      expect(Formatters.timeLeft(pastDate), 'Expirata');
    });

    test('returns Ultima zi! for today', () {
      final today = DateTime.now().add(const Duration(hours: 5)).toIso8601String();
      expect(Formatters.timeLeft(today), 'Ultima zi!');
    });

    test('returns X zile ramase for 2-7 days', () {
      // Use 4 days to avoid edge case where 3 days rounds to 2 due to time-of-day
      final fourDays = DateTime.now().add(const Duration(days: 4)).toIso8601String();
      final result = Formatters.timeLeft(fourDays);
      expect(result, isNotNull);
      expect(result, contains('zile ramase'));
    });

    test('returns text for > 7 days', () {
      final farAway = DateTime.now().add(const Duration(days: 20)).toIso8601String();
      final result = Formatters.timeLeft(farAway);
      expect(result, isNotNull);
      expect(result, contains('zile ramase'));
    });

    test('returns weeks format for > 30 days', () {
      final veryFar = DateTime.now().add(const Duration(days: 45)).toIso8601String();
      final result = Formatters.timeLeft(veryFar);
      expect(result, isNotNull);
      expect(result, contains('sapt. ramase'));
    });
  });

  group('Formatters.urgencyLevel', () {
    test('returns 0 for null', () {
      expect(Formatters.urgencyLevel(null), 0);
    });

    test('returns 3 (critical) for expired', () {
      final past = DateTime.now().subtract(const Duration(days: 1)).toIso8601String();
      expect(Formatters.urgencyLevel(past), 3);
    });

    test('returns 3 (critical) for < 24 hours', () {
      final soon = DateTime.now().add(const Duration(hours: 12)).toIso8601String();
      expect(Formatters.urgencyLevel(soon), 3);
    });

    test('returns 2 (high) for < 3 days', () {
      final soon = DateTime.now().add(const Duration(hours: 36)).toIso8601String();
      expect(Formatters.urgencyLevel(soon), 2);
    });

    test('returns 1 for 2-7 days', () {
      final fewDays = DateTime.now().add(const Duration(days: 5)).toIso8601String();
      expect(Formatters.urgencyLevel(fewDays), 1);
    });

    test('returns 0 for > 7 days', () {
      final farAway = DateTime.now().add(const Duration(days: 30)).toIso8601String();
      expect(Formatters.urgencyLevel(farAway), 0);
    });
  });

  group('Formatters.timeAgo', () {
    test('returns empty for null', () {
      expect(Formatters.timeAgo(null), '');
    });

    test('returns "acum" for just now', () {
      expect(Formatters.timeAgo(DateTime.now()), 'acum');
    });

    test('returns minutes ago', () {
      final fiveMinAgo = DateTime.now().subtract(const Duration(minutes: 5));
      expect(Formatters.timeAgo(fiveMinAgo), 'acum 5 min');
    });

    test('returns hours ago', () {
      final twoHoursAgo = DateTime.now().subtract(const Duration(hours: 2));
      expect(Formatters.timeAgo(twoHoursAgo), 'acum 2 ore');
    });

    test('returns days ago', () {
      final threeDaysAgo = DateTime.now().subtract(const Duration(days: 3));
      expect(Formatters.timeAgo(threeDaysAgo), 'acum 3 zile');
    });
  });
}
