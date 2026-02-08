/**
 * Seed script: Generează 1000 business-uri fictive cu oferte
 *
 * Rulare: node scripts/seed-businesses.js
 *
 * Ce face:
 * 1. Adaugă categorii și orașe noi (dacă nu există)
 * 2. Generează 1000 business-uri cu date românești realiste
 * 3. Generează 2-4 oferte per business
 * 4. Folosește placeholder images (ui-avatars + picsum.photos)
 */

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 5,
  statement_timeout: 30000,
});

// ─── CATEGORII ───────────────────────────────────────────────
const CATEGORIES = [
  "Clinica",
  "Frizerie",
  "Beauty",
  "Auto",
  "Restaurant",
  "Cafenea",
  "Fitness",
  "Spa & Wellness",
  "Optica",
  "Farmacie",
  "Veterinar",
  "Stomatologie",
  "Florarie",
  "Curatatorie",
  "Foto & Video",
];

// ─── ORAȘE CU COORDONATE ────────────────────────────────────
const CITIES = [
  { name: "Bucuresti",     lat: 44.4268, lng: 26.1025, radius: 0.06 },
  { name: "Cluj-Napoca",   lat: 46.7712, lng: 23.6236, radius: 0.04 },
  { name: "Timisoara",     lat: 45.7489, lng: 21.2087, radius: 0.04 },
  { name: "Iasi",          lat: 47.1585, lng: 27.6014, radius: 0.04 },
  { name: "Constanta",     lat: 44.1598, lng: 28.6348, radius: 0.04 },
  { name: "Craiova",       lat: 44.3302, lng: 23.7949, radius: 0.03 },
  { name: "Brasov",        lat: 45.6427, lng: 25.5887, radius: 0.03 },
  { name: "Galati",        lat: 45.4353, lng: 28.0080, radius: 0.03 },
  { name: "Oradea",        lat: 47.0465, lng: 21.9189, radius: 0.03 },
  { name: "Sibiu",         lat: 45.7983, lng: 24.1256, radius: 0.03 },
  { name: "Ploiesti",      lat: 44.9462, lng: 26.0234, radius: 0.03 },
  { name: "Arad",          lat: 46.1866, lng: 21.3123, radius: 0.03 },
  { name: "Pitesti",       lat: 44.8565, lng: 24.8692, radius: 0.02 },
  { name: "Baia Mare",     lat: 47.6567, lng: 23.5850, radius: 0.02 },
  { name: "Targu Mures",   lat: 46.5455, lng: 24.5625, radius: 0.02 },
];

// ─── STRAZI ROMÂNEȘTI ───────────────────────────────────────
const STREETS = [
  "Str. Republicii", "Str. Mihai Eminescu", "Str. Avram Iancu",
  "Str. Nicolae Balcescu", "Str. Victoriei", "Str. Stefan cel Mare",
  "Str. Traian", "Str. Decebal", "Str. 1 Decembrie", "Str. Unirii",
  "Str. Libertatii", "Str. Progresului", "Str. Cuza Voda", "Str. Horea",
  "Str. Closca", "Str. Crisan", "Str. Tudor Vladimirescu", "Str. Mircea cel Batran",
  "Str. Alexandru Ioan Cuza", "Str. Gheorghe Doja",
  "Str. Vasile Alecsandri", "Str. Ion Creanga", "Str. Mihail Kogalniceanu",
  "Str. Lucian Blaga", "Str. George Enescu", "Str. Nicolae Iorga",
  "Str. Petru Rares", "Str. Mihai Viteazu", "Str. Carpati",
  "Str. Florilor", "Str. Primaverii", "Str. Rozelor", "Str. Lalelelor",
  "Str. Soarelui", "Str. Lunii", "Str. Pacii", "Str. Muncii",
  "Str. Industriei", "Str. Fabricii", "Str. Teilor",
  "Bvd. Ferdinand", "Bvd. Republicii", "Bvd. Eroilor", "Bvd. Independentei",
  "Bvd. Tomis", "Bvd. Brancoveanu", "Calea Victoriei", "Calea Mosilor",
  "Calea Dorobanti", "Calea Grivitei",
];

// ─── NUME BUSINESS PER CATEGORIE ───────────────────────────
const BUSINESS_NAMES = {
  "Clinica": [
    "MedLife", "Sanador", "MedCenter", "HealthPlus", "VitaCare",
    "ProMedic", "MedPro", "SanaVita", "CareClinic", "MedExpert",
    "UrgentMed", "PrimaMed", "NovaMed", "EuroClinic", "FamilyMed",
  ],
  "Frizerie": [
    "BarberShop", "Gentleman", "The Barber", "OldSchool Barber", "ClipArt",
    "FreshCut", "StyleCut", "TopBarber", "ClassicCut", "SharpEdge",
    "BladeMaster", "UrbanBarber", "VintageBarber", "PrimeCut", "RoyalBarber",
  ],
  "Beauty": [
    "GlamBeauty", "BeautyZone", "LuxBeauty", "DivaStyle", "NailsArt",
    "BeautyLab", "GlowUp", "PrettyPlease", "ArtNails", "SilkSkin",
    "VelvetTouch", "RoseBeauty", "PearlNails", "ShineStar", "BellaVita",
  ],
  "Auto": [
    "AutoPro", "SpeedService", "TurboFix", "CarCare", "MasterAuto",
    "QuickFix Auto", "DriveService", "AutoExpert", "MotorPlus", "PitStop",
    "WheelDeal", "AutoMaster", "TopGear", "RevService", "ProMotor",
  ],
  "Restaurant": [
    "La Mama", "Casa Veche", "Trattoria", "Gusto", "Bon Appetit",
    "La Bucatarie", "Chef's Table", "Taverna", "Piata Gusturilor", "Savoare",
    "Delicios", "Casa Boiereasca", "Rustic", "Aroma", "Gastronomie",
  ],
  "Cafenea": [
    "Coffee Lab", "Brew & Co", "Espresso Bar", "Cafea de Specialitate", "Bean There",
    "Morning Cup", "ArtCafe", "UrbanCafe", "Ceainaria", "Latteland",
    "MochaMix", "Cappuccino Corner", "Roast Republic", "Daily Grind", "Java House",
  ],
  "Fitness": [
    "PowerGym", "FitZone", "CrossFit Arena", "Body Shape", "IronClub",
    "FlexGym", "StrongLife", "MuscleFactory", "FitPro", "ActiveLife",
    "Olympus Gym", "TitanFit", "EnergyClub", "AthleteZone", "MaxFit",
  ],
  "Spa & Wellness": [
    "Zen Spa", "RelaxZone", "OasisSpa", "AquaVita", "Serenity",
    "HarmonyWell", "PureBliss", "TranquilSpa", "VitaSpa", "NaturaSpa",
    "GoldenSpa", "EdenWellness", "Lotus Spa", "CloudNine", "PeacefulMind",
  ],
  "Optica": [
    "VisionPlus", "OchelariExpress", "ClearView", "OpticaPro", "EyeCare",
    "LensCenter", "OptiBest", "SmartOptic", "FocusOptic", "SeeWell",
    "BrightEyes", "OpticExpert", "ViewMaster", "FrameArt", "OpticStyle",
  ],
  "Farmacie": [
    "FarmVita", "SanFarm", "HealthPharm", "GreenPharm", "PlantaFarm",
    "FarmaPlus", "NaturaPharm", "BioFarm", "VitaPharm", "MedFarm",
    "CuraFarm", "PrimFarm", "RoyalPharm", "FarmExpert", "DoroFarm",
  ],
  "Veterinar": [
    "VetCare", "PetClinic", "AnimalPlus", "VetExpert", "PawsClinic",
    "HappyPet", "VetPro", "AnimalCare", "PetHealth", "FurFriend",
    "VetZone", "PetLife", "WildCare", "VetMaster", "4Paws Clinic",
  ],
  "Stomatologie": [
    "DentPro", "SmileCare", "BrightSmile", "DentalExpert", "ToothFairy",
    "WhiteSmile", "DentCenter", "PerfectSmile", "OralCare", "DentVita",
    "SmileLab", "DentalArts", "ProDent", "SmileDesign", "ClearDent",
  ],
  "Florarie": [
    "FloraDesign", "PetalArt", "BouquetExpress", "RoseGarden", "BloomShop",
    "FloralMagic", "GardenOfEden", "PetalShop", "FloraVita", "WildFlowers",
    "FloristPro", "FlowerPower", "Buchetino", "PrimaveraFlori", "FloraLux",
  ],
  "Curatatorie": [
    "CleanPro", "SpotlessClean", "FreshWash", "QuickClean", "Curatatoria",
    "SparkleClean", "PureClean", "WashExpert", "CleanMaster", "DiamondClean",
    "ShinyClean", "ProWash", "CrystalClean", "GreenClean", "SwiftClean",
  ],
  "Foto & Video": [
    "SnapStudio", "FotoArt", "PixelPerfect", "CaptureStudio", "LensArt",
    "FlashFoto", "PhotoExpert", "FrameStudio", "VisionMedia", "ShutterPro",
    "CreativeShot", "PhotoVision", "StudioLight", "ImagePro", "LensStudio",
  ],
};

// ─── SUFIXE RANDOM PT UNICITATE ────────────────────────────
const SUFFIXES = [
  "", " Plus", " Premium", " Pro", " Center", " Studio",
  " Express", " VIP", " Select", " Elite",
];

// ─── OFERTE PER CATEGORIE ──────────────────────────────────
const OFFER_TEMPLATES = {
  "Clinica": [
    { title: "Consult medical gratuit", discount_type: "percent", discount_value: 100, conditions: "Doar prima vizita" },
    { title: "Analize de sange {V}% reducere", discount_type: "percent", discount_value: [15, 20, 25, 30], conditions: "Cu programare" },
    { title: "Ecografie abdominala la {V} lei", discount_type: "fixed", discount_value: [80, 100, 120], conditions: "Luni-Vineri 8-16" },
    { title: "Pachet preventie {V}% off", discount_type: "percent", discount_value: [20, 25, 30], conditions: "Include consult + analize" },
  ],
  "Frizerie": [
    { title: "Tuns + barba la {V} lei", discount_type: "fixed", discount_value: [50, 60, 70, 80], conditions: "Cu programare" },
    { title: "Tuns copii {V}% reducere", discount_type: "percent", discount_value: [20, 30, 40], conditions: "Sub 12 ani" },
    { title: "Pachet Groom {V} lei", discount_type: "fixed", discount_value: [100, 120, 150], conditions: "Tuns + barba + spalat" },
    { title: "Reducere studenti {V}%", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Cu carnet de student valid" },
  ],
  "Beauty": [
    { title: "Manichiura semipermanenta {V}% off", discount_type: "percent", discount_value: [20, 25, 30], conditions: "Toate culorile" },
    { title: "Epilare laser zona mica la {V} lei", discount_type: "fixed", discount_value: [80, 100, 120], conditions: "Prima sedinta" },
    { title: "Tratament facial {V}% reducere", discount_type: "percent", discount_value: [20, 30, 40], conditions: "Minim 60 min" },
    { title: "Gene individuale la {V} lei", discount_type: "fixed", discount_value: [100, 120, 150], conditions: "Include intretinere 2 sapt" },
  ],
  "Auto": [
    { title: "Schimb ulei + filtru la {V} lei", discount_type: "fixed", discount_value: [100, 120, 150], conditions: "Ulei inclus" },
    { title: "Spalatorie completa {V}% off", discount_type: "percent", discount_value: [20, 30, 40], conditions: "Interior + exterior" },
    { title: "Verificare tehnica gratuita", discount_type: "percent", discount_value: 100, conditions: "Cu programare" },
    { title: "Anvelope {V}% reducere", discount_type: "percent", discount_value: [10, 15, 20], conditions: "Montaj inclus" },
  ],
  "Restaurant": [
    { title: "Meniu pranz la {V} lei", discount_type: "fixed", discount_value: [25, 30, 35, 40], conditions: "Luni-Vineri 12-15" },
    { title: "{V}% la comanda online", discount_type: "percent", discount_value: [10, 15, 20], conditions: "Comanda minima 50 lei" },
    { title: "Desert gratuit la orice main course", discount_type: "percent", discount_value: 100, conditions: "Cu rezervare" },
    { title: "Brunch {V} lei/persoana", discount_type: "fixed", discount_value: [40, 50, 60], conditions: "Sambata-Duminica 10-14" },
  ],
  "Cafenea": [
    { title: "Cafea {V}% reducere dimineata", discount_type: "percent", discount_value: [15, 20, 25], conditions: "7:00 - 10:00" },
    { title: "Combo cafea + prajitura {V} lei", discount_type: "fixed", discount_value: [15, 18, 20], conditions: "Orice cafea + prajitura" },
    { title: "Al doilea frappe {V}% off", discount_type: "percent", discount_value: [30, 40, 50], conditions: "La aceeasi comanda" },
    { title: "Abonament cafea {V} lei/luna", discount_type: "fixed", discount_value: [80, 100, 120], conditions: "1 cafea/zi" },
  ],
  "Fitness": [
    { title: "Abonament lunar {V} lei", discount_type: "fixed", discount_value: [80, 100, 120, 150], conditions: "Acces nelimitat" },
    { title: "Prima luna {V}% off", discount_type: "percent", discount_value: [30, 40, 50], conditions: "Clienti noi" },
    { title: "Personal trainer {V} lei/sedinta", discount_type: "fixed", discount_value: [60, 80, 100], conditions: "Min 4 sedinte" },
    { title: "Abonament trimestrial {V}% reducere", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Plata integrala" },
  ],
  "Spa & Wellness": [
    { title: "Masaj relaxare {V}% off", discount_type: "percent", discount_value: [20, 25, 30], conditions: "60 minute" },
    { title: "Pachet spa complet {V} lei", discount_type: "fixed", discount_value: [150, 200, 250], conditions: "Sauna + masaj + jacuzzi" },
    { title: "Tratament anticelulitic {V}% reducere", discount_type: "percent", discount_value: [20, 30, 40], conditions: "Pachet 5 sedinte" },
    { title: "Zi de relaxare {V} lei", discount_type: "fixed", discount_value: [200, 250, 300], conditions: "Acces integral" },
  ],
  "Optica": [
    { title: "Consult oftalmologic la {V} lei", discount_type: "fixed", discount_value: [30, 50, 70], conditions: "Cu programare" },
    { title: "Rame + lentile {V}% off", discount_type: "percent", discount_value: [20, 30, 40], conditions: "Din gama selectata" },
    { title: "Lentile de contact {V}% reducere", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Cutie lunara" },
    { title: "Al doilea perete ochelari {V}% off", discount_type: "percent", discount_value: [40, 50, 60], conditions: "Aceeasi comanda" },
  ],
  "Farmacie": [
    { title: "Vitamine {V}% reducere", discount_type: "percent", discount_value: [10, 15, 20], conditions: "Gama selectata" },
    { title: "Produse dermato-cosmetice {V}% off", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Brand selectat" },
    { title: "Suplimente nutritive la {V} lei", discount_type: "fixed", discount_value: [30, 40, 50], conditions: "Pachete promo" },
    { title: "Testare tensiune gratuita", discount_type: "percent", discount_value: 100, conditions: "Disponibil zilnic" },
  ],
  "Veterinar": [
    { title: "Consult veterinar la {V} lei", discount_type: "fixed", discount_value: [30, 50, 60], conditions: "Cu programare" },
    { title: "Vaccinare {V}% off", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Caini si pisici" },
    { title: "Deparazitare la {V} lei", discount_type: "fixed", discount_value: [20, 30, 40], conditions: "Include tratament" },
    { title: "Sterilizare {V}% reducere", discount_type: "percent", discount_value: [10, 15, 20], conditions: "Cu programare" },
  ],
  "Stomatologie": [
    { title: "Detartraj + periaj {V} lei", discount_type: "fixed", discount_value: [80, 100, 120], conditions: "Sedinta completa" },
    { title: "Albire dentara {V}% off", discount_type: "percent", discount_value: [20, 25, 30], conditions: "Metoda profesionala" },
    { title: "Plomba estetica la {V} lei", discount_type: "fixed", discount_value: [100, 120, 150], conditions: "Compozit nano" },
    { title: "Consult + radiografie {V}% reducere", discount_type: "percent", discount_value: [30, 40, 50], conditions: "Prima vizita" },
  ],
  "Florarie": [
    { title: "Buchet mixt la {V} lei", discount_type: "fixed", discount_value: [40, 50, 60], conditions: "Flori de sezon" },
    { title: "Aranjament {V}% off", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Pentru evenimente" },
    { title: "Livrare gratuita peste {V} lei", discount_type: "fixed", discount_value: [100, 120, 150], conditions: "In oras" },
    { title: "Plante de interior {V}% reducere", discount_type: "percent", discount_value: [10, 15, 20], conditions: "Gama selectata" },
  ],
  "Curatatorie": [
    { title: "Curatare costum la {V} lei", discount_type: "fixed", discount_value: [25, 30, 35], conditions: "2 piese" },
    { title: "{V}% la curatare covoare", discount_type: "percent", discount_value: [20, 25, 30], conditions: "Min 2 mp" },
    { title: "Spalare haine {V}% off", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Min 3 kg" },
    { title: "Curatare canapea la {V} lei", discount_type: "fixed", discount_value: [80, 100, 120], conditions: "Cu deplasare" },
  ],
  "Foto & Video": [
    { title: "Sedinta foto portret {V} lei", discount_type: "fixed", discount_value: [100, 150, 200], conditions: "30 minute + 10 poze" },
    { title: "Fotografie eveniment {V}% off", discount_type: "percent", discount_value: [10, 15, 20], conditions: "Min 3 ore" },
    { title: "Video promo {V} lei", discount_type: "fixed", discount_value: [300, 400, 500], conditions: "1 minut, editat" },
    { title: "Poze buletin/pasaport {V} lei", discount_type: "fixed", discount_value: [15, 20, 25], conditions: "Gata in 10 min" },
  ],
};

// ─── CULORI PENTRU LOGO PLACEHOLDER ─────────────────────────
const LOGO_COLORS = [
  "E74C3C", "E67E22", "F1C40F", "2ECC71", "1ABC9C",
  "3498DB", "9B59B6", "34495E", "E84393", "00B894",
  "0984E3", "6C5CE7", "FD79A8", "FDCB6E", "55EFC4",
  "74B9FF", "A29BFE", "FF7675", "FAB1A0", "81ECEC",
];

const LOGO_BG_COLORS = [
  "2C3E50", "1A1A2E", "16213E", "0F3460", "1B1B2F",
  "252A34", "2D3436", "353535", "3C3C3C", "2F2F2F",
];

// ─── HELPERS ────────────────────────────────────────────────

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomCoord(center, radius) {
  return center + (Math.random() - 0.5) * 2 * radius;
}

function generatePhone() {
  const prefixes = ["072", "073", "074", "075", "076", "077", "078"];
  return randomFrom(prefixes) + String(randomInt(1000000, 9999999));
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Generează URL logo placeholder cu DiceBear
 * Folosește stilul "shapes" — geometric, modern, arată ca un logo real
 * Fiecare business primește un logo unic bazat pe seed (numele businessului)
 * https://www.dicebear.com/styles/shapes/
 */
function generateLogoUrl(businessName) {
  const seed = encodeURIComponent(businessName);
  // DiceBear shapes — logo-uri geometrice unice, colorate
  return `https://api.dicebear.com/9.x/shapes/png?seed=${seed}&size=400`;
}

/**
 * Generează URL cover placeholder
 * Folosește picsum.photos — imagini stock gratuite, stabile
 */
function generateCoverUrl(seed) {
  return `https://picsum.photos/seed/${seed}/1200/600`;
}

// ─── MAIN SEED FUNCTION ─────────────────────────────────────

async function seedBusinesses() {
  const client = await pool.connect();

  try {
    console.log("🚀 Starting seed process...\n");

    await client.query("BEGIN");

    // ── 1. Insert categorii noi ──────────────────────────
    console.log("📂 Inserting categories...");
    const categoryMap = {}; // name → id

    for (const catName of CATEGORIES) {
      // Check if exists first
      const existing = await client.query(
        "SELECT id FROM categories WHERE name = $1", [catName]
      );
      if (existing.rows.length > 0) {
        categoryMap[catName] = existing.rows[0].id;
      } else {
        const result = await client.query(
          "INSERT INTO categories (name) VALUES ($1) RETURNING id",
          [catName]
        );
        categoryMap[catName] = result.rows[0].id;
      }
    }
    console.log(`   ✅ ${Object.keys(categoryMap).length} categories ready`);

    // ── 2. Insert orașe noi ──────────────────────────────
    console.log("🏙️  Inserting cities...");
    const cityMap = {}; // name → { id, lat, lng, radius }

    for (const city of CITIES) {
      const existing = await client.query(
        "SELECT id FROM cities WHERE name = $1", [city.name]
      );
      let cityId;
      if (existing.rows.length > 0) {
        cityId = existing.rows[0].id;
      } else {
        const result = await client.query(
          "INSERT INTO cities (name) VALUES ($1) RETURNING id",
          [city.name]
        );
        cityId = result.rows[0].id;
      }
      cityMap[city.name] = {
        id: cityId,
        lat: city.lat,
        lng: city.lng,
        radius: city.radius,
      };
    }
    console.log(`   ✅ ${Object.keys(cityMap).length} cities ready\n`);

    // ── 3. Generate business-uri ─────────────────────────
    console.log("🏪 Generating 1000 businesses...");

    const usedNames = new Set();
    const businessIds = []; // { id, categoryName, cityName }
    let batchCount = 0;

    for (let i = 0; i < 1000; i++) {
      const categoryName = CATEGORIES[i % CATEGORIES.length];
      const cityObj = CITIES[i % CITIES.length];
      const cityData = cityMap[cityObj.name];

      // Generează nume unic
      let name;
      let attempts = 0;
      do {
        const baseName = randomFrom(BUSINESS_NAMES[categoryName]);
        const suffix = randomFrom(SUFFIXES);
        name = `${baseName}${suffix}`;
        // Adaugă oraș dacă tot nu e unic
        if (usedNames.has(name) && attempts > 5) {
          name = `${baseName} ${cityObj.name}${suffix}`;
        }
        attempts++;
      } while (usedNames.has(name) && attempts < 20);

      // Dacă tot nu e unic, adaugă un număr
      if (usedNames.has(name)) {
        name = `${name} ${i}`;
      }
      usedNames.add(name);

      const street = randomFrom(STREETS);
      const streetNr = randomInt(1, 150);
      const address = `${street} ${streetNr}, ${cityObj.name}`;
      const lat = randomCoord(cityData.lat, cityData.radius);
      const lng = randomCoord(cityData.lng, cityData.radius);
      const phone = generatePhone();
      const website = Math.random() > 0.3 ? `https://${slugify(name)}.ro` : null;
      const logoUrl = generateLogoUrl(name);
      const coverUrl = generateCoverUrl(`biz-${i}-${slugify(name)}`);

      // Booking random
      const bookingTypes = ["none", "phone", "whatsapp", "link"];
      const bookingType = randomFrom(bookingTypes);
      const bookingPhone = bookingType === "phone" ? phone : null;
      const bookingWhatsapp = bookingType === "whatsapp" ? phone : null;
      const bookingUrl = bookingType === "link" ? `https://${slugify(name)}.ro/programare` : null;

      const result = await client.query(
        `INSERT INTO businesses
         (name, address, phone, website, lat, lng, city_id, category_id,
          logo_url, cover_image_url, booking_type, booking_phone, booking_whatsapp, booking_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        [
          name, address, phone, website,
          parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)),
          cityData.id, categoryMap[categoryName],
          logoUrl, coverUrl,
          bookingType, bookingPhone, bookingWhatsapp, bookingUrl,
        ]
      );

      businessIds.push({
        id: result.rows[0].id,
        categoryName,
        cityName: cityObj.name,
        name,
      });

      batchCount++;
      if (batchCount % 100 === 0) {
        console.log(`   📊 ${batchCount}/1000 businesses inserted...`);
      }
    }
    console.log(`   ✅ ${businessIds.length} businesses inserted!\n`);

    // ── 4. Generate oferte per business ──────────────────
    console.log("🏷️  Generating offers...");
    let totalOffers = 0;

    for (const biz of businessIds) {
      const templates = OFFER_TEMPLATES[biz.categoryName] || OFFER_TEMPLATES["Restaurant"];
      const numOffers = randomInt(2, 4);

      // Alege oferte random fără duplicat
      const shuffled = [...templates].sort(() => Math.random() - 0.5);
      const selectedOffers = shuffled.slice(0, numOffers);

      for (const tpl of selectedOffers) {
        // Calculează valoarea discount-ului
        let discountValue;
        if (Array.isArray(tpl.discount_value)) {
          discountValue = randomFrom(tpl.discount_value);
        } else {
          discountValue = tpl.discount_value;
        }

        // Înlocuiește {V} în titlu cu valoarea reală
        const title = tpl.title.replace("{V}", discountValue);

        // Date random: start = ultimele 30 zile, end = +60 până la +180 zile
        const startOffset = randomInt(-30, 0);
        const endOffset = randomInt(60, 180);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + startOffset);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + endOffset);

        const isActive = Math.random() > 0.1; // 90% active

        await client.query(
          `INSERT INTO offers
           (business_id, title, description, discount_type, discount_value,
            conditions, start_date, end_date, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            biz.id,
            title,
            `Oferta speciala de la ${biz.name}. Profita acum de aceasta reducere exclusiva!`,
            tpl.discount_type,
            discountValue,
            tpl.conditions,
            startDate.toISOString().split("T")[0],
            endDate.toISOString().split("T")[0],
            isActive,
          ]
        );
        totalOffers++;
      }

      if (totalOffers % 500 === 0 && totalOffers > 0) {
        console.log(`   📊 ${totalOffers} offers inserted...`);
      }
    }
    console.log(`   ✅ ${totalOffers} offers inserted!\n`);

    // ── 5. Commit ────────────────────────────────────────
    await client.query("COMMIT");

    // ── 6. Summary ───────────────────────────────────────
    console.log("═══════════════════════════════════════════");
    console.log("✅ SEED COMPLETE!");
    console.log("═══════════════════════════════════════════");
    console.log(`   📂 Categories: ${CATEGORIES.length}`);
    console.log(`   🏙️  Cities:     ${CITIES.length}`);
    console.log(`   🏪 Businesses: ${businessIds.length}`);
    console.log(`   🏷️  Offers:     ${totalOffers}`);
    console.log("═══════════════════════════════════════════");

    // Print distribuția
    console.log("\n📊 Distribution by category:");
    const catCounts = {};
    for (const biz of businessIds) {
      catCounts[biz.categoryName] = (catCounts[biz.categoryName] || 0) + 1;
    }
    for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${cat}: ${count}`);
    }

    console.log("\n📊 Distribution by city:");
    const cityCounts = {};
    for (const biz of businessIds) {
      cityCounts[biz.cityName] = (cityCounts[biz.cityName] || 0) + 1;
    }
    for (const [city, count] of Object.entries(cityCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${city}: ${count}`);
    }

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// ── RUN ──────────────────────────────────────────────────────
seedBusinesses()
  .then(() => {
    console.log("\n🎉 Done! You can now start the server.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n💥 Fatal error:", err.message);
    process.exit(1);
  });
