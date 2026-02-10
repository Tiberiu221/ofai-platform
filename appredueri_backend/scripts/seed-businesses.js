/**
 * Seed script: Populeaza baza de date cu 450 business-uri fictive romanesti
 *
 * Structura: 15 orase x 15 categorii x 2 per pereche = 450 business-uri
 * Fiecare business: 1-2 locatii + 2-3 oferte
 *
 * Rulare: node scripts/seed-businesses.js
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

// ─── ORASE CU COORDONATE ────────────────────────────────────
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

// ─── STRAZI ROMANESTI ────────────────────────────────────────
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

// ─── NUME BUSINESS PER CATEGORIE (15 per categorie) ─────────
const BUSINESS_NAMES = {
  "Clinica": [
    "MedLife", "Sanador", "ProMedic", "CareClinic", "VitaCare",
    "MedCenter", "HealthPlus", "SanaVita", "MedExpert", "UrgentMed",
    "PrimaMed", "NovaMed", "EuroClinic", "FamilyMed", "MedPro",
  ],
  "Frizerie": [
    "Gentleman Barber", "The Barber", "ClassicCut", "OldSchool Barber", "ClipArt",
    "FreshCut", "StyleCut", "TopBarber", "SharpEdge", "BladeMaster",
    "UrbanBarber", "VintageBarber", "PrimeCut", "RoyalBarber", "BarberShop",
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

// ─── SUFIXE PENTRU UNICITATE ─────────────────────────────────
const SUFFIXES = [
  "", " Plus", " Premium", " Pro", " Center", " Studio",
  " Express", " VIP", " Select", " Elite",
];

// ─── DESCRIERI PER CATEGORIE (4 per categorie) ──────────────
const DESCRIPTIONS = {
  "Clinica": [
    "Clinica medicala moderna cu echipamente de ultima generatie. Oferim consultatii in peste 15 specialitati medicale, analize de laborator si imagistica. Echipa noastra de medici cu experienta va sta la dispozitie.",
    "Centru medical multidisciplinar dedicat sanatatii dumneavoastra. Programari rapide, rezultate in aceeasi zi si o echipa de specialisti de top. Acceptam toate asigurarile de sanatate.",
    "Clinica de familie cu traditie in ingrijirea medicala de calitate. Oferim consultatii, vaccinari, medicina muncii si check-up-uri complete. Medici atenti si profesionisti.",
    "Centru medical de excelenta cu tehnologie avansata si personal dedicat. Consultatii in toate specialitatile, laborator propriu si radiologie digitala. Grija pentru sanatatea ta este prioritatea noastra.",
  ],
  "Frizerie": [
    "Frizerie barbateasca cu atmosfera retro si servicii premium. Tuns clasic, barba, si grooming complet cu produse profesionale. Experienta barbieriei traditionale adaptata la stilul modern.",
    "Barbershop urban cu stil si atitudine. Oferim tunsori moderne, ingrijire barba si tratamente pentru par. Fiecare vizita este o experienta de relaxare si stil.",
    "Salon barbatesc dedicat celor care apreciaza detaliile. Tunsori personalizate, barba sculptata si produse de calitate superioara. Programari flexibile si atmosfera prietenoasa.",
    "Frizerie profesionala cu barberi experimentati. De la tuns clasic la fade modern, de la barba traditionala la conturare precisa. Venim cu stilul, tu pleci cu incredere.",
  ],
  "Beauty": [
    "Salon de infrumusetare complet cu servicii de manichiura, pedichiura, cosmetica si extensii gene. Folosim doar produse premium si tehnici de ultima generatie pentru rezultate impecabile.",
    "Studio de beauty dedicat femeilor moderne. Oferim manichiura semipermanenta, tratamente faciale, epilare si make-up profesional. Atmosfera relaxanta si rezultate vizibile.",
    "Centru de frumusete cu o gama completa de servicii estetice. De la ingrijirea unghiilor la tratamente corporale avansate, echipa noastra te ajuta sa arati si sa te simti extraordinar.",
    "Salon premium de beauty cu specialisti certificati. Oferim servicii personalizate de cosmetica, manichiura artistica, tratamente anti-aging si consultatii de imagine. Frumusetea ta, misiunea noastra.",
  ],
  "Auto": [
    "Service auto complet cu diagnosticare computerizata si mecanici experimentati. Reparatii mecanice, electrice, tinichigerie si vopsitorie. Piese originale si garantie pentru toate lucrarile.",
    "Centru auto profesional pentru intretinere si reparatii. Schimb ulei, revizie completa, geometrie roti si climatizare. Preturi transparente si lucrari rapide cu programare.",
    "Atelier auto de incredere cu peste 10 ani de experienta. Diagnosticare, reparatii motor, cutie de viteze si sisteme de franare. Oferim consultanta gratuita si estimari de cost.",
    "Service auto modern echipat cu tehnologie de ultima generatie. De la revizia periodica la reparatii complexe, echipa noastra asigura siguranta si performanta vehiculului tau.",
  ],
  "Restaurant": [
    "Restaurant cu specific romanesc si international, ingrediente proaspete si retete traditionale. Meniul nostru variaza zilnic pentru a va oferi cea mai buna experienta culinara. Atmosfera calda si primitoare.",
    "Bucatarie autentica romaneasca intr-un cadru elegant. Chef cu experienta internationala, meniu de sezon si selectie de vinuri romanesti premium. Ideal pentru cine in familie sau mese de afaceri.",
    "Restaurant modern cu influente mediteraneene si traditionale. Ingrediente locale de la producatori romani, preparate cu pasiune si creativitate. Terasa generoasa si ambient deosebit.",
    "Loc de intalnire pentru iubitorii de mancare buna. Meniu diversificat, portii generoase si preturi corecte. De la brunch la cina festiva, fiecare masa este o sarbatoare a gustului.",
  ],
  "Cafenea": [
    "Cafenea de specialitate cu boabe selectate din cele mai bune plantatii. Preparare manuala, latte art si o atmosfera perfecta pentru lucru sau relaxare. Servim si deserturi artizanale.",
    "Spatiu creativ dedicat iubitorilor de cafea buna. Espresso, filter, cold brew si specialitati de sezon. Retete proprii de prajituri si un ambient care te inspira.",
    "Cafenea urbana cu personalitate. Cafea prajita local, ceaiuri premium si smoothie-uri fresh. Loc ideal pentru intalniri, studiu sau pur si simplu o pauza din rutina zilnica.",
    "Coffee shop cu suflet si aroma. Selectam cu grija fiecare sortiment de cafea, oferim alternative vegetale si deserturi fara gluten. Wi-Fi gratuit si atmosfera prietenoasa.",
  ],
  "Fitness": [
    "Sala de fitness complet echipata cu aparate de ultima generatie. Zone dedicate pentru cardio, forta si functional training. Antrenori personali certificati si clase de grup variate.",
    "Club de fitness premium cu facilitati complete. Sala de forta, zona cardio, studio de cycling si spatiu pentru antrenamente functionale. Dusuri, sauna si parcare gratuita incluse.",
    "Centru de fitness dedicat performantei si sanatatii. Programe personalizate, nutritie sportiva si evaluari periodice. De la incepatori la avansati, fiecare membru conteaza.",
    "Gym modern cu o comunitate activa si motivanta. Echipamente Technogym, clase de HIIT, yoga si pilates. Abonamente flexibile si acces extins 6:00-23:00.",
  ],
  "Spa & Wellness": [
    "Centru spa premium cu o gama completa de tratamente de relaxare si frumusete. Masaj, sauna, jacuzzi si ritualuri de spa personalizate. O oaza de liniste in mijlocul orasului.",
    "Spa boutique dedicat bunastarii tale. Tratamente cu produse naturale, masaje terapeutice si ritualuri de detoxifiere. Fiecare vizita este o calatorie spre echilibru si armonie.",
    "Centru wellness cu abordare holistica. Combinam terapii traditionale cu tehnici moderne pentru o experienta unica. Sauna finlandeza, bai turcesti si zona de relaxare premium.",
    "Destinatie de relaxare cu facilitati de top. Oferim masaje suedeze, aromaterapie, reflexoterapie si pachet de spa pentru cupluri. Rezerva-ti momentul tau de liniste.",
  ],
  "Optica": [
    "Optica medicala cu o selectie larga de rame si lentile de la branduri de top. Consult oftalmologic, lentile de contact si ochelari de soare. Servicii de calitate la preturi accesibile.",
    "Centru optic modern cu echipamente de diagnostic avansat. Oferim consultatii, ochelari de vedere, lentile progresive si lentile de contact. Garantie si service post-vanzare incluse.",
    "Optica premium cu colectii exclusive de rame designer. Lentile Zeiss si Essilor, consultatii personalizate si ajustari gratuite. Investeste in vederea ta cu specialistii nostri.",
    "Magazin optic cu traditie si profesionalism. Gama variata de ochelari de vedere si soare, lentile de contact zilnice si lunare. Consult gratuit si montaj in aceeasi zi.",
  ],
  "Farmacie": [
    "Farmacie cu o gama completa de medicamente, suplimente si produse dermato-cosmetice. Consiliere farmaceutica personalizata si preturi competitive. Deschis 7 zile pe saptamana.",
    "Farmacie comunitara dedicata sanatatii tale. Medicamente cu si fara reteta, produse naturiste si echipamente medicale. Personal calificat gata sa te ajute cu orice intrebare.",
    "Farmacie moderna cu servicii extinse. Testare rapida, masurare tensiune, consiliere nutritionala si preparare retete magistrale. Farmacisti cu experienta la dispozitia ta.",
    "Parafarmacia ta de incredere cu produse de calitate. Gama larga de vitamine, suplimente, cosmetice si produse pentru ingrijirea bebelusului. Promotii saptamanale si card de fidelitate.",
  ],
  "Veterinar": [
    "Clinica veterinara cu servicii complete pentru animalele tale de companie. Consultatii, vaccinari, chirurgie si stomatologie veterinara. Medici cu experienta si dragoste pentru animale.",
    "Cabinet veterinar modern echipat cu laborator propriu si ecograf. Oferim consultatii, deparazitare, microcipare si consiliere nutritionala. Urgente disponibile 24/7.",
    "Centru veterinar dedicat sanatatii si bunastarii animalelor. De la consultatii de rutina la interventii chirurgicale, echipa noastra ofera ingrijire de cel mai inalt nivel.",
    "Clinica veterinara prietenoasa cu personal pasionat. Servicii pentru caini, pisici, rozatoare si pasari. Grooming, pensiune si pet shop integrat. Animalul tau merita ce e mai bun.",
  ],
  "Stomatologie": [
    "Cabinet stomatologic modern cu echipamente digitale de ultima generatie. Oferim tratamente de endodontie, protetice, ortodontie si estetica dentara. Zambet perfect cu grija pentru confortul tau.",
    "Clinica dentara de familie cu medici specialisti in toate ramurile stomatologiei. Implantologie, fatete dentare, albire profesionala si stomatologie pediatrica. Programari fara timp de asteptare.",
    "Centru de stomatologie estetica si restaurativa. Folosim materiale premium si tehnici minim invazive pentru rezultate naturale si durabile. Sedare constienta disponibila.",
    "Cabinet dentar cu abordare moderna si atenta. De la detartraj la reconstructii complexe, fiecare tratament este personalizat. Radiografie digitala si scanner intraoral 3D.",
  ],
  "Florarie": [
    "Florarie cu aranjamente florale unice pentru orice ocazie. Buchete proaspete zilnic, aranjamente pentru evenimente si plante de interior. Livrare rapida in tot orasul.",
    "Atelier floral creativ cu flori proaspete din Olanda si productie locala. Buchete personalizate, decoratiuni pentru nunti si abonamente florale pentru companii. Fiecare floare spune o poveste.",
    "Florarie online si fizica cu o selectie variata de flori, plante si cadouri. Livrare in aceeasi zi, ambalaje premium si felicitari personalizate. Surprinde pe cineva drag!",
    "Magazin de flori cu traditie si pasiune. Aranjamente clasice si moderne, plante rare si accesorii decorative. Consultanta gratuita pentru evenimente si decoruri speciale.",
  ],
  "Curatatorie": [
    "Curatatorie profesionala cu tehnologie ecologica si delicata. Curatam haine, covoare, perdele si tapiterii auto cu produse biodegradabile. Ridicare si livrare la domiciliu disponibila.",
    "Spalatorie si curatatorie chimica cu servicii premium. Tratamente speciale pentru piele, blana si materiale delicate. Calcare profesionala si ambalare pentru transport.",
    "Curatatorie rapida cu rezultate impecabile. Servicii de curatare uscata, spalare, calcare si reparatii croitorie. Preturi competitive si abonamente pentru clienti fideli.",
    "Centru profesional de curatare si intretinere textile. Curatam costume, rochii de mireasa, covoare orientale si articole de piele. Garantam calitatea fiecarui articol tratat.",
  ],
  "Foto & Video": [
    "Studio foto profesional cu echipament de top si fotografi experimentati. Sedinte foto portret, corporate, produs si eveniment. Editare profesionala si livrare rapida.",
    "Studio de fotografie si videografie pentru toate ocaziile. Nunti, botezuri, sesiuni corporate si continut pentru social media. Drone disponibile si editare cinematografica.",
    "Atelier foto-video cu abordare artistica si moderna. Sedinte foto in studio sau exterior, clipuri promotionale si fotografie de produs. Rezultate creative care impresioneaza.",
    "Servicii complete de fotografie si productie video. De la portrete profesionale la campanii de marketing vizual. Echipament Canon si Sony de ultima generatie.",
  ],
};

// ─── BOOKING PER CATEGORIE ──────────────────────────────────
const CATEGORY_BOOKING = {
  "Clinica":        { type: "phone",    instructions: "Programare telefonica Luni-Vineri 8:00-18:00" },
  "Frizerie":       { type: "whatsapp", instructions: "Trimite mesaj pe WhatsApp cu data si ora dorita" },
  "Beauty":         { type: "whatsapp", instructions: "Programare prin WhatsApp. Raspundem in maxim 2 ore." },
  "Auto":           { type: "phone",    instructions: "Suna pentru programare. Receptie Luni-Sambata 8:00-17:00" },
  "Restaurant":     { type: "link",     instructions: "Rezerva online masa ta. Confirmare automata." },
  "Cafenea":        { type: "none",     instructions: null },
  "Fitness":        { type: "phone",    instructions: "Suna pentru a te inscrie sau vino direct la receptie." },
  "Spa & Wellness": { type: "whatsapp", instructions: "Rezervare prin WhatsApp cu minim 24h inainte." },
  "Optica":         { type: "phone",    instructions: "Programare pentru consult: Luni-Vineri 9:00-17:00" },
  "Farmacie":       { type: "none",     instructions: null },
  "Veterinar":      { type: "phone",    instructions: "Programare telefonica. Urgente 24/7." },
  "Stomatologie":   { type: "phone",    instructions: "Programare telefonica Luni-Vineri 9:00-19:00" },
  "Florarie":       { type: "whatsapp", instructions: "Comenzi pe WhatsApp. Livrare in aceeasi zi!" },
  "Curatatorie":    { type: "phone",    instructions: "Ridicare si livrare la domiciliu disponibila." },
  "Foto & Video":   { type: "link",     instructions: "Rezerva sedinta foto online. Calendar disponibil pe site." },
};

// ─── DICEBEAR LOGO STYLES PER CATEGORIE ─────────────────────
const LOGO_STYLES = {
  "Clinica": "initials",
  "Frizerie": "bottts",
  "Beauty": "shapes",
  "Auto": "identicon",
  "Restaurant": "bottts",
  "Cafenea": "shapes",
  "Fitness": "identicon",
  "Spa & Wellness": "shapes",
  "Optica": "initials",
  "Farmacie": "initials",
  "Veterinar": "bottts",
  "Stomatologie": "initials",
  "Florarie": "shapes",
  "Curatatorie": "identicon",
  "Foto & Video": "shapes",
};

// ─── OFERTE PER CATEGORIE (5-8 per categorie) ──────────────
const OFFER_TEMPLATES = {
  "Clinica": [
    {
      title: "Consult medical gratuit",
      description: "Consultatia initiala este oferita gratuit pentru pacientii noi. Include evaluare generala si recomandari de investigatii suplimentare daca este necesar.",
      discount_type: "percent",
      discount_value: [100],
      conditions: "Doar prima vizita, cu programare",
    },
    {
      title: "Analize de sange {V}% reducere",
      description: "Set complet de analize de sange cu reducere speciala. Include hemoleucograma, glicemie, profil lipidic si functie hepatica.",
      discount_type: "percent",
      discount_value: [15, 20, 25, 30],
      conditions: "Cu programare, Luni-Vineri",
    },
    {
      title: "Ecografie abdominala la {V} lei",
      description: "Ecografie abdominala completa efectuata de medic specialist. Rezultatele sunt disponibile imediat dupa examinare.",
      discount_type: "fixed",
      discount_value: [80, 100, 120],
      conditions: "Luni-Vineri 8:00-16:00",
    },
    {
      title: "Pachet preventie {V}% off",
      description: "Pachet complet de medicina preventiva care include consult, analize de laborator, ECG si ecografie. Ideal pentru un check-up anual.",
      discount_type: "percent",
      discount_value: [20, 25, 30],
      conditions: "Include consult + analize + ECG",
    },
    {
      title: "Consultatii pediatrice la {V} lei",
      description: "Consultatii de pediatrie pentru copii intre 0 si 18 ani. Medic pediatru cu experienta, disponibil si pentru urgente.",
      discount_type: "fixed",
      discount_value: [60, 80, 100],
      conditions: "Cu programare, varsta 0-18 ani",
    },
    {
      title: "Pachet cardiologic {V}% reducere",
      description: "Evaluare cardiologica completa: consult cardiolog, ECG, ecocardiografie si Holter EKG. Ideal pentru persoanele cu factori de risc cardiovascular.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Programare cu minim 48h inainte",
    },
  ],
  "Frizerie": [
    {
      title: "Tuns + barba la {V} lei",
      description: "Pachet complet de tuns si aranjare a barbii cu produse profesionale. Include spalare si styling.",
      discount_type: "fixed",
      discount_value: [50, 60, 70, 80],
      conditions: "Cu programare, Luni-Vineri",
    },
    {
      title: "Tuns copii {V}% reducere",
      description: "Tuns special pentru copii intr-o atmosfera prietenoasa si relaxata. Barberi cu rabdare si experienta cu cei mici.",
      discount_type: "percent",
      discount_value: [20, 30, 40],
      conditions: "Sub 12 ani, insotiti de un adult",
    },
    {
      title: "Pachet Groom {V} lei",
      description: "Pachet complet de grooming barbatesc: tuns, barba, spalat si tratament pentru par. Experienta premium cu produse de top.",
      discount_type: "fixed",
      discount_value: [100, 120, 150],
      conditions: "Tuns + barba + spalat + styling",
    },
    {
      title: "Reducere studenti {V}%",
      description: "Discount special pentru studenti la toate serviciile de frizerie. Arata-ne carnetul de student si beneficiezi de reducere.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Cu carnet de student valid",
    },
    {
      title: "Abonament 4 tunsori la {V} lei",
      description: "Cumpara un abonament de 4 tunsori si economiseste. Valid 3 luni de la achizitie, transferabil.",
      discount_type: "fixed",
      discount_value: [120, 150, 180],
      conditions: "Valid 3 luni, 4 tunsori incluse",
    },
    {
      title: "Tratament scalp {V}% off",
      description: "Tratament profesional pentru scalp cu produse specializate. Ideal pentru scalp sensibil, matreata sau par subtire.",
      discount_type: "percent",
      discount_value: [20, 25, 30],
      conditions: "Durata 30 min, cu programare",
    },
    {
      title: "Colorare barba la {V} lei",
      description: "Serviciu de colorare profesionala a barbii pentru acoperirea firelor albe. Rezultat natural si de durata.",
      discount_type: "fixed",
      discount_value: [30, 40, 50],
      conditions: "Durata 20 min, culori naturale",
    },
  ],
  "Beauty": [
    {
      title: "Manichiura semipermanenta {V}% off",
      description: "Manichiura cu lac semipermanent de calitate superioara. Rezistenta de pana la 3 saptamani, gama larga de culori disponibile.",
      discount_type: "percent",
      discount_value: [20, 25, 30],
      conditions: "Toate culorile disponibile",
    },
    {
      title: "Epilare laser zona mica la {V} lei",
      description: "Epilare definitiva cu laser de ultima generatie pentru zone mici (axile, bikini, mustata). Prima sedinta la pret special.",
      discount_type: "fixed",
      discount_value: [80, 100, 120],
      conditions: "Prima sedinta, o singura zona",
    },
    {
      title: "Tratament facial {V}% reducere",
      description: "Tratament facial personalizat cu curatare profunda, masaj facial, masca si hidratare. Piele luminoasa si catifelata.",
      discount_type: "percent",
      discount_value: [20, 30, 40],
      conditions: "Sedinta de minim 60 minute",
    },
    {
      title: "Gene individuale la {V} lei",
      description: "Extensii de gene individuale cu efect natural. Aplicare profesionala si intretinere inclusa la 2 saptamani.",
      discount_type: "fixed",
      discount_value: [100, 120, 150],
      conditions: "Include intretinere la 2 saptamani",
    },
    {
      title: "Pedichiura spa la {V} lei",
      description: "Pedichiura completa cu tratament spa pentru picioare. Include baie, exfoliere, masaj si lac semipermanent.",
      discount_type: "fixed",
      discount_value: [80, 100, 120],
      conditions: "Durata aproximativa 60 min",
    },
    {
      title: "Microblading sprancene {V}% off",
      description: "Microblading profesional pentru sprancene perfecte si naturale. Tehnica fir cu fir, include consultatie si retusare la 30 zile.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Include retusare gratuita la 30 zile",
    },
    {
      title: "Pachet mireasa la {V} lei",
      description: "Pachet complet pentru mireasa: machiaj profesional, coafura, manichiura si pedichiura. Proba inclusa cu 2 saptamani inainte.",
      discount_type: "fixed",
      discount_value: [400, 500, 600],
      conditions: "Include proba, cu programare",
    },
  ],
  "Auto": [
    {
      title: "Schimb ulei + filtru la {V} lei",
      description: "Schimb de ulei motor si filtru de ulei cu produse de calitate. Include verificare niveluri lichide si presiune roti.",
      discount_type: "fixed",
      discount_value: [100, 120, 150],
      conditions: "Ulei si filtru incluse in pret",
    },
    {
      title: "Spalatorie completa {V}% off",
      description: "Spalare completa interior si exterior cu produse profesionale. Include aspirare, curatare bord si odorizant.",
      discount_type: "percent",
      discount_value: [20, 30, 40],
      conditions: "Interior + exterior, aspirare inclusa",
    },
    {
      title: "Verificare tehnica gratuita",
      description: "Inspectie tehnica completa gratuita a vehiculului. Verificam frane, suspensie, directie si sisteme electrice.",
      discount_type: "percent",
      discount_value: [100],
      conditions: "Cu programare, durata 30 min",
    },
    {
      title: "Anvelope {V}% reducere",
      description: "Reducere la setul complet de anvelope noi. Montaj, echilibrare si aliniere directie incluse in oferta.",
      discount_type: "percent",
      discount_value: [10, 15, 20],
      conditions: "Set complet 4 anvelope, montaj inclus",
    },
    {
      title: "Revizie completa la {V} lei",
      description: "Revizie completa conform specificatiilor producatorului. Include schimb ulei, filtre, verificare frane si sisteme de siguranta.",
      discount_type: "fixed",
      discount_value: [200, 250, 300],
      conditions: "Programare cu minim 24h inainte",
    },
    {
      title: "Climatizare auto {V}% off",
      description: "Verificare si reincarcare sistem de climatizare auto. Include test etanseitate, curatare filtru habitaclu si dezinfectare.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Freon inclus, durata 45 min",
    },
    {
      title: "Polish + ceruire la {V} lei",
      description: "Tratament complet de polish si ceruire caroserie pentru un aspect ca nou. Protectie UV si hidrofoba pe termen lung.",
      discount_type: "fixed",
      discount_value: [150, 200, 250],
      conditions: "Durata 3-4 ore, cu programare",
    },
    {
      title: "Geometrie roti la {V} lei",
      description: "Serviciu de geometrie a rotilor cu echipament 3D de precizie. Previne uzura inegala a anvelopelor si imbunatateste stabilitatea.",
      discount_type: "fixed",
      discount_value: [80, 100, 120],
      conditions: "Fata + spate, raport inclus",
    },
  ],
  "Restaurant": [
    {
      title: "Meniu pranz la {V} lei",
      description: "Meniu complet de pranz cu supa, felul principal si desert. Ingrediente proaspete si preparate in aceeasi zi.",
      discount_type: "fixed",
      discount_value: [25, 30, 35, 40],
      conditions: "Luni-Vineri 12:00-15:00",
    },
    {
      title: "{V}% la comanda online",
      description: "Reducere speciala pentru comenzile plasate online sau prin aplicatie. Livrare gratuita peste 80 lei.",
      discount_type: "percent",
      discount_value: [10, 15, 20],
      conditions: "Comanda minima 50 lei, livrare inclusa",
    },
    {
      title: "Desert gratuit la orice fel principal",
      description: "Primesti un desert din meniul nostru gratuit la comanda oricarui fel principal. Alege din tiramisu, panna cotta sau clatite.",
      discount_type: "percent",
      discount_value: [100],
      conditions: "Cu rezervare, un desert per persoana",
    },
    {
      title: "Brunch {V} lei/persoana",
      description: "Brunch all-inclusive cu oua, pancakes, fructe proaspete, cafea si suc natural. Ideal pentru weekend-uri relaxante.",
      discount_type: "fixed",
      discount_value: [40, 50, 60],
      conditions: "Sambata-Duminica 10:00-14:00",
    },
    {
      title: "Happy hour {V}% la bauturi",
      description: "Reducere la toate bauturile din meniu in intervalul happy hour. Include cocktailuri, bere, vin si sucuri naturale.",
      discount_type: "percent",
      discount_value: [20, 30, 40],
      conditions: "Luni-Joi 17:00-19:00",
    },
    {
      title: "Meniu cina romantica {V} lei/cuplu",
      description: "Meniu special pentru doua persoane cu aperitiv, fel principal, desert si o sticla de vin. Cadrul romantic este asigurat.",
      discount_type: "fixed",
      discount_value: [150, 180, 200],
      conditions: "Cu rezervare, Vineri-Sambata seara",
    },
  ],
  "Cafenea": [
    {
      title: "Cafea {V}% reducere dimineata",
      description: "Reducere la orice cafea din meniu in primele ore ale diminetii. Start perfect de zi cu cafea de specialitate.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "7:00-10:00, orice tip de cafea",
    },
    {
      title: "Combo cafea + prajitura {V} lei",
      description: "Combina orice cafea din meniu cu o prajitura artizanala la un pret special. Prajituri proaspete zilnic.",
      discount_type: "fixed",
      discount_value: [15, 18, 20],
      conditions: "Orice cafea + orice prajitura",
    },
    {
      title: "Al doilea frappe {V}% off",
      description: "Cumpara un frappe si al doilea primeste reducere. Perfect pentru o iesire cu prietenii pe timp de vara.",
      discount_type: "percent",
      discount_value: [30, 40, 50],
      conditions: "La aceeasi comanda, acelasi tip",
    },
    {
      title: "Abonament cafea {V} lei/luna",
      description: "Abonament lunar pentru o cafea pe zi. Alege din espresso, cappuccino sau latte. Economisesti peste 50% fata de pretul normal.",
      discount_type: "fixed",
      discount_value: [80, 100, 120],
      conditions: "1 cafea/zi, valid 30 zile",
    },
    {
      title: "Ceai premium {V}% off",
      description: "Selectie de ceaiuri premium din toata lumea cu reducere. De la ceai verde japonez la rooibos african si infuzii romanesti.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Gama selectata de ceaiuri premium",
    },
    {
      title: "Smoothie fresh la {V} lei",
      description: "Smoothie proaspat preparat cu fructe de sezon, lapte vegetal si superfoods. Alegeti din 5 combinatii delicioase.",
      discount_type: "fixed",
      discount_value: [12, 15, 18],
      conditions: "Fructe proaspete, preparare la comanda",
    },
    {
      title: "Brunch combo {V} lei",
      description: "Combo de brunch cu sandwich artizanal, cafea de specialitate si suc proaspat. Meniu diferit in fiecare saptamana.",
      discount_type: "fixed",
      discount_value: [25, 30, 35],
      conditions: "Sambata-Duminica 9:00-13:00",
    },
  ],
  "Fitness": [
    {
      title: "Abonament lunar {V} lei",
      description: "Abonament lunar cu acces nelimitat la toate zonele salii. Include cardio, forta, zona functionala si dusuri.",
      discount_type: "fixed",
      discount_value: [80, 100, 120, 150],
      conditions: "Acces nelimitat, 7 zile/saptamana",
    },
    {
      title: "Prima luna {V}% off",
      description: "Reducere speciala pentru clientii noi la primul abonament lunar. Include evaluare corporala si program personalizat.",
      discount_type: "percent",
      discount_value: [30, 40, 50],
      conditions: "Doar clienti noi, o singura data",
    },
    {
      title: "Personal trainer {V} lei/sedinta",
      description: "Sedinta de antrenament personalizat cu trainer certificat. Program adaptat obiectivelor tale de fitness.",
      discount_type: "fixed",
      discount_value: [60, 80, 100],
      conditions: "Minim 4 sedinte, programare obligatorie",
    },
    {
      title: "Abonament trimestrial {V}% reducere",
      description: "Economiseste cu abonamentul pe 3 luni. Acces complet la toate facilitatile si clasele de grup incluse.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Plata integrala, acces complet",
    },
    {
      title: "Clase de grup {V} lei/luna",
      description: "Acces la toate clasele de grup: spinning, yoga, pilates, HIIT si zumba. Peste 20 clase pe saptamana.",
      discount_type: "fixed",
      discount_value: [50, 70, 90],
      conditions: "Program disponibil la receptie",
    },
    {
      title: "Abonament student {V}% off",
      description: "Abonament cu reducere pentru studenti la toate facilitatile salii. Acces complet inclusiv clase de grup.",
      discount_type: "percent",
      discount_value: [20, 25, 30],
      conditions: "Cu carnet de student valid",
    },
    {
      title: "Evaluare corporala gratuita",
      description: "Evaluare completa a compozitiei corporale cu aparatura InBody. Include masuratori, analiza si recomandari de antrenament.",
      discount_type: "percent",
      discount_value: [100],
      conditions: "La achizitia oricarui abonament",
    },
  ],
  "Spa & Wellness": [
    {
      title: "Masaj relaxare {V}% off",
      description: "Masaj de relaxare pe tot corpul cu uleiuri esentiale premium. Sedinta de 60 minute pentru eliminarea stresului si tensiunilor.",
      discount_type: "percent",
      discount_value: [20, 25, 30],
      conditions: "Sedinta de 60 minute, cu programare",
    },
    {
      title: "Pachet spa complet {V} lei",
      description: "Experienta spa completa cu sauna finlandeza, masaj relaxant si acces jacuzzi. Include halat, papuci si ceai detox.",
      discount_type: "fixed",
      discount_value: [150, 200, 250],
      conditions: "Sauna + masaj + jacuzzi, 3 ore acces",
    },
    {
      title: "Tratament anticelulitic {V}% reducere",
      description: "Program de tratamente anticelulitice cu tehnologie avansata. Rezultate vizibile dupa 5 sedinte.",
      discount_type: "percent",
      discount_value: [20, 30, 40],
      conditions: "Pachet de 5 sedinte, o sedinta/saptamana",
    },
    {
      title: "Zi de relaxare {V} lei",
      description: "Acces integral pe o zi la toate facilitatile spa: piscina, sauna, hamam, zona de relaxare si bar cu sucuri fresh.",
      discount_type: "fixed",
      discount_value: [200, 250, 300],
      conditions: "Acces integral 10:00-20:00",
    },
    {
      title: "Masaj terapeutic {V} lei/sedinta",
      description: "Masaj terapeutic pentru ameliorarea durerilor de spate, gat si umeri. Terapeut certificat cu experienta clinica.",
      discount_type: "fixed",
      discount_value: [100, 130, 160],
      conditions: "60 min, recomandare medicala optionala",
    },
    {
      title: "Pachet spa cuplu {V} lei",
      description: "Experienta romantica de spa pentru doi: masaj simultan, sauna privata si sampanie. Cadoul perfect pentru aniversari.",
      discount_type: "fixed",
      discount_value: [300, 400, 500],
      conditions: "Cu rezervare, minim 48h inainte",
    },
    {
      title: "Ritual detox {V}% off",
      description: "Ritual complet de detoxifiere cu impachetare cu alge marine, masaj limfatic si ceai purificator. Elimina toxinele si revitalizeaza.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Durata 90 min, cu programare",
    },
  ],
  "Optica": [
    {
      title: "Consult oftalmologic la {V} lei",
      description: "Consultatie oftalmologica completa cu autorefractometrie si examen de fund de ochi. Reteta pentru ochelari inclusa.",
      discount_type: "fixed",
      discount_value: [30, 50, 70],
      conditions: "Cu programare, durata 30 min",
    },
    {
      title: "Rame + lentile {V}% off",
      description: "Reducere la pachetul complet de rame si lentile de vedere. Gama variata de rame de la branduri de top.",
      discount_type: "percent",
      discount_value: [20, 30, 40],
      conditions: "Din gama selectata, montaj inclus",
    },
    {
      title: "Lentile de contact {V}% reducere",
      description: "Reducere la lentile de contact zilnice sau lunare. Branduri premium pentru confort maxim toata ziua.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Cutie lunara sau pachet trimestrial",
    },
    {
      title: "Al doilea perete ochelari {V}% off",
      description: "Reducere la a doua pereche de ochelari din aceeasi comanda. Ideal pentru ochelari de rezerva sau de soare cu dioptrii.",
      discount_type: "percent",
      discount_value: [40, 50, 60],
      conditions: "Aceeasi comanda, rame din stoc",
    },
    {
      title: "Ochelari de soare {V}% off",
      description: "Reducere la colectia de ochelari de soare cu protectie UV400. Branduri Ray-Ban, Oakley, Polaroid si altele.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Gama selectata, stoc limitat",
    },
    {
      title: "Lentile progresive la {V} lei",
      description: "Lentile progresive de calitate superioara la pret special. Tranzitie lina intre distante, fara linii vizibile.",
      discount_type: "fixed",
      discount_value: [200, 250, 300],
      conditions: "Include consult si montaj",
    },
  ],
  "Farmacie": [
    {
      title: "Vitamine {V}% reducere",
      description: "Reducere la gama de vitamine si minerale esentiale. De la vitamina C si D la complexe multivitamine pentru intreaga familie.",
      discount_type: "percent",
      discount_value: [10, 15, 20],
      conditions: "Gama selectata de vitamine",
    },
    {
      title: "Produse dermato-cosmetice {V}% off",
      description: "Reducere la produse dermato-cosmetice de farmacia. Branduri La Roche-Posay, Vichy, Bioderma si altele.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Brand selectat, stoc disponibil",
    },
    {
      title: "Suplimente nutritive la {V} lei",
      description: "Pachete promotionale de suplimente nutritive pentru imunitate, energie si bunastare generala.",
      discount_type: "fixed",
      discount_value: [30, 40, 50],
      conditions: "Pachete promo, stoc limitat",
    },
    {
      title: "Testare tensiune gratuita",
      description: "Masurare gratuita a tensiunii arteriale in farmacie. Rezultatul este notat pe cardul personal de sanatate.",
      discount_type: "percent",
      discount_value: [100],
      conditions: "Disponibil zilnic in orarul farmaciei",
    },
    {
      title: "Protectie solara {V}% off",
      description: "Reducere la produsele de protectie solara pentru adulti si copii. SPF 30 si 50+ de la branduri de incredere.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Sezon estival, stoc limitat",
    },
    {
      title: "Ceaiuri medicinale {V}% reducere",
      description: "Gama completa de ceaiuri medicinale si infuzii naturiste. De la ceai de musetel la amestecuri specializate.",
      discount_type: "percent",
      discount_value: [10, 15, 20],
      conditions: "Gama completa de ceaiuri naturiste",
    },
    {
      title: "Card fidelitate {V}% extra reducere",
      description: "Beneficiezi de reducere suplimentara cu cardul de fidelitate al farmaciei. Cumulabil cu alte oferte in limita stocului.",
      discount_type: "percent",
      discount_value: [5, 8, 10],
      conditions: "Cu card de fidelitate activ",
    },
  ],
  "Veterinar": [
    {
      title: "Consult veterinar la {V} lei",
      description: "Consultatie veterinara completa cu examinare fizica detaliata. Include recomandari de tratament si reteta daca este necesar.",
      discount_type: "fixed",
      discount_value: [30, 50, 60],
      conditions: "Cu programare, caini si pisici",
    },
    {
      title: "Vaccinare {V}% off",
      description: "Reducere la schema completa de vaccinare pentru caini si pisici. Include carnet de vaccinari si consultatie.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Caini si pisici, cu programare",
    },
    {
      title: "Deparazitare la {V} lei",
      description: "Tratament complet de deparazitare interna si externa. Produse de calitate si dozare corecta in functie de greutate.",
      discount_type: "fixed",
      discount_value: [20, 30, 40],
      conditions: "Include tratament intern si extern",
    },
    {
      title: "Sterilizare {V}% reducere",
      description: "Interventie de sterilizare efectuata de chirurg veterinar cu experienta. Include anestezie, operatie si control post-operator.",
      discount_type: "percent",
      discount_value: [10, 15, 20],
      conditions: "Cu programare, include control postoperator",
    },
    {
      title: "Detartraj veterinar la {V} lei",
      description: "Curatare dentara profesionala pentru cainele sau pisica ta. Include anestezie usoara si control stomatologic.",
      discount_type: "fixed",
      discount_value: [80, 100, 120],
      conditions: "Cu programare, include anestezie",
    },
    {
      title: "Microcipare la {V} lei",
      description: "Implantare microcip de identificare conform legislatiei in vigoare. Include inregistrare in baza de date nationala.",
      discount_type: "fixed",
      discount_value: [40, 50, 60],
      conditions: "Include inregistrare, fara programare",
    },
    {
      title: "Pachet preventie {V}% off",
      description: "Pachet complet de prevenire: consult, vaccinare, deparazitare si microcipare. Tot ce are nevoie animalul tau de companie.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Pachet complet, cu programare",
    },
  ],
  "Stomatologie": [
    {
      title: "Detartraj + periaj {V} lei",
      description: "Sedinta completa de igiena dentara profesionala cu detartraj ultrasonic si periaj profesional. Rezultate imediate.",
      discount_type: "fixed",
      discount_value: [80, 100, 120],
      conditions: "Sedinta completa, durata 45 min",
    },
    {
      title: "Albire dentara {V}% off",
      description: "Albire dentara profesionala cu gel activat de lumina LED. Rezultate cu pana la 8 nuante mai alb intr-o singura sedinta.",
      discount_type: "percent",
      discount_value: [20, 25, 30],
      conditions: "Metoda profesionala, o singura sedinta",
    },
    {
      title: "Plomba estetica la {V} lei",
      description: "Obturatie estetica din compozit nano-hibrid cu aspect natural. Culoare adaptata perfect la dintele natural.",
      discount_type: "fixed",
      discount_value: [100, 120, 150],
      conditions: "Compozit premium, garantie 2 ani",
    },
    {
      title: "Consult + radiografie {V}% reducere",
      description: "Prima consultatie stomatologica cu radiografie panoramica digitala inclusa. Plan de tratament complet si transparent.",
      discount_type: "percent",
      discount_value: [30, 40, 50],
      conditions: "Prima vizita, include plan tratament",
    },
    {
      title: "Extractie dentara la {V} lei",
      description: "Extractie dentara simpla cu anestezie locala inclusa. Recomandari postextractie si control gratuit la 7 zile.",
      discount_type: "fixed",
      discount_value: [60, 80, 100],
      conditions: "Include anestezie si control",
    },
    {
      title: "Fatete dentare {V}% off",
      description: "Fatete dentare din ceramica pentru un zambet de Hollywood. Consultatie de planificare si simulare digitala incluse.",
      discount_type: "percent",
      discount_value: [10, 15, 20],
      conditions: "Minim 4 fatete, include planificare",
    },
    {
      title: "Implant dentar la {V} lei",
      description: "Implant dentar de calitate superioara cu bont protetic inclus. Garantie pe viata pentru implant, montare de catre specialist.",
      discount_type: "fixed",
      discount_value: [500, 600, 700],
      conditions: "Include bont, fara coroana",
    },
    {
      title: "Aparat dentar {V}% reducere",
      description: "Reducere la aparatul ortodontic fix sau mobil. Consultatie ortodontica si plan de tratament incluse in oferta.",
      discount_type: "percent",
      discount_value: [10, 15, 20],
      conditions: "Include consultatie si plan tratament",
    },
  ],
  "Florarie": [
    {
      title: "Buchet mixt la {V} lei",
      description: "Buchet de flori mixte proaspete de sezon, aranjat cu grija de floristii nostri. Ideal pentru orice ocazie.",
      discount_type: "fixed",
      discount_value: [40, 50, 60],
      conditions: "Flori de sezon, disponibilitate zilnica",
    },
    {
      title: "Aranjament {V}% off",
      description: "Reducere la aranjamente florale pentru evenimente: nunti, botezuri, aniversari si decoruri corporate.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Pentru evenimente, comanda cu 3 zile inainte",
    },
    {
      title: "Livrare gratuita peste {V} lei",
      description: "Beneficiezi de livrare gratuita in oras pentru comenzi peste valoarea specificata. Livrare in 2-4 ore de la comanda.",
      discount_type: "fixed",
      discount_value: [100, 120, 150],
      conditions: "In oras, livrare in 2-4 ore",
    },
    {
      title: "Plante de interior {V}% reducere",
      description: "Reducere la gama de plante de interior: monstera, ficus, suculente si cactusi. Ghivece decorative incluse.",
      discount_type: "percent",
      discount_value: [10, 15, 20],
      conditions: "Gama selectata, ghiveci inclus",
    },
    {
      title: "Abonament floral {V} lei/luna",
      description: "Abonament lunar de flori proaspete livrate la usa ta sau la birou. 4 buchete pe luna, flori de sezon.",
      discount_type: "fixed",
      discount_value: [100, 150, 200],
      conditions: "4 livrari/luna, flori de sezon",
    },
    {
      title: "Coronita funerara la {V} lei",
      description: "Coronite si aranjamente funerare realizate cu respect si bun gust. Livrare rapida si mesaj de condoleante inclus.",
      discount_type: "fixed",
      discount_value: [80, 100, 120],
      conditions: "Include panglica cu mesaj personalizat",
    },
    {
      title: "Cutie cu trandafiri la {V} lei",
      description: "Cutie eleganta cu trandafiri proaspeti in diverse culori. Cadoul perfect pentru persoane speciale.",
      discount_type: "fixed",
      discount_value: [120, 150, 200],
      conditions: "9 sau 15 trandafiri, culoare la alegere",
    },
  ],
  "Curatatorie": [
    {
      title: "Curatare costum la {V} lei",
      description: "Curatare chimica profesionala pentru costum barbatesc sau taior. Include calcare si ambalare pe umeras.",
      discount_type: "fixed",
      discount_value: [25, 30, 35],
      conditions: "2 piese (sacou + pantalon), pe umeras",
    },
    {
      title: "{V}% la curatare covoare",
      description: "Reducere la serviciul de curatare profesionala a covoarelor. Aspirare, spalare si uscare profesionala.",
      discount_type: "percent",
      discount_value: [20, 25, 30],
      conditions: "Minim 2 mp, ridicare de la domiciliu",
    },
    {
      title: "Spalare haine {V}% off",
      description: "Reducere la serviciul de spalare si calcare a hainelor de zi cu zi. Predare curata si calcata in 24-48 ore.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Minim 3 kg, livrare in 48h",
    },
    {
      title: "Curatare canapea la {V} lei",
      description: "Serviciu de curatare profesionala a canapelei la domiciliu. Include aspirare, tratare pete si dezinfectare.",
      discount_type: "fixed",
      discount_value: [80, 100, 120],
      conditions: "Cu deplasare la domiciliu inclusa",
    },
    {
      title: "Curatare perdele {V}% off",
      description: "Serviciu complet de curatare si calcare perdele. Ridicare, curatare profesionala si montare la loc incluse.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Include ridicare si montare",
    },
    {
      title: "Rochie de mireasa la {V} lei",
      description: "Curatare profesionala si conservare rochie de mireasa. Tratament special pentru tesaturi delicate si aplicatii.",
      discount_type: "fixed",
      discount_value: [100, 150, 200],
      conditions: "Include ambalare speciala",
    },
    {
      title: "Curatare tapiterie auto {V}% off",
      description: "Curatare profesionala a tapiteriei auto: scaune, bancheta, plafon si covoras. Aspect ca nou si miros proaspat.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Programare la sediu sau deplasare",
    },
  ],
  "Foto & Video": [
    {
      title: "Sedinta foto portret {V} lei",
      description: "Sedinta foto de portret in studio cu iluminare profesionala. Include 30 minute de fotografiere si 10 poze editate.",
      discount_type: "fixed",
      discount_value: [100, 150, 200],
      conditions: "30 minute + 10 poze editate",
    },
    {
      title: "Fotografie eveniment {V}% off",
      description: "Reducere la pachetele de fotografie pentru evenimente: nunti, botezuri, petreceri corporate si aniversari.",
      discount_type: "percent",
      discount_value: [10, 15, 20],
      conditions: "Minim 3 ore de fotografiere",
    },
    {
      title: "Video promo {V} lei",
      description: "Clip video promotional de 1 minut complet editat. Include filmare, montaj, color grading si muzica de fundal.",
      discount_type: "fixed",
      discount_value: [300, 400, 500],
      conditions: "1 minut editat, include filmare",
    },
    {
      title: "Poze buletin/pasaport {V} lei",
      description: "Fotografii pentru acte oficiale: buletin, pasaport, permis de conducere. Gata in 10 minute, conform standardelor.",
      discount_type: "fixed",
      discount_value: [15, 20, 25],
      conditions: "Gata in 10 min, 4 bucati",
    },
    {
      title: "Pachet nunta {V}% off",
      description: "Pachet complet foto-video pentru nunta: toata ziua, album premium, clip cinematografic si poze editate profesional.",
      discount_type: "percent",
      discount_value: [10, 15, 20],
      conditions: "Toata ziua, album + clip incluse",
    },
    {
      title: "Sedinta foto produs la {V} lei",
      description: "Fotografie profesionala de produs pentru cataloage online si e-commerce. Include 10 produse fotografiate pe fundal alb.",
      discount_type: "fixed",
      discount_value: [200, 250, 300],
      conditions: "10 produse, fundal alb, editare inclusa",
    },
    {
      title: "Fotografie corporativa {V}% off",
      description: "Sedinta foto corporativa pentru echipa ta: portrete profesionale individuale si foto de grup. Ideal pentru site si LinkedIn.",
      discount_type: "percent",
      discount_value: [15, 20, 25],
      conditions: "Minim 5 persoane, in studio sau la sediu",
    },
    {
      title: "Drona aeriana {V} lei/ora",
      description: "Filmare si fotografie aeriana cu drona profesionala 4K. Ideal pentru imobiliare, evenimente si continut de marketing.",
      discount_type: "fixed",
      discount_value: [200, 300, 400],
      conditions: "Minim 1 ora, editare de baza inclusa",
    },
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

function generateLogoUrl(businessName, categoryName) {
  const style = LOGO_STYLES[categoryName] || "shapes";
  const seed = encodeURIComponent(businessName);
  return `https://api.dicebear.com/9.x/${style}/png?seed=${seed}&size=400`;
}

function generateCoverUrl(categoryName, index) {
  return `https://picsum.photos/seed/${slugify(categoryName)}-${index}/1200/600`;
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
    console.log(`Target: ${CITIES.length} cities x ${CATEGORIES.length} categories x 2 = ${CITIES.length * CATEGORIES.length * 2} businesses\n`);

    await client.query("BEGIN");

    // ── 1. Insert categorii ───────────────────────────────
    console.log("Inserting categories...");
    const categoryMap = {}; // name -> id

    for (const catName of CATEGORIES) {
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
    console.log(`  ${Object.keys(categoryMap).length} categories ready`);

    // ── 2. Insert orase ───────────────────────────────────
    console.log("Inserting cities...");
    const cityMap = {}; // name -> { id, lat, lng, radius }

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
    console.log(`  ${Object.keys(cityMap).length} cities ready\n`);

    // ── 3. Generate business-uri (15 cities x 15 categories x 2) ──
    console.log("Generating 450 businesses...");

    const usedNames = new Set();
    const businessRecords = []; // { id, categoryName, cityName, name }
    let batchCount = 0;
    let totalLocations = 0;
    let totalOffers = 0;
    let bizIndex = 0;

    for (const city of CITIES) {
      const cityData = cityMap[city.name];

      for (const categoryName of CATEGORIES) {
        const names = BUSINESS_NAMES[categoryName];
        const descriptions = DESCRIPTIONS[categoryName];

        for (let i = 0; i < 2; i++) {
          // ── Generate unique business name ──
          let name;
          let attempts = 0;
          do {
            const baseName = names[(bizIndex + attempts) % names.length];
            const suffix = SUFFIXES[(bizIndex + i + attempts) % SUFFIXES.length];
            name = `${baseName}${suffix}`;
            if (usedNames.has(name) && attempts > 5) {
              name = `${baseName} ${city.name}${suffix}`;
            }
            attempts++;
          } while (usedNames.has(name) && attempts < 30);

          if (usedNames.has(name)) {
            name = `${name} ${bizIndex}`;
          }
          usedNames.add(name);

          // ── Address ──
          const street = STREETS[bizIndex % STREETS.length];
          const streetNr = randomInt(1, 150);
          const address = `${street} ${streetNr}, ${city.name}`;

          // ── Coordinates ──
          const lat = parseFloat(randomCoord(cityData.lat, cityData.radius).toFixed(6));
          const lng = parseFloat(randomCoord(cityData.lng, cityData.radius).toFixed(6));

          // ── Phone & Website ──
          const phone = generatePhone();
          const website = `https://${slugify(name)}.ro`;

          // ── Description ──
          const description = descriptions[bizIndex % descriptions.length];

          // ── Logo & Cover ──
          const logoUrl = generateLogoUrl(name, categoryName);
          const coverUrl = generateCoverUrl(categoryName, bizIndex);

          // ── Booking ──
          const bookingData = generateBookingData(categoryName, phone, name);

          // ── INSERT BUSINESS ──
          const bizResult = await client.query(
            `INSERT INTO businesses
              (name, description, address, phone, website, lat, lng, city_id, category_id,
               logo_url, cover_image_url, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             RETURNING id`,
            [
              name, description, address, phone, website, lat, lng,
              cityData.id, categoryMap[categoryName],
              logoUrl, coverUrl,
              bookingData.type, bookingData.phone, bookingData.whatsapp, bookingData.url, bookingData.instructions,
            ]
          );

          const businessId = bizResult.rows[0].id;

          businessRecords.push({
            id: businessId,
            categoryName,
            cityName: city.name,
            name,
          });

          // ── INSERT LOCATION 1 (main, same as business) ──
          await client.query(
            `INSERT INTO business_locations
              (business_id, city_id, address, lat, lng, phone, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              businessId, cityData.id, address, lat, lng, phone,
              bookingData.type, bookingData.phone, bookingData.whatsapp, bookingData.url, bookingData.instructions,
            ]
          );
          totalLocations++;

          // ── INSERT LOCATION 2 (optional, ~50% chance) ──
          if (Math.random() < 0.5) {
            const street2 = STREETS[(bizIndex + 7) % STREETS.length];
            const streetNr2 = randomInt(1, 150);
            const address2 = `${street2} ${streetNr2}, ${city.name}`;
            const lat2 = parseFloat(randomCoord(cityData.lat, cityData.radius).toFixed(6));
            const lng2 = parseFloat(randomCoord(cityData.lng, cityData.radius).toFixed(6));
            const phone2 = generatePhone();
            const bookingData2 = generateBookingData(categoryName, phone2, name);

            await client.query(
              `INSERT INTO business_locations
                (business_id, city_id, address, lat, lng, phone, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                businessId, cityData.id, address2, lat2, lng2, phone2,
                bookingData2.type, bookingData2.phone, bookingData2.whatsapp, bookingData2.url, bookingData2.instructions,
              ]
            );
            totalLocations++;
          }

          // ── INSERT 2-3 OFFERS ──
          const templates = OFFER_TEMPLATES[categoryName];
          const numOffers = randomInt(2, 3);
          const shuffled = [...templates].sort(() => Math.random() - 0.5);
          const selectedOffers = shuffled.slice(0, numOffers);

          for (const tpl of selectedOffers) {
            // Discount value
            let discountValue;
            if (Array.isArray(tpl.discount_value)) {
              discountValue = randomFrom(tpl.discount_value);
            } else {
              discountValue = tpl.discount_value;
            }

            // Title with value substituted
            const title = tpl.title.replace("{V}", discountValue);

            // Dates: start = random within last 15 days, end = 30-90 days from now
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - randomInt(0, 15));
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + randomInt(30, 90));

            // Offer booking: 70% inherit, 30% own
            let offerBookingType, offerBookingPhone, offerBookingWhatsapp, offerBookingUrl, offerBookingInstructions;
            if (Math.random() < 0.7) {
              offerBookingType = "inherit";
              offerBookingPhone = null;
              offerBookingWhatsapp = null;
              offerBookingUrl = null;
              offerBookingInstructions = null;
            } else {
              const offerBooking = generateBookingData(categoryName, phone, name);
              offerBookingType = offerBooking.type;
              offerBookingPhone = offerBooking.phone;
              offerBookingWhatsapp = offerBooking.whatsapp;
              offerBookingUrl = offerBooking.url;
              offerBookingInstructions = offerBooking.instructions;
            }

            await client.query(
              `INSERT INTO offers
                (business_id, title, description, discount_type, discount_value,
                 conditions, start_date, end_date, is_active,
                 booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
              [
                businessId,
                title,
                tpl.description,
                tpl.discount_type,
                discountValue,
                tpl.conditions,
                startDate.toISOString().split("T")[0],
                endDate.toISOString().split("T")[0],
                true,
                offerBookingType,
                offerBookingPhone,
                offerBookingWhatsapp,
                offerBookingUrl,
                offerBookingInstructions,
              ]
            );
            totalOffers++;
          }

          batchCount++;
          bizIndex++;

          if (batchCount % 50 === 0) {
            console.log(`  ${batchCount}/450 businesses inserted...`);
          }
        }
      }
    }
    console.log(`  ${businessRecords.length} businesses inserted!`);
    console.log(`  ${totalLocations} locations inserted!`);
    console.log(`  ${totalOffers} offers inserted!\n`);

    // ── 4. Commit ─────────────────────────────────────────
    await client.query("COMMIT");

    // ── 5. Summary ────────────────────────────────────────
    console.log("===================================================");
    console.log("SEED COMPLETE!");
    console.log("===================================================");
    console.log(`  Categories: ${CATEGORIES.length}`);
    console.log(`  Cities:     ${CITIES.length}`);
    console.log(`  Businesses: ${businessRecords.length}`);
    console.log(`  Locations:  ${totalLocations}`);
    console.log(`  Offers:     ${totalOffers}`);
    console.log("===================================================");

    // ── Distribution by city ──
    console.log("\nDistribution by city:");
    const cityCounts = {};
    for (const biz of businessRecords) {
      cityCounts[biz.cityName] = (cityCounts[biz.cityName] || 0) + 1;
    }
    for (const [cityName, count] of Object.entries(cityCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cityName}: ${count}`);
    }

    // ── Distribution by category ──
    console.log("\nDistribution by category:");
    const catCounts = {};
    for (const biz of businessRecords) {
      catCounts[biz.categoryName] = (catCounts[biz.categoryName] || 0) + 1;
    }
    for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cat}: ${count}`);
    }

    // ── Verify 2-per-pair guarantee ──
    console.log("\nVerifying 2-per-pair guarantee...");
    const pairCounts = {};
    for (const biz of businessRecords) {
      const key = `${biz.cityName} | ${biz.categoryName}`;
      pairCounts[key] = (pairCounts[key] || 0) + 1;
    }
    let allPairsOk = true;
    for (const [pair, count] of Object.entries(pairCounts)) {
      if (count !== 2) {
        console.log(`  WARNING: ${pair} has ${count} businesses (expected 2)`);
        allPairsOk = false;
      }
    }
    if (allPairsOk) {
      console.log(`  All ${Object.keys(pairCounts).length} city/category pairs have exactly 2 businesses.`);
    }

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
    console.log("\nDone! You can now start the server.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nFatal error:", err.message);
    process.exit(1);
  });
