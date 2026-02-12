class City {
  final int id;
  final String name;
  final int? count;

  City({
    required this.id,
    required this.name,
    this.count,
  });

  factory City.fromJson(Map<String, dynamic> json) {
    return City(
      id: json['id'] as int,
      name: json['name'] as String,
      count: json['count'] as int?,
    );
  }
}
