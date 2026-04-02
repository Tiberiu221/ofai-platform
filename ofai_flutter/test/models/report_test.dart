import 'package:flutter_test/flutter_test.dart';
import 'package:ofai_flutter/models/report.dart';

void main() {
  group('UserReport', () {
    test('fromJson parses correctly with all fields', () {
      final json = {
        'id': 15,
        'target_type': 'offer',
        'target_id': 42,
        'reason': 'spam',
        'details': 'This offer is fake',
        'status': 'pending',
        'created_at': '2026-02-20T08:00:00.000Z',
      };

      final report = UserReport.fromJson(json);

      expect(report.id, 15);
      expect(report.targetType, 'offer');
      expect(report.targetId, 42);
      expect(report.reason, 'spam');
      expect(report.details, 'This offer is fake');
      expect(report.status, 'pending');
      expect(report.createdAt, DateTime.parse('2026-02-20T08:00:00.000Z'));
    });

    test('fromJson with null details', () {
      final json = {
        'id': 16,
        'target_type': 'business',
        'target_id': 7,
        'reason': 'inappropriate',
        'status': 'reviewed',
        'created_at': '2026-03-01T00:00:00.000Z',
      };

      final report = UserReport.fromJson(json);

      expect(report.details, isNull);
    });

    test('fromJson defaults status to pending when null', () {
      final json = {
        'id': 17,
        'target_type': 'offer',
        'target_id': 1,
        'reason': 'other',
        'created_at': '2026-03-10T00:00:00.000Z',
      };

      final report = UserReport.fromJson(json);

      expect(report.status, 'pending');
    });

    test('fromJson with null created_at does not crash', () {
      final json = {
        'id': 18,
        'target_type': 'offer',
        'target_id': 1,
        'reason': 'other',
        'status': 'pending',
        'created_at': null,
      };

      final before = DateTime.now();
      final report = UserReport.fromJson(json);
      final after = DateTime.now();

      expect(report.createdAt.isAfter(before) || report.createdAt.isAtSameMomentAs(before), isTrue);
      expect(report.createdAt.isBefore(after) || report.createdAt.isAtSameMomentAs(after), isTrue);
    });

    group('isPending', () {
      test('returns true when status is pending', () {
        final report = UserReport(
          id: 1,
          targetType: 'offer',
          targetId: 1,
          reason: 'spam',
          status: 'pending',
          createdAt: DateTime.now(),
        );
        expect(report.isPending, isTrue);
      });

      test('returns false when status is reviewed', () {
        final report = UserReport(
          id: 1,
          targetType: 'offer',
          targetId: 1,
          reason: 'spam',
          status: 'reviewed',
          createdAt: DateTime.now(),
        );
        expect(report.isPending, isFalse);
      });

      test('returns false when status is resolved', () {
        final report = UserReport(
          id: 1,
          targetType: 'business',
          targetId: 5,
          reason: 'inappropriate',
          status: 'resolved',
          createdAt: DateTime.now(),
        );
        expect(report.isPending, isFalse);
      });
    });

    group('status field values', () {
      test('accepts pending status', () {
        final json = {
          'id': 1,
          'target_type': 'offer',
          'target_id': 1,
          'reason': 'spam',
          'status': 'pending',
          'created_at': '2026-01-01T00:00:00.000Z',
        };
        final report = UserReport.fromJson(json);
        expect(report.status, 'pending');
      });

      test('accepts reviewed status', () {
        final json = {
          'id': 2,
          'target_type': 'offer',
          'target_id': 2,
          'reason': 'spam',
          'status': 'reviewed',
          'created_at': '2026-01-01T00:00:00.000Z',
        };
        final report = UserReport.fromJson(json);
        expect(report.status, 'reviewed');
      });

      test('accepts resolved status', () {
        final json = {
          'id': 3,
          'target_type': 'business',
          'target_id': 3,
          'reason': 'inappropriate',
          'status': 'resolved',
          'created_at': '2026-01-01T00:00:00.000Z',
        };
        final report = UserReport.fromJson(json);
        expect(report.status, 'resolved');
      });
    });
  });
}
