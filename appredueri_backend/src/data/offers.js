const offers = [
  {
    id: 1,
    business_id: 1,
    title: "Reducere 20% consult stomatologic",
    description: "Reducere la primul consult pentru pacienti noi.",
    discount_type: "percent",
    discount_value: 20,
    conditions: "Valabila de luni pana vineri intre 9:00 - 17:00.",
    start_date: "2025-01-01",
    end_date: "2025-03-31",
    is_active: true
  },
  {
    id: 2,
    business_id: 2,
    title: "Tuns + aranjat barba la 70 lei",
    description: "Pachet promo pentru clienti noi.",
    discount_type: "fixed",
    discount_value: 70,
    conditions: "Doar cu programare in prealabil.",
    start_date: "2025-02-01",
    end_date: "2025-04-01",
    is_active: true
  },
  {
    id: 3,
    business_id: 3,
    title: "Manichiura semipermanenta 30% reducere",
    description: "Oferta speciala pentru programarile in timpul saptamanii.",
    discount_type: "percent",
    discount_value: 30,
    conditions: "Valabila doar luni - joi.",
    start_date: "2025-01-15",
    end_date: "2025-03-15",
    is_active: true
  }
];

module.exports = offers;
