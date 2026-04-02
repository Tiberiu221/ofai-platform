import 'package:flutter_test/flutter_test.dart';
import 'package:ofai_flutter/models/user.dart';

void main() {
  group('User', () {
    test('fromJson parses correctly with full user data', () {
      final json = {
        'id': 99,
        'email': 'test@example.com',
        'first_name': 'Ion',
        'last_name': 'Popescu',
        'role': 'user',
        'points': 150,
        'created_at': '2025-06-01T00:00:00.000Z',
        'profile_picture_url': 'https://example.com/avatar.jpg',
        'has_password': true,
        'show_picture_in_reviews': false,
        'display_badge_id': 3,
        'preferred_city_ids': [1, 2, 3],
        'preferred_category_ids': [10, 20],
        'badges': [
          {
            'id': 1,
            'slug': 'early-adopter',
            'name': 'Early Adopter',
            'description': 'Joined early',
            'icon': 'rocket',
            'color': '#fb923c',
            'category': 'general',
            'earned_at': '2025-06-01T00:00:00.000Z',
          },
        ],
      };

      final user = User.fromJson(json);

      expect(user.id, 99);
      expect(user.email, 'test@example.com');
      expect(user.firstName, 'Ion');
      expect(user.lastName, 'Popescu');
      expect(user.role, 'user');
      expect(user.points, 150);
      expect(user.createdAt, '2025-06-01T00:00:00.000Z');
      expect(user.profilePictureUrl, 'https://example.com/avatar.jpg');
      expect(user.hasPassword, true);
      expect(user.showPictureInReviews, false);
      expect(user.displayBadgeId, 3);
    });

    group('preferredCityIds and preferredCategoryIds', () {
      test('parses lists correctly', () {
        final json = {
          'id': 1,
          'email': 'a@b.com',
          'role': 'user',
          'preferred_city_ids': [1, 2, 3],
          'preferred_category_ids': [10, 20],
        };

        final user = User.fromJson(json);

        expect(user.preferredCityIds, [1, 2, 3]);
        expect(user.preferredCategoryIds, [10, 20]);
      });

      test('returns null when fields are absent', () {
        final json = {
          'id': 1,
          'email': 'a@b.com',
          'role': 'user',
        };

        final user = User.fromJson(json);

        expect(user.preferredCityIds, isNull);
        expect(user.preferredCategoryIds, isNull);
      });
    });

    group('displayName', () {
      test('returns first + last name when both are present', () {
        final user = User(id: 1, email: 'x@y.com', role: 'user', firstName: 'Ana', lastName: 'Ionescu');
        expect(user.displayName, 'Ana Ionescu');
      });

      test('returns only first name when lastName is null', () {
        final user = User(id: 1, email: 'x@y.com', role: 'user', firstName: 'Ana');
        expect(user.displayName, 'Ana');
      });

      test('falls back to email local part when no names set', () {
        final user = User(id: 1, email: 'ana.ionescu@example.com', role: 'user');
        expect(user.displayName, 'ana.ionescu');
      });
    });

    group('initials', () {
      test('returns uppercase first letters of first and last name', () {
        final user = User(id: 1, email: 'x@y.com', role: 'user', firstName: 'Ana', lastName: 'Ionescu');
        expect(user.initials, 'AI');
      });

      test('returns single uppercase letter when only firstName exists', () {
        final user = User(id: 1, email: 'x@y.com', role: 'user', firstName: 'Maria');
        expect(user.initials, 'M');
      });

      test('returns uppercase first letter of email when no name', () {
        final user = User(id: 1, email: 'test@example.com', role: 'user');
        expect(user.initials, 'T');
      });
    });

    group('isBusinessOwner', () {
      test('returns true for business_owner role', () {
        final user = User(id: 1, email: 'a@b.com', role: 'business_owner');
        expect(user.isBusinessOwner, isTrue);
      });

      test('returns true for admin role', () {
        final user = User(id: 1, email: 'a@b.com', role: 'admin');
        expect(user.isBusinessOwner, isTrue);
      });

      test('returns false for regular user role', () {
        final user = User(id: 1, email: 'a@b.com', role: 'user');
        expect(user.isBusinessOwner, isFalse);
      });
    });

    group('isAdmin', () {
      test('returns true for admin role', () {
        final user = User(id: 1, email: 'a@b.com', role: 'admin');
        expect(user.isAdmin, isTrue);
      });

      test('returns false for business_owner role', () {
        final user = User(id: 1, email: 'a@b.com', role: 'business_owner');
        expect(user.isAdmin, isFalse);
      });

      test('returns false for user role', () {
        final user = User(id: 1, email: 'a@b.com', role: 'user');
        expect(user.isAdmin, isFalse);
      });
    });

    group('badges', () {
      test('parses list of UserBadge objects', () {
        final json = {
          'id': 1,
          'email': 'a@b.com',
          'role': 'user',
          'badges': [
            {
              'id': 10,
              'slug': 'early-adopter',
              'name': 'Early Adopter',
              'description': 'Joined early',
              'icon': 'rocket',
              'color': '#fb923c',
              'category': 'general',
              'earned_at': '2025-06-01T00:00:00.000Z',
            },
            {
              'id': 11,
              'slug': 'power-user',
              'name': 'Power User',
              'icon': 'star',
              'color': '#a855f7',
              'category': 'engagement',
            },
          ],
        };

        final user = User.fromJson(json);

        expect(user.badges, isNotNull);
        expect(user.badges!.length, 2);
        expect(user.badges!.first.slug, 'early-adopter');
        expect(user.badges!.first.name, 'Early Adopter');
        expect(user.badges!.last.slug, 'power-user');
      });

      test('returns null badges when field absent', () {
        final json = {
          'id': 1,
          'email': 'a@b.com',
          'role': 'user',
        };

        final user = User.fromJson(json);

        expect(user.badges, isNull);
      });
    });
  });

  group('UserBadge', () {
    test('fromJson parses all fields', () {
      final json = {
        'id': 5,
        'slug': 'explorer',
        'name': 'Explorator',
        'description': 'A explorat multe oferte',
        'icon': 'map',
        'color': '#22d3ee',
        'category': 'discovery',
        'earned_at': '2026-01-10T12:00:00.000Z',
      };

      final badge = UserBadge.fromJson(json);

      expect(badge.id, 5);
      expect(badge.slug, 'explorer');
      expect(badge.name, 'Explorator');
      expect(badge.description, 'A explorat multe oferte');
      expect(badge.icon, 'map');
      expect(badge.color, '#22d3ee');
      expect(badge.category, 'discovery');
      expect(badge.earnedAt, '2026-01-10T12:00:00.000Z');
    });

    test('fromJson uses defaults for missing optional fields', () {
      final json = {
        'slug': 'newcomer',
        'name': 'Nou Venit',
      };

      final badge = UserBadge.fromJson(json);

      expect(badge.slug, 'newcomer');
      expect(badge.name, 'Nou Venit');
      expect(badge.id, isNull);
      expect(badge.icon, 'star');
      expect(badge.color, '#fb923c');
      expect(badge.category, 'general');
      expect(badge.earnedAt, isNull);
    });
  });
}
