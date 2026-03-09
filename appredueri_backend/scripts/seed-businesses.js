/**
 * Seed script: 150 business-uri in Bucuresti (10 per categorie × 15 categorii)
 * Fiecare business: 1 locatie + free plan + program + catalog + 2 oferte active
 *
 * Rulare: cd appredueri_backend && node scripts/seed-businesses.js
 */

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 5,
  statement_timeout: 30000,
});

// ─── CATEGORII ───────────────────────────────────────────────
const CATEGORIES = [
  "Clinica",
  "Frizerie",
  "Beauty",
  "Auto",
  "Magazine Online",
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

// ─── BUCURESTI ───────────────────────────────────────────────
const CITY = {
  name: "Bucuresti/Ilfov",
  lat: 44.4268,
  lng: 26.1025,
  radius: 0.06,
};

// ─── STRAZI ──────────────────────────────────────────────────
const STREETS = [
  "Str. Republicii",
  "Str. Mihai Eminescu",
  "Str. Avram Iancu",
  "Str. Nicolae Balcescu",
  "Str. Victoriei",
  "Str. Stefan cel Mare",
  "Str. Traian",
  "Str. Decebal",
  "Str. 1 Decembrie",
  "Str. Unirii",
  "Str. Libertatii",
  "Str. Progresului",
  "Str. Cuza Voda",
  "Str. Horea",
  "Str. Closca",
  "Str. Crisan",
  "Str. Tudor Vladimirescu",
  "Str. Mircea cel Batran",
  "Str. Alexandru Ioan Cuza",
  "Str. Gheorghe Doja",
  "Bvd. Ferdinand",
  "Bvd. Republicii",
  "Bvd. Eroilor",
  "Bvd. Independentei",
  "Calea Victoriei",
  "Calea Mosilor",
  "Calea Dorobanti",
  "Calea Grivitei",
  "Str. Florilor",
  "Str. Primaverii",
];

// ─── UNSPLASH PHOTO IDS PER CATEGORIE ───────────────────────
// Format: https://images.unsplash.com/{ID}?w=WIDTH&h=HEIGHT&fit=crop
const UNSPLASH_PHOTOS = {
  Clinica: [
    "photo-1629909613654-28e377c37b09",
    "photo-1631507623121-eaaba8d4e7dc",
    "photo-1519494026892-80bbd2d6fd0d",
    "photo-1551076805-e1869033e561",
  ],
  Frizerie: [
    "photo-1503951914875-452162b0f3f1",
    "photo-1503951914875-452162b0f3f1",
    "photo-1536520002442-39764a41e987",
    "photo-1621605815971-fbc98d665033",
  ],
  Beauty: [
    "photo-1560066984-138dadb4c035",
    "photo-1616394584738-fc6e612e71b9",
    "photo-1633681926022-84c23e8cb2d6",
    "photo-1589710751893-f9a6770ad71b",
  ],
  Auto: [
    "photo-1486262715619-67b85e0b08d3",
    "photo-1625047509248-ec889cbff17f",
    "photo-1619642751034-765dfdf7c58e",
    "photo-1596986952526-3be237187071",
  ],
  "Magazine Online": [
    "photo-1556742049-0cfed4f6a45d",
    "photo-1563013544-824ae1b704d3",
    "photo-1664455340023-214c33a9d0bd",
    "photo-1483985988355-763728e1935b",
  ],
  Cafenea: [
    "photo-1501339847302-ac426a4a7cbb",
    "photo-1453614512568-c4024d13c247",
    "photo-1600093463592-8e36ae95ef56",
    "photo-1495474472287-4d71bcdd2085",
  ],
  Fitness: [
    "photo-1534438327276-14e5300c3a48",
    "photo-1526506118085-60ce8714f8c5",
    "photo-1517836357463-d25dfeac3438",
    "photo-1571902943202-507ec2618e8f",
  ],
  "Spa & Wellness": [
    "photo-1544161515-4ab6ce6db874",
    "photo-1696841212541-449ca29397cc",
    "photo-1600334089648-b0d9d3028eb2",
    "photo-1741522509438-a120c0bb5e88",
  ],
  Optica: [
    "photo-1516574187841-cb9cc2ca948b",
    "photo-1646083774155-2a40b675641d",
    "photo-1743183988213-d5e24edf3dc8",
    "photo-1772470461164-2b71e5d59db1",
  ],
  Farmacie: [
    "photo-1442512595331-e89e73853f31",
    "photo-1576602976047-174e57a47881",
    "photo-1642055514517-7b52288890ec",
    "photo-1631549916768-4119b2e5f926",
  ],
  Veterinar: [
    "photo-1530281700549-e82e7bf110d6",
    "photo-1654895716780-b4664497420d",
    "photo-1551076805-e1869033e561",
    "photo-1602052577122-f73b9710adba",
  ],
  Stomatologie: [
    "photo-1606811971618-4486d14f3f99",
    "photo-1598256989800-fe5f95da9787",
    "photo-1629909613654-28e377c37b09",
    "photo-1643660526741-094639fbe53a",
  ],
  Florarie: [
    "photo-1490750967868-88aa4f44baee",
    "photo-1589244159943-460088ed5c92",
    "photo-1565695951564-007d8f297e48",
    "photo-1531058240690-006c446962d8",
  ],
  Curatatorie: [
    "photo-1549037173-e3b717902c57",
    "photo-1545173168-9f1947eebb7f",
    "photo-1451933335233-c41672c8f378",
    "photo-1520434901111-8e9bcb42c628",
  ],
  "Foto & Video": [
    "photo-1617463874381-85b513b3e991",
    "photo-1516035069371-29a1b244cc32",
    "photo-1471341971476-ae15ff5dd4ea",
    "photo-1615458509636-856366d3396e",
  ],
};

// ─── NUME BUSINESS PER CATEGORIE (10 per categorie) ─────────
const BUSINESS_NAMES = {
  Clinica: [
    "MedLife",
    "Sanador",
    "ProMedic",
    "CareClinic",
    "VitaCare",
    "MedCenter",
    "HealthPlus",
    "SanaVita",
    "MedExpert",
    "UrgentMed",
  ],
  Frizerie: [
    "Gentleman Barber",
    "The Barber",
    "ClassicCut",
    "OldSchool Barber",
    "ClipArt",
    "FreshCut",
    "StyleCut",
    "TopBarber",
    "SharpEdge",
    "BladeMaster",
  ],
  Beauty: [
    "GlamBeauty",
    "BeautyZone",
    "LuxBeauty",
    "DivaStyle",
    "NailsArt",
    "BeautyLab",
    "GlowUp",
    "PrettyPlease",
    "ArtNails",
    "SilkSkin",
  ],
  Auto: [
    "AutoPro",
    "SpeedService",
    "TurboFix",
    "CarCare",
    "MasterAuto",
    "QuickFix Auto",
    "DriveService",
    "AutoExpert",
    "MotorPlus",
    "PitStop",
  ],
  "Magazine Online": [
    "eShop Romania",
    "MegaStore",
    "ShopNow",
    "OnlineMall",
    "ClickBuy",
    "FastShop",
    "NetMart",
    "DigiStore",
    "WebShop",
    "SmartBuy",
  ],
  Cafenea: [
    "Coffee Lab",
    "Brew & Co",
    "Espresso Bar",
    "Cafea de Specialitate",
    "Bean There",
    "Morning Cup",
    "ArtCafe",
    "UrbanCafe",
    "Ceainaria",
    "Latteland",
  ],
  Fitness: [
    "PowerGym",
    "FitZone",
    "CrossFit Arena",
    "Body Shape",
    "IronClub",
    "FlexGym",
    "StrongLife",
    "MuscleFactory",
    "FitPro",
    "ActiveLife",
  ],
  "Spa & Wellness": [
    "Zen Spa",
    "RelaxZone",
    "OasisSpa",
    "AquaVita",
    "Serenity",
    "HarmonyWell",
    "PureBliss",
    "TranquilSpa",
    "VitaSpa",
    "NaturaSpa",
  ],
  Optica: [
    "VisionPlus",
    "OchelariExpress",
    "ClearView",
    "OpticaPro",
    "EyeCare",
    "LensCenter",
    "OptiBest",
    "SmartOptic",
    "FocusOptic",
    "SeeWell",
  ],
  Farmacie: [
    "FarmVita",
    "SanFarm",
    "HealthPharm",
    "GreenPharm",
    "PlantaFarm",
    "FarmaPlus",
    "NaturaPharm",
    "BioFarm",
    "VitaPharm",
    "MedFarm",
  ],
  Veterinar: [
    "VetCare",
    "PetClinic",
    "AnimalPlus",
    "VetExpert",
    "PawsClinic",
    "HappyPet",
    "VetPro",
    "AnimalCare",
    "PetHealth",
    "FurFriend",
  ],
  Stomatologie: [
    "DentPro",
    "SmileCare",
    "BrightSmile",
    "DentalExpert",
    "ToothFairy",
    "WhiteSmile",
    "DentCenter",
    "PerfectSmile",
    "OralCare",
    "DentVita",
  ],
  Florarie: [
    "FloraDesign",
    "PetalArt",
    "BouquetExpress",
    "RoseGarden",
    "BloomShop",
    "FloralMagic",
    "GardenOfEden",
    "PetalShop",
    "FloraVita",
    "WildFlowers",
  ],
  Curatatorie: [
    "CleanPro",
    "SpotlessClean",
    "FreshWash",
    "QuickClean",
    "Curatatoria",
    "SparkleClean",
    "PureClean",
    "WashExpert",
    "CleanMaster",
    "DiamondClean",
  ],
  "Foto & Video": [
    "SnapStudio",
    "FotoArt",
    "PixelPerfect",
    "CaptureStudio",
    "LensArt",
    "FlashFoto",
    "PhotoExpert",
    "FrameStudio",
    "VisionMedia",
    "ShutterPro",
  ],
};

// ─── DESCRIERI PER CATEGORIE ─────────────────────────────────
const DESCRIPTIONS = {
  Clinica: [
    "Clinica medicala moderna cu echipamente de ultima generatie. Oferim consultatii in peste 15 specialitati medicale, analize de laborator si imagistica.",
    "Centru medical multidisciplinar dedicat sanatatii dumneavoastra. Programari rapide, rezultate in aceeasi zi si o echipa de specialisti de top.",
    "Clinica de familie cu traditie in ingrijirea medicala de calitate. Oferim consultatii, vaccinari, medicina muncii si check-up-uri complete.",
    "Centru medical de excelenta cu tehnologie avansata si personal dedicat. Consultatii in toate specialitatile, laborator propriu si radiologie digitala.",
  ],
  Frizerie: [
    "Frizerie barbateasca cu atmosfera retro si servicii premium. Tuns clasic, barba, si grooming complet cu produse profesionale.",
    "Barbershop urban cu stil si atitudine. Oferim tunsori moderne, ingrijire barba si tratamente pentru par.",
    "Salon barbatesc dedicat celor care apreciaza detaliile. Tunsori personalizate, barba sculptata si produse de calitate superioara.",
    "Frizerie profesionala cu barberi experimentati. De la tuns clasic la fade modern, de la barba traditionala la conturare precisa.",
  ],
  Beauty: [
    "Salon de infrumusetare complet cu servicii de manichiura, pedichiura, cosmetica si extensii gene. Folosim doar produse premium.",
    "Studio de beauty dedicat femeilor moderne. Oferim manichiura semipermanenta, tratamente faciale, epilare si make-up profesional.",
    "Centru de frumusete cu o gama completa de servicii estetice. De la ingrijirea unghiilor la tratamente corporale avansate.",
    "Salon premium de beauty cu specialisti certificati. Oferim servicii personalizate de cosmetica, manichiura artistica si tratamente anti-aging.",
  ],
  Auto: [
    "Service auto complet cu diagnosticare computerizata si mecanici experimentati. Reparatii mecanice, electrice, tinichigerie si vopsitorie.",
    "Centru auto profesional pentru intretinere si reparatii. Schimb ulei, revizie completa, geometrie roti si climatizare.",
    "Atelier auto de incredere cu peste 10 ani de experienta. Diagnosticare, reparatii motor, cutie de viteze si sisteme de franare.",
    "Service auto modern echipat cu tehnologie de ultima generatie. De la revizia periodica la reparatii complexe.",
  ],
  "Magazine Online": [
    "Magazin online cu o gama variata de produse la preturi competitive. Livrare rapida in toata tara, retur gratuit in 30 de zile.",
    "Platforma de cumparaturi online cu mii de produse din toate categoriile. Oferte zilnice si transport gratuit la comenzi peste 150 lei.",
    "Magazin online de incredere cu produse originale si garantie completa. Livrare in 24h in orasele mari.",
    "E-commerce romanesc cu focus pe calitate si preturi accesibile. Gama larga de produse si recenzii verificate.",
  ],
  Cafenea: [
    "Cafenea de specialitate cu boabe selectate din cele mai bune plantatii. Preparare manuala, latte art si deserturi artizanale.",
    "Spatiu creativ dedicat iubitorilor de cafea buna. Espresso, filter, cold brew si specialitati de sezon.",
    "Cafenea urbana cu personalitate. Cafea prajita local, ceaiuri premium si smoothie-uri fresh.",
    "Coffee shop cu suflet si aroma. Selectam cu grija fiecare sortiment de cafea, oferim alternative vegetale si deserturi fara gluten.",
  ],
  Fitness: [
    "Sala de fitness complet echipata cu aparate de ultima generatie. Zone dedicate pentru cardio, forta si functional training.",
    "Club de fitness premium cu facilitati complete. Sala de forta, zona cardio, studio de cycling si spatiu pentru antrenamente functionale.",
    "Centru de fitness dedicat performantei si sanatatii. Programe personalizate, nutritie sportiva si evaluari periodice.",
    "Gym modern cu o comunitate activa si motivanta. Echipamente Technogym, clase de HIIT, yoga si pilates.",
  ],
  "Spa & Wellness": [
    "Centru spa premium cu o gama completa de tratamente de relaxare si frumusete. Masaj, sauna, jacuzzi si ritualuri de spa personalizate.",
    "Spa boutique dedicat bunastarii tale. Tratamente cu produse naturale, masaje terapeutice si ritualuri de detoxifiere.",
    "Centru wellness cu abordare holistica. Combinam terapii traditionale cu tehnici moderne pentru o experienta unica.",
    "Destinatie de relaxare cu facilitati de top. Oferim masaje suedeze, aromaterapie, reflexoterapie si pachet de spa pentru cupluri.",
  ],
  Optica: [
    "Optica medicala cu o selectie larga de rame si lentile de la branduri de top. Consult oftalmologic si ochelari de soare.",
    "Centru optic modern cu echipamente de diagnostic avansat. Oferim consultatii, ochelari de vedere si lentile progresive.",
    "Optica premium cu colectii exclusive de rame designer. Lentile Zeiss si Essilor, consultatii personalizate.",
    "Magazin optic cu traditie si profesionalism. Gama variata de ochelari de vedere si soare, lentile de contact zilnice si lunare.",
  ],
  Farmacie: [
    "Farmacie cu o gama completa de medicamente, suplimente si produse dermato-cosmetice. Consiliere farmaceutica personalizata.",
    "Farmacie comunitara dedicata sanatatii tale. Medicamente cu si fara reteta, produse naturiste si echipamente medicale.",
    "Farmacie moderna cu servicii extinse. Testare rapida, masurare tensiune si preparare retete magistrale.",
    "Parafarmacia ta de incredere cu produse de calitate. Gama larga de vitamine, suplimente si cosmetice.",
  ],
  Veterinar: [
    "Clinica veterinara cu servicii complete pentru animalele tale de companie. Consultatii, vaccinari, chirurgie si stomatologie veterinara.",
    "Cabinet veterinar modern echipat cu laborator propriu si ecograf. Oferim consultatii, deparazitare si microcipare.",
    "Centru veterinar dedicat sanatatii si bunastarii animalelor. De la consultatii de rutina la interventii chirurgicale.",
    "Clinica veterinara prietenoasa cu personal pasionat. Servicii pentru caini, pisici, rozatoare si pasari.",
  ],
  Stomatologie: [
    "Cabinet stomatologic modern cu echipamente digitale de ultima generatie. Endodontie, protetice, ortodontie si estetica dentara.",
    "Clinica dentara de familie cu medici specialisti. Implantologie, fatete dentare, albire profesionala si stomatologie pediatrica.",
    "Centru de stomatologie estetica si restaurativa. Materiale premium si tehnici minim invazive pentru rezultate naturale.",
    "Cabinet dentar cu abordare moderna si atenta. De la detartraj la reconstructii complexe, fiecare tratament este personalizat.",
  ],
  Florarie: [
    "Florarie cu aranjamente florale unice pentru orice ocazie. Buchete proaspete zilnic si plante de interior.",
    "Atelier floral creativ cu flori proaspete din Olanda si productie locala. Buchete personalizate si decoratiuni pentru nunti.",
    "Florarie online si fizica cu o selectie variata de flori, plante si cadouri. Livrare in aceeasi zi.",
    "Magazin de flori cu traditie si pasiune. Aranjamente clasice si moderne, plante rare si accesorii decorative.",
  ],
  Curatatorie: [
    "Curatatorie profesionala cu tehnologie ecologica. Curatam haine, covoare, perdele si tapiterii auto cu produse biodegradabile.",
    "Spalatorie si curatatorie chimica cu servicii premium. Tratamente speciale pentru piele, blana si materiale delicate.",
    "Curatatorie rapida cu rezultate impecabile. Curatare uscata, spalare, calcare si reparatii croitorie.",
    "Centru profesional de curatare si intretinere textile. Curatam costume, rochii de mireasa si covoare orientale.",
  ],
  "Foto & Video": [
    "Studio foto profesional cu echipament de top si fotografi experimentati. Sedinte foto portret, corporate si eveniment.",
    "Studio de fotografie si videografie pentru toate ocaziile. Nunti, botezuri, sesiuni corporate si continut social media.",
    "Atelier foto-video cu abordare artistica si moderna. Sedinte foto in studio sau exterior, clipuri promotionale.",
    "Servicii complete de fotografie si productie video. De la portrete profesionale la campanii de marketing vizual.",
  ],
};

// ─── BOOKING PER CATEGORIE ──────────────────────────────────
const CATEGORY_BOOKING = {
  Clinica: {
    type: "phone",
    instructions: "Programare telefonica Luni-Vineri 8:00-18:00",
  },
  Frizerie: {
    type: "whatsapp",
    instructions: "Trimite mesaj pe WhatsApp cu data si ora dorita",
  },
  Beauty: {
    type: "whatsapp",
    instructions: "Programare prin WhatsApp. Raspundem in maxim 2 ore.",
  },
  Auto: {
    type: "phone",
    instructions: "Suna pentru programare. Receptie Luni-Sambata 8:00-17:00",
  },
  "Magazine Online": {
    type: "link",
    instructions: "Cumpara direct de pe site. Livrare in toata tara.",
  },
  Cafenea: { type: "none", instructions: null },
  Fitness: {
    type: "phone",
    instructions: "Suna pentru a te inscrie sau vino direct la receptie.",
  },
  "Spa & Wellness": {
    type: "whatsapp",
    instructions: "Rezervare prin WhatsApp cu minim 24h inainte.",
  },
  Optica: {
    type: "phone",
    instructions: "Programare pentru consult: Luni-Vineri 9:00-17:00",
  },
  Farmacie: { type: "none", instructions: null },
  Veterinar: {
    type: "phone",
    instructions: "Programare telefonica. Urgente 24/7.",
  },
  Stomatologie: {
    type: "phone",
    instructions: "Programare telefonica Luni-Vineri 9:00-19:00",
  },
  Florarie: {
    type: "whatsapp",
    instructions: "Comenzi pe WhatsApp. Livrare in aceeasi zi!",
  },
  Curatatorie: {
    type: "phone",
    instructions: "Ridicare si livrare la domiciliu disponibila.",
  },
  "Foto & Video": {
    type: "link",
    instructions: "Rezerva sedinta foto online. Calendar disponibil pe site.",
  },
};

// ─── PROGRAM FUNCTIONARE PER CATEGORIE ──────────────────────
// day_of_week: 0=Monday ... 6=Sunday (ISO)
const BUSINESS_HOURS_TEMPLATES = {
  Clinica: {
    weekday: { open: "08:00", close: "20:00" },
    saturday: { open: "09:00", close: "14:00" },
    sunday: null,
  },
  Frizerie: {
    weekday: { open: "09:00", close: "20:00" },
    saturday: { open: "09:00", close: "18:00" },
    sunday: null,
  },
  Beauty: {
    weekday: { open: "09:00", close: "20:00" },
    saturday: { open: "10:00", close: "18:00" },
    sunday: null,
  },
  Auto: {
    weekday: { open: "08:00", close: "18:00" },
    saturday: { open: "08:00", close: "14:00" },
    sunday: null,
  },
  "Magazine Online": {
    weekday: { open: "09:00", close: "18:00" },
    saturday: { open: "10:00", close: "14:00" },
    sunday: null,
  },
  Cafenea: {
    weekday: { open: "07:00", close: "22:00" },
    saturday: { open: "08:00", close: "22:00" },
    sunday: { open: "09:00", close: "20:00" },
  },
  Fitness: {
    weekday: { open: "06:00", close: "23:00" },
    saturday: { open: "08:00", close: "20:00" },
    sunday: { open: "08:00", close: "20:00" },
  },
  "Spa & Wellness": {
    weekday: { open: "10:00", close: "21:00" },
    saturday: { open: "10:00", close: "20:00" },
    sunday: { open: "10:00", close: "18:00" },
  },
  Optica: {
    weekday: { open: "09:00", close: "19:00" },
    saturday: { open: "09:00", close: "14:00" },
    sunday: null,
  },
  Farmacie: {
    weekday: { open: "08:00", close: "22:00" },
    saturday: { open: "08:00", close: "20:00" },
    sunday: { open: "09:00", close: "18:00" },
  },
  Veterinar: {
    weekday: { open: "08:00", close: "20:00" },
    saturday: { open: "09:00", close: "15:00" },
    sunday: { open: "10:00", close: "14:00" },
  },
  Stomatologie: {
    weekday: { open: "08:00", close: "20:00" },
    saturday: { open: "09:00", close: "14:00" },
    sunday: null,
  },
  Florarie: {
    weekday: { open: "08:00", close: "20:00" },
    saturday: { open: "08:00", close: "18:00" },
    sunday: { open: "09:00", close: "14:00" },
  },
  Curatatorie: {
    weekday: { open: "08:00", close: "19:00" },
    saturday: { open: "09:00", close: "14:00" },
    sunday: null,
  },
  "Foto & Video": {
    weekday: { open: "09:00", close: "19:00" },
    saturday: { open: "10:00", close: "16:00" },
    sunday: null,
  },
};

// ─── CATALOG PER CATEGORIE ──────────────────────────────────
// type: 'service' | 'product' | 'menu_item'
// price in bani (RON × 100), null = "la cerere"
const CATALOG_TEMPLATES = {
  Clinica: {
    categories: ["Consultatii", "Analize de laborator"],
    items: [
      { cat: 0, type: "service", name: "Consult medicina generala", price: 15000, duration: 30 },
      { cat: 0, type: "service", name: "Consult pediatrie", price: 12000, duration: 30 },
      { cat: 0, type: "service", name: "Consult cardiologie", price: 20000, duration: 45 },
      { cat: 1, type: "service", name: "Hemoleucograma completa", price: 4500 },
      { cat: 1, type: "service", name: "Profil lipidic", price: 6000 },
    ],
  },
  Frizerie: {
    categories: ["Tunsori", "Barba & Grooming"],
    items: [
      { cat: 0, type: "service", name: "Tuns clasic", price: 4000, duration: 30 },
      { cat: 0, type: "service", name: "Tuns fade", price: 5000, duration: 40 },
      { cat: 0, type: "service", name: "Tuns copii", price: 3000, duration: 20 },
      { cat: 1, type: "service", name: "Aranjare barba", price: 3000, duration: 20 },
      { cat: 1, type: "service", name: "Tuns + barba complet", price: 7000, duration: 50 },
    ],
  },
  Beauty: {
    categories: ["Manichiura", "Tratamente faciale"],
    items: [
      { cat: 0, type: "service", name: "Manichiura semipermanenta", price: 8000, duration: 60 },
      { cat: 0, type: "service", name: "Manichiura cu gel", price: 10000, duration: 75 },
      { cat: 0, type: "service", name: "Pedichiura spa", price: 9000, duration: 60 },
      { cat: 1, type: "service", name: "Tratament facial hidratant", price: 12000, duration: 60 },
      { cat: 1, type: "service", name: "Curatare faciala profunda", price: 15000, duration: 75 },
    ],
  },
  Auto: {
    categories: ["Revizie & Intretinere", "Caroserie"],
    items: [
      { cat: 0, type: "service", name: "Schimb ulei + filtru", price: 12000, duration: 30 },
      { cat: 0, type: "service", name: "Revizie completa", price: 25000, duration: 120 },
      { cat: 0, type: "service", name: "Geometrie roti 3D", price: 10000, duration: 45 },
      { cat: 1, type: "service", name: "Polish caroserie", price: 20000, duration: 180 },
      { cat: 1, type: "service", name: "Spalare completa interior+exterior", price: 8000, duration: 60 },
    ],
  },
  "Magazine Online": {
    categories: ["Electronice", "Fashion"],
    items: [
      { cat: 0, type: "product", name: "Casti wireless Bluetooth", price: 14900 },
      { cat: 0, type: "product", name: "Incarcator rapid USB-C", price: 4900 },
      { cat: 0, type: "product", name: "Husa telefon premium", price: 3900 },
      { cat: 1, type: "product", name: "Tricou bumbac organic", price: 7900 },
      { cat: 1, type: "product", name: "Rucsac urban impermeabil", price: 12900 },
    ],
  },
  Cafenea: {
    categories: ["Cafea", "Deserturi & Snacks"],
    items: [
      { cat: 0, type: "menu_item", name: "Espresso", price: 800 },
      { cat: 0, type: "menu_item", name: "Cappuccino", price: 1200 },
      { cat: 0, type: "menu_item", name: "Latte", price: 1400 },
      { cat: 0, type: "menu_item", name: "Cold brew", price: 1600 },
      { cat: 1, type: "menu_item", name: "Cheesecake", price: 1800 },
      { cat: 1, type: "menu_item", name: "Croissant cu unt", price: 1000 },
    ],
  },
  Fitness: {
    categories: ["Abonamente", "Personal Training"],
    items: [
      { cat: 0, type: "service", name: "Abonament lunar", price: 12000 },
      { cat: 0, type: "service", name: "Abonament trimestrial", price: 30000 },
      { cat: 0, type: "service", name: "Abonament student", price: 8000 },
      { cat: 1, type: "service", name: "Sedinta personal trainer", price: 8000, duration: 60 },
      { cat: 1, type: "service", name: "Program nutritional personalizat", price: 15000 },
    ],
  },
  "Spa & Wellness": {
    categories: ["Masaje", "Tratamente corporale"],
    items: [
      { cat: 0, type: "service", name: "Masaj relaxare 60 min", price: 15000, duration: 60 },
      { cat: 0, type: "service", name: "Masaj terapeutic 60 min", price: 18000, duration: 60 },
      { cat: 0, type: "service", name: "Masaj cu pietre calde", price: 20000, duration: 75 },
      { cat: 1, type: "service", name: "Impachetare cu alge", price: 12000, duration: 45 },
      { cat: 1, type: "service", name: "Acces sauna + jacuzzi", price: 8000, duration: 120 },
    ],
  },
  Optica: {
    categories: ["Ochelari de vedere", "Lentile de contact"],
    items: [
      { cat: 0, type: "product", name: "Rame ochelari designer", price: 35000 },
      { cat: 0, type: "service", name: "Consult oftalmologic", price: 5000, duration: 30 },
      { cat: 0, type: "product", name: "Lentile progresive Essilor", price: 45000 },
      { cat: 1, type: "product", name: "Lentile de contact lunare (cutie)", price: 8000 },
      { cat: 1, type: "product", name: "Lentile de contact zilnice (30 buc)", price: 12000 },
    ],
  },
  Farmacie: {
    categories: ["Medicamente & Suplimente", "Dermatocosmetice"],
    items: [
      { cat: 0, type: "product", name: "Vitamina C 1000mg (30 cps)", price: 2500 },
      { cat: 0, type: "product", name: "Omega 3 (60 cps)", price: 4500 },
      { cat: 0, type: "product", name: "Magneziu + B6 (30 cps)", price: 2000 },
      { cat: 1, type: "product", name: "Crema hidratanta La Roche-Posay", price: 6500 },
      { cat: 1, type: "product", name: "Protectie solara SPF50+", price: 5500 },
    ],
  },
  Veterinar: {
    categories: ["Consultatii", "Interventii"],
    items: [
      { cat: 0, type: "service", name: "Consult general", price: 5000, duration: 20 },
      { cat: 0, type: "service", name: "Vaccinare (schema completa)", price: 8000, duration: 15 },
      { cat: 0, type: "service", name: "Deparazitare interna + externa", price: 3000, duration: 10 },
      { cat: 1, type: "service", name: "Sterilizare", price: 30000, duration: 60 },
      { cat: 1, type: "service", name: "Detartraj", price: 15000, duration: 45 },
    ],
  },
  Stomatologie: {
    categories: ["Tratamente", "Estetica dentara"],
    items: [
      { cat: 0, type: "service", name: "Detartraj + periaj profesional", price: 10000, duration: 45 },
      { cat: 0, type: "service", name: "Plomba compozit estetica", price: 12000, duration: 30 },
      { cat: 0, type: "service", name: "Extractie simpla", price: 8000, duration: 20 },
      { cat: 1, type: "service", name: "Albire profesionala", price: 50000, duration: 60 },
      { cat: 1, type: "service", name: "Fateta ceramica (per dinte)", price: 150000, duration: 60 },
    ],
  },
  Florarie: {
    categories: ["Buchete", "Plante de interior"],
    items: [
      { cat: 0, type: "product", name: "Buchet mixt de sezon", price: 5000 },
      { cat: 0, type: "product", name: "Buchet trandafiri rosii (11 buc)", price: 12000 },
      { cat: 0, type: "product", name: "Aranjament floral cutie", price: 15000 },
      { cat: 1, type: "product", name: "Monstera Deliciosa", price: 8000 },
      { cat: 1, type: "product", name: "Ficus Lyrata", price: 12000 },
    ],
  },
  Curatatorie: {
    categories: ["Haine", "Textile casa"],
    items: [
      { cat: 0, type: "service", name: "Curatare costum (2 piese)", price: 3000 },
      { cat: 0, type: "service", name: "Curatare camasa", price: 1200 },
      { cat: 0, type: "service", name: "Curatare palton/geaca", price: 4000 },
      { cat: 1, type: "service", name: "Curatare covor (per mp)", price: 2500 },
      { cat: 1, type: "service", name: "Curatare perdele (per kg)", price: 2000 },
    ],
  },
  "Foto & Video": {
    categories: ["Fotografie", "Videografie"],
    items: [
      { cat: 0, type: "service", name: "Sedinta foto portret (30 min)", price: 15000, duration: 30 },
      { cat: 0, type: "service", name: "Fotografie eveniment (3h)", price: 60000, duration: 180 },
      { cat: 0, type: "service", name: "Poze buletin/pasaport", price: 2000, duration: 10 },
      { cat: 1, type: "service", name: "Clip promo 1 min (filmare + edit)", price: 40000, duration: 240 },
      { cat: 1, type: "service", name: "Filmare drona 1h", price: 30000, duration: 60 },
    ],
  },
};

// ─── OFERTE PER CATEGORIE (5+ per categorie) ────────────────
const OFFER_TEMPLATES = {
  Clinica: [
    { title: "Consult medical gratuit", description: "Consultatia initiala este oferita gratuit pentru pacientii noi.", discount_type: "percent", discount_value: [100], conditions: "Doar prima vizita, cu programare" },
    { title: "Analize de sange {V}% reducere", description: "Set complet de analize de sange cu reducere speciala.", discount_type: "percent", discount_value: [15, 20, 25, 30], conditions: "Cu programare, Luni-Vineri" },
    { title: "Ecografie abdominala la {V} lei", description: "Ecografie abdominala completa efectuata de medic specialist.", discount_type: "fixed", discount_value: [80, 100, 120], conditions: "Luni-Vineri 8:00-16:00" },
    { title: "Pachet preventie {V}% off", description: "Pachet complet de medicina preventiva: consult, analize, ECG si ecografie.", discount_type: "percent", discount_value: [20, 25, 30], conditions: "Include consult + analize + ECG" },
    { title: "Pachet cardiologic {V}% reducere", description: "Evaluare cardiologica completa: consult cardiolog, ECG, ecocardiografie.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Programare cu minim 48h inainte" },
  ],
  Frizerie: [
    { title: "Tuns + barba la {V} lei", description: "Pachet complet de tuns si aranjare a barbii cu produse profesionale.", discount_type: "fixed", discount_value: [50, 60, 70, 80], conditions: "Cu programare, Luni-Vineri" },
    { title: "Tuns copii {V}% reducere", description: "Tuns special pentru copii intr-o atmosfera prietenoasa si relaxata.", discount_type: "percent", discount_value: [20, 30, 40], conditions: "Sub 12 ani, insotiti de un adult" },
    { title: "Pachet Groom {V} lei", description: "Pachet complet de grooming: tuns, barba, spalat si tratament par.", discount_type: "fixed", discount_value: [100, 120, 150], conditions: "Tuns + barba + spalat + styling" },
    { title: "Reducere studenti {V}%", description: "Discount special pentru studenti la toate serviciile de frizerie.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Cu carnet de student valid" },
    { title: "Abonament 4 tunsori la {V} lei", description: "Abonament de 4 tunsori. Valid 3 luni de la achizitie.", discount_type: "fixed", discount_value: [120, 150, 180], conditions: "Valid 3 luni, 4 tunsori incluse" },
  ],
  Beauty: [
    { title: "Manichiura semipermanenta {V}% off", description: "Manichiura cu lac semipermanent de calitate superioara.", discount_type: "percent", discount_value: [20, 25, 30], conditions: "Toate culorile disponibile" },
    { title: "Epilare laser zona mica la {V} lei", description: "Epilare definitiva cu laser de ultima generatie.", discount_type: "fixed", discount_value: [80, 100, 120], conditions: "Prima sedinta, o singura zona" },
    { title: "Tratament facial {V}% reducere", description: "Tratament facial personalizat cu curatare profunda si hidratare.", discount_type: "percent", discount_value: [20, 30, 40], conditions: "Sedinta de minim 60 minute" },
    { title: "Gene individuale la {V} lei", description: "Extensii de gene individuale cu efect natural.", discount_type: "fixed", discount_value: [100, 120, 150], conditions: "Include intretinere la 2 saptamani" },
    { title: "Microblading sprancene {V}% off", description: "Microblading profesional pentru sprancene perfecte.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Include retusare gratuita la 30 zile" },
  ],
  Auto: [
    { title: "Schimb ulei + filtru la {V} lei", description: "Schimb de ulei motor si filtru cu produse de calitate.", discount_type: "fixed", discount_value: [100, 120, 150], conditions: "Ulei si filtru incluse in pret" },
    { title: "Spalatorie completa {V}% off", description: "Spalare completa interior si exterior cu produse profesionale.", discount_type: "percent", discount_value: [20, 30, 40], conditions: "Interior + exterior, aspirare inclusa" },
    { title: "Verificare tehnica gratuita", description: "Inspectie tehnica completa gratuita a vehiculului.", discount_type: "percent", discount_value: [100], conditions: "Cu programare, durata 30 min" },
    { title: "Revizie completa la {V} lei", description: "Revizie completa conform specificatiilor producatorului.", discount_type: "fixed", discount_value: [200, 250, 300], conditions: "Programare cu minim 24h inainte" },
    { title: "Climatizare auto {V}% off", description: "Verificare si reincarcare sistem de climatizare auto.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Freon inclus, durata 45 min" },
  ],
  "Magazine Online": [
    { title: "Transport gratuit la comenzi peste {V} lei", description: "Livrare gratuita in toata tara pentru comenzile peste valoarea minima.", discount_type: "fixed", discount_value: [100, 150, 200], conditions: "Valabil pentru toate produsele din stoc" },
    { title: "{V}% reducere la prima comanda", description: "Reducere speciala de bun venit pentru clientii noi.", discount_type: "percent", discount_value: [10, 15, 20], conditions: "Doar prima comanda, un cod per client" },
    { title: "Flash Sale: {V}% la toate produsele", description: "Reduceri masive la intreaga gama de produse.", discount_type: "percent", discount_value: [20, 30, 40, 50], conditions: "Stoc limitat, pe perioada campaniei" },
    { title: "Voucher {V} lei cadou", description: "Voucher de cumparaturi cadou pentru urmatoarea comanda.", discount_type: "fixed", discount_value: [25, 50, 75], conditions: "Valabil 30 de zile de la emitere" },
    { title: "Retur gratuit {V} zile", description: "Returul este gratuit fara explicatii suplimentare.", discount_type: "fixed", discount_value: [14, 30, 60], conditions: "Produsul trebuie sa fie in ambalajul original" },
  ],
  Cafenea: [
    { title: "Cafea {V}% reducere dimineata", description: "Reducere la orice cafea din meniu dimineata devreme.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "7:00-10:00, orice tip de cafea" },
    { title: "Combo cafea + prajitura {V} lei", description: "Orice cafea din meniu cu o prajitura artizanala.", discount_type: "fixed", discount_value: [15, 18, 20], conditions: "Orice cafea + orice prajitura" },
    { title: "Al doilea frappe {V}% off", description: "Cumpara un frappe si al doilea primeste reducere.", discount_type: "percent", discount_value: [30, 40, 50], conditions: "La aceeasi comanda, acelasi tip" },
    { title: "Abonament cafea {V} lei/luna", description: "Abonament lunar pentru o cafea pe zi.", discount_type: "fixed", discount_value: [80, 100, 120], conditions: "1 cafea/zi, valid 30 zile" },
    { title: "Brunch combo {V} lei", description: "Combo de brunch: sandwich artizanal, cafea si suc proaspat.", discount_type: "fixed", discount_value: [25, 30, 35], conditions: "Sambata-Duminica 9:00-13:00" },
  ],
  Fitness: [
    { title: "Abonament lunar {V} lei", description: "Abonament lunar cu acces nelimitat la toate zonele salii.", discount_type: "fixed", discount_value: [80, 100, 120, 150], conditions: "Acces nelimitat, 7 zile/saptamana" },
    { title: "Prima luna {V}% off", description: "Reducere speciala la primul abonament lunar.", discount_type: "percent", discount_value: [30, 40, 50], conditions: "Doar clienti noi, o singura data" },
    { title: "Personal trainer {V} lei/sedinta", description: "Sedinta de antrenament personalizat cu trainer certificat.", discount_type: "fixed", discount_value: [60, 80, 100], conditions: "Minim 4 sedinte, programare obligatorie" },
    { title: "Abonament trimestrial {V}% reducere", description: "Abonamentul pe 3 luni cu acces complet.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Plata integrala, acces complet" },
    { title: "Evaluare corporala gratuita", description: "Evaluare completa a compozitiei corporale cu aparatura InBody.", discount_type: "percent", discount_value: [100], conditions: "La achizitia oricarui abonament" },
  ],
  "Spa & Wellness": [
    { title: "Masaj relaxare {V}% off", description: "Masaj de relaxare pe tot corpul cu uleiuri esentiale premium.", discount_type: "percent", discount_value: [20, 25, 30], conditions: "Sedinta de 60 minute, cu programare" },
    { title: "Pachet spa complet {V} lei", description: "Sauna finlandeza, masaj relaxant si acces jacuzzi.", discount_type: "fixed", discount_value: [150, 200, 250], conditions: "Sauna + masaj + jacuzzi, 3 ore acces" },
    { title: "Zi de relaxare {V} lei", description: "Acces integral pe o zi la toate facilitatile spa.", discount_type: "fixed", discount_value: [200, 250, 300], conditions: "Acces integral 10:00-20:00" },
    { title: "Masaj terapeutic {V} lei/sedinta", description: "Masaj terapeutic pentru durerile de spate, gat si umeri.", discount_type: "fixed", discount_value: [100, 130, 160], conditions: "60 min, recomandare medicala optionala" },
    { title: "Ritual detox {V}% off", description: "Impachetare cu alge marine, masaj limfatic si ceai purificator.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Durata 90 min, cu programare" },
  ],
  Optica: [
    { title: "Consult oftalmologic la {V} lei", description: "Consultatie oftalmologica completa cu autorefractometrie.", discount_type: "fixed", discount_value: [30, 50, 70], conditions: "Cu programare, durata 30 min" },
    { title: "Rame + lentile {V}% off", description: "Reducere la pachetul complet de rame si lentile de vedere.", discount_type: "percent", discount_value: [20, 30, 40], conditions: "Din gama selectata, montaj inclus" },
    { title: "Lentile de contact {V}% reducere", description: "Reducere la lentile de contact zilnice sau lunare.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Cutie lunara sau pachet trimestrial" },
    { title: "Al doilea perete ochelari {V}% off", description: "Reducere la a doua pereche de ochelari din aceeasi comanda.", discount_type: "percent", discount_value: [40, 50, 60], conditions: "Aceeasi comanda, rame din stoc" },
    { title: "Ochelari de soare {V}% off", description: "Reducere la colectia de ochelari de soare cu protectie UV400.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Gama selectata, stoc limitat" },
  ],
  Farmacie: [
    { title: "Vitamine {V}% reducere", description: "Reducere la gama de vitamine si minerale esentiale.", discount_type: "percent", discount_value: [10, 15, 20], conditions: "Gama selectata de vitamine" },
    { title: "Produse dermato-cosmetice {V}% off", description: "Reducere la La Roche-Posay, Vichy, Bioderma.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Brand selectat, stoc disponibil" },
    { title: "Suplimente nutritive la {V} lei", description: "Pachete promotionale de suplimente pentru imunitate.", discount_type: "fixed", discount_value: [30, 40, 50], conditions: "Pachete promo, stoc limitat" },
    { title: "Testare tensiune gratuita", description: "Masurare gratuita a tensiunii arteriale in farmacie.", discount_type: "percent", discount_value: [100], conditions: "Disponibil zilnic in orarul farmaciei" },
    { title: "Protectie solara {V}% off", description: "Reducere la produsele de protectie solara SPF 30 si 50+.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Sezon estival, stoc limitat" },
  ],
  Veterinar: [
    { title: "Consult veterinar la {V} lei", description: "Consultatie veterinara completa cu examinare fizica detaliata.", discount_type: "fixed", discount_value: [30, 50, 60], conditions: "Cu programare, caini si pisici" },
    { title: "Vaccinare {V}% off", description: "Reducere la schema completa de vaccinare pentru caini si pisici.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Caini si pisici, cu programare" },
    { title: "Deparazitare la {V} lei", description: "Tratament complet de deparazitare interna si externa.", discount_type: "fixed", discount_value: [20, 30, 40], conditions: "Include tratament intern si extern" },
    { title: "Microcipare la {V} lei", description: "Implantare microcip de identificare conform legislatiei.", discount_type: "fixed", discount_value: [40, 50, 60], conditions: "Include inregistrare, fara programare" },
    { title: "Pachet preventie {V}% off", description: "Consult, vaccinare, deparazitare si microcipare.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Pachet complet, cu programare" },
  ],
  Stomatologie: [
    { title: "Detartraj + periaj {V} lei", description: "Igiena dentara profesionala cu detartraj ultrasonic.", discount_type: "fixed", discount_value: [80, 100, 120], conditions: "Sedinta completa, durata 45 min" },
    { title: "Albire dentara {V}% off", description: "Albire dentara profesionala cu gel activat de LED.", discount_type: "percent", discount_value: [20, 25, 30], conditions: "O singura sedinta" },
    { title: "Plomba estetica la {V} lei", description: "Obturatie estetica din compozit nano-hibrid.", discount_type: "fixed", discount_value: [100, 120, 150], conditions: "Compozit premium, garantie 2 ani" },
    { title: "Consult + radiografie {V}% reducere", description: "Prima consultatie cu radiografie panoramica digitala.", discount_type: "percent", discount_value: [30, 40, 50], conditions: "Prima vizita, include plan tratament" },
    { title: "Implant dentar la {V} lei", description: "Implant dentar de calitate superioara cu bont protetic.", discount_type: "fixed", discount_value: [500, 600, 700], conditions: "Include bont, fara coroana" },
  ],
  Florarie: [
    { title: "Buchet mixt la {V} lei", description: "Buchet de flori mixte proaspete de sezon.", discount_type: "fixed", discount_value: [40, 50, 60], conditions: "Flori de sezon, disponibilitate zilnica" },
    { title: "Aranjament {V}% off", description: "Reducere la aranjamente florale pentru evenimente.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Comanda cu 3 zile inainte" },
    { title: "Livrare gratuita peste {V} lei", description: "Livrare gratuita in oras pentru comenzi peste valoarea specificata.", discount_type: "fixed", discount_value: [100, 120, 150], conditions: "In oras, livrare in 2-4 ore" },
    { title: "Plante de interior {V}% reducere", description: "Reducere la monstera, ficus, suculente si cactusi.", discount_type: "percent", discount_value: [10, 15, 20], conditions: "Gama selectata, ghiveci inclus" },
    { title: "Cutie cu trandafiri la {V} lei", description: "Cutie eleganta cu trandafiri proaspeti.", discount_type: "fixed", discount_value: [120, 150, 200], conditions: "9 sau 15 trandafiri, culoare la alegere" },
  ],
  Curatatorie: [
    { title: "Curatare costum la {V} lei", description: "Curatare chimica profesionala pentru costum.", discount_type: "fixed", discount_value: [25, 30, 35], conditions: "2 piese (sacou + pantalon), pe umeras" },
    { title: "{V}% la curatare covoare", description: "Reducere la curatare profesionala covoare.", discount_type: "percent", discount_value: [20, 25, 30], conditions: "Minim 2 mp, ridicare de la domiciliu" },
    { title: "Spalare haine {V}% off", description: "Reducere la spalare si calcare haine de zi cu zi.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Minim 3 kg, livrare in 48h" },
    { title: "Curatare canapea la {V} lei", description: "Curatare profesionala canapea la domiciliu.", discount_type: "fixed", discount_value: [80, 100, 120], conditions: "Cu deplasare la domiciliu inclusa" },
    { title: "Rochie de mireasa la {V} lei", description: "Curatare profesionala si conservare rochie de mireasa.", discount_type: "fixed", discount_value: [100, 150, 200], conditions: "Include ambalare speciala" },
  ],
  "Foto & Video": [
    { title: "Sedinta foto portret {V} lei", description: "Sedinta foto portret in studio cu iluminare profesionala.", discount_type: "fixed", discount_value: [100, 150, 200], conditions: "30 minute + 10 poze editate" },
    { title: "Fotografie eveniment {V}% off", description: "Reducere la pachetele de fotografie pentru evenimente.", discount_type: "percent", discount_value: [10, 15, 20], conditions: "Minim 3 ore de fotografiere" },
    { title: "Video promo {V} lei", description: "Clip video promotional de 1 minut complet editat.", discount_type: "fixed", discount_value: [300, 400, 500], conditions: "1 minut editat, include filmare" },
    { title: "Poze buletin/pasaport {V} lei", description: "Fotografii pentru acte oficiale, gata in 10 minute.", discount_type: "fixed", discount_value: [15, 20, 25], conditions: "Gata in 10 min, 4 bucati" },
    { title: "Fotografie corporativa {V}% off", description: "Portrete profesionale individuale si foto de grup.", discount_type: "percent", discount_value: [15, 20, 25], conditions: "Minim 5 persoane, in studio sau la sediu" },
  ],
};

// ─── HELPERS ─────────────────────────────────────────────────

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

function unsplashUrl(photoId, w, h) {
  return `https://images.unsplash.com/${photoId}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;
}

function generateBookingData(categoryName, phone, name) {
  const booking = CATEGORY_BOOKING[categoryName];
  if (!booking) return { type: "none", phone: null, whatsapp: null, url: null, instructions: null };

  return {
    type: booking.type,
    phone: booking.type === "phone" ? phone : null,
    whatsapp: booking.type === "whatsapp" ? phone : null,
    url: booking.type === "link" ? `https://${slugify(name)}.ro/programare` : null,
    instructions: booking.instructions,
  };
}

// ─── MAIN SEED FUNCTION ─────────────────────────────────────

async function seedBusinesses() {
  const client = await pool.connect();

  try {
    console.log("Starting seed process...\n");
    console.log(`Target: ${CATEGORIES.length} categories x 10 = 150 businesses in Bucuresti\n`);

    await client.query("BEGIN");

    // ── 1. Cleanup old seed data ────────────────────────
    console.log("Cleaning up old seed data...");
    const deleted = await client.query(
      "DELETE FROM businesses WHERE source = 'seed' RETURNING id"
    );
    console.log(`  Deleted ${deleted.rowCount} old seed businesses (CASCADE)\n`);

    // ── 2. Ensure categories exist ──────────────────────
    console.log("Checking categories...");
    const categoryMap = {};
    for (const catName of CATEGORIES) {
      const existing = await client.query("SELECT id FROM categories WHERE name = $1", [catName]);
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
    console.log(`  ${Object.keys(categoryMap).length} categories ready`);

    // ── 3. Ensure Bucuresti exists ──────────────────────
    console.log("Checking city...");
    let cityId;
    const existingCity = await client.query("SELECT id FROM cities WHERE name = $1", [CITY.name]);
    if (existingCity.rows.length > 0) {
      cityId = existingCity.rows[0].id;
    } else {
      const result = await client.query("INSERT INTO cities (name) VALUES ($1) RETURNING id", [CITY.name]);
      cityId = result.rows[0].id;
    }
    console.log(`  City '${CITY.name}' ready (id=${cityId})`);

    // ── 4. Get free plan ID ─────────────────────────────
    console.log("Looking up free plan...");
    const freePlan = await client.query("SELECT id FROM subscription_plans WHERE slug = 'free'");
    if (freePlan.rows.length === 0) {
      throw new Error("Free plan not found in subscription_plans! Run migrations first.");
    }
    const freePlanId = freePlan.rows[0].id;
    console.log(`  Free plan id=${freePlanId}\n`);

    // ── 5. Generate 150 businesses ──────────────────────
    console.log("Generating 150 businesses...\n");

    let totalBiz = 0;
    let totalLocations = 0;
    let totalOffers = 0;
    let totalHours = 0;
    let totalCatalogCats = 0;
    let totalCatalogItems = 0;
    let totalSubs = 0;

    for (const categoryName of CATEGORIES) {
      const names = BUSINESS_NAMES[categoryName];
      const descriptions = DESCRIPTIONS[categoryName];
      const photos = UNSPLASH_PHOTOS[categoryName];
      const hoursTemplate = BUSINESS_HOURS_TEMPLATES[categoryName];
      const catalogTemplate = CATALOG_TEMPLATES[categoryName];

      for (let i = 0; i < 10; i++) {
        const name = names[i];
        const description = descriptions[i % descriptions.length];

        // Address
        const street = STREETS[(totalBiz) % STREETS.length];
        const streetNr = randomInt(1, 150);
        const address = `${street} ${streetNr}, ${CITY.name}`;

        // Coordinates (within Bucuresti radius)
        const lat = parseFloat(randomCoord(CITY.lat, CITY.radius).toFixed(6));
        const lng = parseFloat(randomCoord(CITY.lng, CITY.radius).toFixed(6));

        // Phone & Website
        const phone = generatePhone();
        const website = `https://${slugify(name)}.ro`;

        // Images (rotate through category photos)
        const logoPhoto = photos[i % photos.length];
        const coverPhoto = photos[(i + 1) % photos.length];
        const logoUrl = unsplashUrl(logoPhoto, 400, 400);
        const coverUrl = unsplashUrl(coverPhoto, 1200, 600);

        // Booking
        const bookingData = generateBookingData(categoryName, phone, name);

        // ── INSERT BUSINESS ──
        const bizResult = await client.query(
          `INSERT INTO businesses
            (name, description, address, phone, website, lat, lng, city_id, category_id,
             logo_url, cover_image_url, source,
             booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           RETURNING id`,
          [
            name, description, address, phone, website, lat, lng,
            cityId, categoryMap[categoryName],
            logoUrl, coverUrl, "seed",
            bookingData.type, bookingData.phone, bookingData.whatsapp, bookingData.url, bookingData.instructions,
          ]
        );
        const businessId = bizResult.rows[0].id;
        totalBiz++;

        // ── INSERT LOCATION ──
        const locResult = await client.query(
          `INSERT INTO business_locations
            (business_id, city_id, address, lat, lng, phone,
             booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           RETURNING id`,
          [
            businessId, cityId, address, lat, lng, phone,
            bookingData.type, bookingData.phone, bookingData.whatsapp, bookingData.url, bookingData.instructions,
          ]
        );
        const locationId = locResult.rows[0].id;
        totalLocations++;

        // ── INSERT BUSINESS SUBSCRIPTION (free plan) ──
        await client.query(
          `INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
           VALUES ($1, $2, 'active', 'none')`,
          [businessId, freePlanId]
        );
        totalSubs++;

        // ── INSERT BUSINESS HOURS (7 days) ──
        for (let day = 0; day < 7; day++) {
          let schedule;
          if (day >= 0 && day <= 4) {
            schedule = hoursTemplate.weekday;
          } else if (day === 5) {
            schedule = hoursTemplate.saturday;
          } else {
            schedule = hoursTemplate.sunday;
          }

          if (schedule) {
            await client.query(
              `INSERT INTO business_hours (location_id, day_of_week, open_time, close_time, is_closed)
               VALUES ($1, $2, $3, $4, false)`,
              [locationId, day, schedule.open, schedule.close]
            );
          } else {
            await client.query(
              `INSERT INTO business_hours (location_id, day_of_week, open_time, close_time, is_closed)
               VALUES ($1, $2, '00:00', '00:00', true)`,
              [locationId, day]
            );
          }
          totalHours++;
        }

        // ── INSERT CATALOG CATEGORIES + ITEMS ──
        const catIds = [];
        for (let ci = 0; ci < catalogTemplate.categories.length; ci++) {
          const catResult = await client.query(
            `INSERT INTO business_catalog_categories (business_id, name, sort_order)
             VALUES ($1, $2, $3) RETURNING id`,
            [businessId, catalogTemplate.categories[ci], ci]
          );
          catIds.push(catResult.rows[0].id);
          totalCatalogCats++;
        }

        for (let ii = 0; ii < catalogTemplate.items.length; ii++) {
          const item = catalogTemplate.items[ii];
          await client.query(
            `INSERT INTO business_catalog_items
              (business_id, category_id, type, name, description, price, duration_minutes, is_active, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)`,
            [
              businessId,
              catIds[item.cat],
              item.type,
              item.name,
              null,
              item.price,
              item.duration || null,
              ii,
            ]
          );
          totalCatalogItems++;
        }

        // ── INSERT 2 OFFERS ──
        const templates = OFFER_TEMPLATES[categoryName];
        const shuffled = [...templates].sort(() => Math.random() - 0.5);
        const selectedOffers = shuffled.slice(0, 2);

        for (const tpl of selectedOffers) {
          const discountValue = Array.isArray(tpl.discount_value)
            ? randomFrom(tpl.discount_value)
            : tpl.discount_value;
          const title = tpl.title.replace("{V}", discountValue);

          const startDate = new Date();
          startDate.setDate(startDate.getDate() - randomInt(0, 15));
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + randomInt(30, 90));

          await client.query(
            `INSERT INTO offers
              (business_id, title, description, discount_type, discount_value,
               conditions, start_date, end_date, is_active, moderation_status,
               booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,'auto_approved',$9,$10,$11,$12,$13)`,
            [
              businessId,
              title,
              tpl.description,
              tpl.discount_type,
              discountValue,
              tpl.conditions,
              startDate.toISOString().split("T")[0],
              endDate.toISOString().split("T")[0],
              "inherit", null, null, null, null,
            ]
          );
          totalOffers++;
        }

        if (totalBiz % 30 === 0) {
          console.log(`  ${totalBiz}/150 businesses inserted...`);
        }
      }
    }

    // ── 6. Commit ───────────────────────────────────────
    await client.query("COMMIT");

    // ── 7. Summary ──────────────────────────────────────
    console.log("\n===================================================");
    console.log("SEED COMPLETE!");
    console.log("===================================================");
    console.log(`  Businesses:        ${totalBiz}`);
    console.log(`  Locations:         ${totalLocations}`);
    console.log(`  Subscriptions:     ${totalSubs}`);
    console.log(`  Business Hours:    ${totalHours}`);
    console.log(`  Catalog Categories:${totalCatalogCats}`);
    console.log(`  Catalog Items:     ${totalCatalogItems}`);
    console.log(`  Offers:            ${totalOffers}`);
    console.log("===================================================");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// ── RUN ──────────────────────────────────────────────────────
seedBusinesses()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nFatal error:", err.message);
    process.exit(1);
  });
