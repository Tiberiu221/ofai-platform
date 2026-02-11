/**
 * Seed script: Populeaza baza de date cu review-uri realiste in romana
 *
 * Genereaza 3-7 review-uri per business, contextuale per categorie,
 * cu mix de pozitive (50%), neutre (20%) si negative (30%).
 *
 * Rulare: node scripts/seed-reviews.js
 * Re-seed: node scripts/seed-reviews.js --force
 */

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 5,
  statement_timeout: 60000,
});

// ─── HELPERS ──────────────────────────────────────────────────

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRating() {
  const r = Math.random();
  if (r < 0.25) return 5;
  if (r < 0.50) return 4;
  if (r < 0.70) return 3;
  if (r < 0.85) return 2;
  return 1;
}

function getSentiment(rating) {
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return "negative";
}

function randomDate(daysAgoMin, daysAgoMax) {
  const now = Date.now();
  const daysAgo = randomInt(daysAgoMin, daysAgoMax);
  const d = new Date(now - daysAgo * 86400000);
  d.setHours(randomInt(8, 22), randomInt(0, 59), randomInt(0, 59), 0);
  return d;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── REVIEW TEMPLATES PER CATEGORIE ───────────────────────────

const REVIEW_TEMPLATES = {
  "Clinica": {
    positive: [
      "Medici foarte competenti, m-au tratat cu respect si profesionalism. Recomand!",
      "Am facut un set complet de analize si am primit rezultatele in aceeasi zi. Super rapid.",
      "Doctorul a fost foarte atent, mi-a explicat totul in detaliu. Ma simt in siguranta aici.",
      "Clinica curata, personal amabil. Am fost placut surprins de calitatea serviciilor.",
      "Programarea online functioneaza perfect, nu am stat deloc la coada.",
      "Am venit pentru un control de rutina si am plecat multumit. Preturile sunt corecte.",
      "Personalul de la receptie e foarte dragut si te ajuta cu orice. Atmosfera placuta.",
      "Revin de fiecare data cand am nevoie, nu m-au dezamagit niciodata.",
      "Cel mai bun medic de familie pe care l-am avut. Atent, rabdator si priceput.",
      "Ecografia a fost facuta de un specialist excelent. Totul a decurs foarte bine.",
    ],
    neutral: [
      "E ok, nimic special. Am asteptat cam 20 de minute peste programare.",
      "Medicul a fost bun, dar receptia lasa de dorit. Putina dezorganizare.",
      "Preturile sunt cam mari fata de alte clinici din zona, dar serviciile sunt decente.",
      "Am primit tratamentul potrivit, insa atmosfera e cam rece.",
      "Rezultatele au venit repede, dar nu mi-au explicat prea bine ce inseamna.",
    ],
    negative: [
      "Am asteptat o ora si jumatate pentru o consultatie de 10 minute. Nu recomand.",
      "Preturile sunt exagerate si nici macar nu iti explica ce fac. Dezamagitor.",
      "Personalul de la receptie a fost nepoliticos, mi-au dat impresia ca ii deranjez.",
      "Am venit cu programare si tot am asteptat. Organizarea e proasta.",
      "Nu mi-au rezolvat problema, m-au trimis la alt medic. Pierdere de timp si bani.",
    ],
  },

  "Frizerie": {
    positive: [
      "Tunsoare perfecta, exact cum am cerut! Baiatul e foarte priceput.",
      "Cel mai bun barbershop din oras, vin aici de 2 ani si sunt mereu multumit.",
      "Atmosfera super, muzica buna, cafea gratis. Si tunsoarea e pe masura.",
      "M-a tuns si m-a aranjat la barba in 30 de minute. Rezultat impecabil.",
      "Am incercat mai multe frizerii, dar aici e altceva. Calitate si pret bun.",
      "Fade-ul a iesit perfect, exact ca in poza pe care am aratat-o. Top!",
      "Recomand cu incredere, sunt profesionisti si foarte atenti la detalii.",
      "Prima data cand am venit si deja stiu ca o sa revin. Super experienta.",
      "Barba sculptata ca la carte. Foarte multumit de rezultat.",
      "Vin cu fii-meu de fiecare data, are rabdare si cu copiii. Bravo!",
    ],
    neutral: [
      "Atmosfera placuta, dar a durat cam mult. Tunsoarea in sine e ok.",
      "E decent, nu cel mai bun dar nici rau. Pretul e ok pentru ce ofera.",
      "Tunsoarea a iesit bine, dar am asteptat 40 de minute fara programare.",
      "Barbierul e tanar si incearca, dar inca mai are de invatat la contur.",
      "Ok ca experienta, dar nu as zice ca merita pretul premium pe care il cer.",
    ],
    negative: [
      "M-a tuns complet diferit de ce am cerut. Nu mai vin.",
      "Am asteptat o ora fara programare si cand a venit randul meu s-a grabit enorm.",
      "Preturile mari pentru o tunsoare mediocra. Sunt frizerii mai bune si mai ieftine.",
      "Mi-a taiat barba stramb si a zis ca e ok asa. Nu e ok deloc.",
      "Produsele pe care le folosesc miros ciudat si m-a mancat scalpul dupa.",
    ],
  },

  "Beauty": {
    positive: [
      "Manichiura semipermanenta rezista deja de 3 saptamani! Super calitate.",
      "Genele arata natural si sunt foarte usoare, nici nu le simt. Recomand!",
      "Fata mea a stralucit dupa tratamentul facial. O sa revin lunar.",
      "Cele mai frumoase unghii pe care le-am avut vreodata. Merita fiecare leu!",
      "Epilarea cu laser a fost rapida si aproape fara durere. Recomand.",
      "Atmosfera relaxanta, personal prietenos si rezultate vizibile.",
      "Am facut microblading si arata incredibil. Sprancenele mele in sfarsit arata bine.",
      "Pedichiura spa a fost o experienta de vis. Ma simt ca dupa vacanta.",
      "Fetele sunt super talentate, fac arta pe unghii. Mereu primesc complimente.",
      "Salonul e impecabil, curat si organizat. Se vede ca le pasa.",
    ],
    neutral: [
      "Manichiura e frumoasa, dar pretul e cam piperat. Exista optiuni mai accesibile.",
      "Rezultatul e ok, dar am asteptat 30 min pana a venit randul meu.",
      "Tratamentul facial a fost relaxant, dar nu am vazut diferente majore pe piele.",
      "Epilarea a durut mai mult decat ma asteptam, dar rezultatul e bun.",
      "Salonul e frumos amenajat, dar personalul pare cam grabit uneori.",
    ],
    negative: [
      "Manichiura s-a cojit dupa 3 zile. Pentru pretul asta ma asteptam la mai mult.",
      "Mi-au ars pielea la epilare si nici nu si-au cerut scuze. Nu revin.",
      "Am cerut un model simplu si a iesit complet altceva. Comunicare zero.",
      "Programarea la ora 14 si m-au luat la 15. Zero respect pentru timpul clientului.",
      "Produsele par ieftine, desi preturile sunt de salon de lux. Dezamagita.",
    ],
  },

  "Auto": {
    positive: [
      "Mi-au rezolvat problema la motor rapid si la un pret corect. Revin cu incredere.",
      "Cel mai serios service din zona. Transparenti cu preturile, nu inventeaza defectiuni.",
      "Am facut revizia completa si masina merge ca noua. Foarte multumit.",
      "M-au sunat cand au gasit o problema suplimentara si mi-au cerut acordul inainte. Profesionisti!",
      "Schimb de ulei si filtru in 30 de minute, fara programare. Rapid si eficient.",
      "Am venit cu o problema de frane si au reparat-o pe loc. Pret corect.",
      "Diagnosticarea computerizata a identificat exact problema. Mecanicii stiu ce fac.",
      "Geometria rotilor facuta impecabil, masina nu mai trage. Multumesc!",
      "Recomand service-ul asta tuturor prietenilor. Seriosi si corecti.",
      "Mi-au dat masina de inlocuire cat timp a fost a mea in service. Serviciu premium.",
    ],
    neutral: [
      "Au reparat ce trebuia, dar a durat o zi intreaga. Puteau sa fie mai rapizi.",
      "Preturile sunt ok, nu cele mai mici dar nici exagerate. Lucrarea e decenta.",
      "Am fost multumit de reparatie, dar parcarea e mica si greu accesibila.",
      "Mecanicul a fost bun, dar receptia nu stia sa-mi spuna exact cand e gata.",
      "Service-ul in sine e bun, dar locatia e greu de gasit.",
    ],
    negative: [
      "Au zis ca e gata in 2 ore, am asteptat toata ziua. Zero respect pentru programare.",
      "Mi-au cerut un pret si la final factura a fost cu 40% mai mare. Neseriosi.",
      "Dupa reparatie aceeasi problema a aparut din nou dupa o saptamana. Bani aruncati.",
      "Mi-au stricat un senzor cand au reparat altceva si au zis ca nu ei sunt de vina.",
      "Cel mai slab service la care am fost. Nu stiu ce fac si se vede.",
    ],
  },

  "Restaurant": {
    positive: [
      "Mancarea a fost excelenta, recomand! Ciorbita de burta ca la mama acasa.",
      "Ambient superb, mancare delicioasa si personalul foarte atent. Seara perfecta.",
      "Am venit cu toata familia si am fost toti incantati. Portiile sunt generoase.",
      "Cel mai bun gratar din oras, fara discutie. Si vinul e foarte bine ales.",
      "Desertul de casa e fenomenal, merita drumul doar pentru el.",
      "Am comandat meniul zilei si a fost o surpriza placuta. Pret mic, calitate mare.",
      "Chelnerul ne-a recomandat un vin perfect pentru mancare. Serviciu de nota 10.",
      "Locatie frumoasa cu terasa in gradina. Mancarea e pe masura ambientului.",
      "Paste proaspete, facute in casa. Se simte ca gatesc cu pasiune.",
      "Am facut rezervare pentru aniversare si ne-au pregatit o masa speciala. Superbi!",
    ],
    neutral: [
      "Mancarea e buna, dar preturile sunt cam mari pentru ce ofera.",
      "Serviciul a fost lent, am asteptat 40 de minute pana a venit mancarea.",
      "Locatia e frumoasa, dar meniul e cam limitat. Am vrut peste si nu aveau.",
      "Mancarea ok, nimic wow. Pentru pretul platit ma asteptam la ceva special.",
      "Portiile sunt cam mici. Am plecat cu pofta de mai mult.",
    ],
    negative: [
      "Preturile sunt prea mari pentru ce ofera. Am platit 200 lei pe o masa mediocra.",
      "Chelnerul a fost arogant si ne-a adus comanda gresita. Am cerut nota si am plecat.",
      "Mancarea a fost rece si gustul lasa mult de dorit. Nu revin niciodata.",
      "Am gasit un par in mancare si cand am reclamat au ridicat din umeri. Rusinos.",
      "Toaleta era murdara, deci nici nu vreau sa stiu cum arata bucataria.",
    ],
  },

  "Cafenea": {
    positive: [
      "Cea mai buna cafea din oras, hands down. Vin aici in fiecare dimineata.",
      "Latte-ul cu vanilie e divin si cheesecake-ul e fenomenal. Locul meu preferat!",
      "Atmosfera super cozy, perfect pentru lucru la laptop. Si wifi-ul merge bine.",
      "Baristii sunt pasionati si se vede. Ti-o fac cu latte art si tot.",
      "Am descoperit aceasta cafenea recent si deja e locul meu de suflet.",
      "Cappuccino-ul e cel mai bun pe care l-am baut in Romania. Serios.",
      "Prajitura de morcovi e facuta in casa si e absolut delicioasa.",
      "Cold brew-ul lor pe timp de vara e salvarea mea. Fresh si aromat.",
      "Locatia e centrala, personalul e prietenos si cafeaua e perfecta.",
      "Am incercat abonamentul lunar si e cea mai buna investitie.",
    ],
    neutral: [
      "Cafeaua e buna, dar cam scumpa. 18 lei un cappuccino e cam mult.",
      "Atmosfera placuta, dar e mereu aglomerat si greu de gasit loc.",
      "Cafeaua e decenta, nimic spectaculos. Am baut mai bune in alte cafenele.",
      "Personalul e ok, dar nu prea zambesc. Ar putea fi mai calzi.",
      "Prajituriile sunt ok, dar nu proaspete mereu. Depinde de zi.",
    ],
    negative: [
      "Am asteptat 15 minute pentru un espresso simplu. Prea mult.",
      "Cafeaua era arsa si cand am cerut sa o refaca s-au uitat urat la mine.",
      "Preturile sunt exagerate pentru calitatea oferita. Nu merita.",
      "Wi-fi-ul nu merge niciodata bine, desi se promoveaza ca loc de lucru.",
      "Am comandat un latte si era mai mult lapte decat cafea. Dezamagitor.",
    ],
  },

  "Fitness": {
    positive: [
      "Sala e super dotata, aparate noi si spatiu suficient. Mersi ca existati!",
      "Antrenorul personal m-a ajutat enorm, am slabit 10 kg in 3 luni.",
      "Clasele de grup sunt geniale, mai ales HIIT-ul de sambata dimineata.",
      "Curatatenie impecabila, vestiare curate si dusuri cu apa calda. Top!",
      "Programul e foarte flexibil, pot veni si la 6 dimineata. Perfect pentru mine.",
      "Pretul abonamentului e corect pentru ce ofera. Cel mai bun raport calitate-pret.",
      "Comunitatea e super, toata lumea te motiveaza. M-am simtit binevenit din prima zi.",
      "Au adaugat zona de functional training si e genial. Spatiu mare si echipat.",
      "Vin de un an si sunt foarte multumit. Rezultatele se vad!",
      "Personalul e mereu zambitor si te ajuta daca ai nevoie.",
    ],
    neutral: [
      "Sala e ok, dar in orele de varf e foarte aglomerat si astepti la aparate.",
      "Abonamentul e decent ca pret, dar nu au aer conditionat in zona de forta.",
      "Aparatele sunt bune, dar unele au nevoie de intretinere. Cablurile scartaie.",
      "Vestiare ok, dar dulapurile sunt mici. Greu de incaput geanta de sport.",
      "Clasele de yoga sunt bune, dar programul e limitat.",
    ],
    negative: [
      "Aparatele sunt vechi si unele stricate de luni de zile. Nu le repara nimeni.",
      "Am platit abonamentul anual si dupa 2 luni au marit pretul. Neseriosi.",
      "E prea aglomerat seara, nu poti face nimic. Bani dati degeaba.",
      "Dusurile sunt mizere si nu au apa calda deseori. Inacceptabil.",
      "Muzica e prea tare si nu poti vorbi cu nimeni. Durere de cap garantata.",
    ],
  },

  "Spa & Wellness": {
    positive: [
      "Masajul de relaxare a fost divin. Am iesit ca noua. O sa revin sigur!",
      "Cel mai frumos spa din oras. Sauna, jacuzzi, totul e impecabil.",
      "Am facut pachetul spa complet si a fost cea mai buna zi din luna asta.",
      "Terapeuta stie exact unde ai tensiuni. Masaj terapeutic de nota 10.",
      "Am oferit cadou pachetul spa pentru cuplu si a fost un succes total.",
      "Ritualul de detox m-a lasat cu o senzatie incredibila. Mersi!",
      "Ambianta e perfecta, muzica relaxanta si aromele sunt divine.",
      "Personalul e discret si profesionist. Te simti ca intr-un resort de lux.",
      "Zona de relaxare cu ceai si fructe e un bonus super. Atentie la detalii.",
      "Am facut abonament lunar si este cea mai buna investitie in sanatatea mea.",
    ],
    neutral: [
      "Masajul a fost bun, dar camera era cam rece. Ar fi putut fi mai confortabil.",
      "Preturile sunt pe masura, dar nu e nimic extraordinar.",
      "Sauna e mica si cand e aglomerat nu prea poti sta confortabil.",
      "Experienta ok, dar halatul era cam uzat. La pretul asta ma asteptam la mai mult.",
      "Jacuzzi-ul era ok, dar apa nu era suficient de calda.",
    ],
    negative: [
      "Am platit 250 lei si m-am simtit dezamagit. Nu merita pretul.",
      "Masajul a fost superficial, terapeuta parea grabita sa termine repede.",
      "Am facut programare si cand am ajuns mi-au spus ca nu au loc. Neseriosi.",
      "Igiena lasa de dorit, prosoapele nu pareau proaspete. Nu recomand.",
      "Zero relaxare, muzica prea tare si personalul vorbea intre ei tot timpul.",
    ],
  },

  "Optica": {
    positive: [
      "Consultatie rapida si precisa. Lentilele sunt exact ce aveam nevoie.",
      "Gama de rame e impresionanta, am gasit exact ce cautam. Super preturi.",
      "Personalul m-a ajutat sa aleg ramele perfecte pentru forma fetei mele.",
      "Am primit ochelarii in aceeasi zi! Rapid si calitate excelenta.",
      "Lentilele progresive sunt foarte bune, m-am obisnuit imediat cu ele.",
      "Cel mai bun optician la care am fost. Profesionalism si grija pentru client.",
      "Am luat si ochelari de soare cu dioptrii la un pret foarte bun.",
      "Consultul oftalmologic a fost detaliat si medicul mi-a explicat totul.",
      "Ramele sunt de calitate si pretul e corect. Recomand cu placere.",
      "Serviciul post-vanzare e excelent, mi-au ajustat ochelarii gratuit.",
    ],
    neutral: [
      "Ochelarii sunt ok, dar au durat 2 saptamani sa fie gata. Cam mult.",
      "Gama de rame e buna, dar preturile sunt mai mari decat la alte optici.",
      "Consultul a fost ok, dar medicul parea cam grabit.",
      "Lentilele de contact sunt bune, dar nu au avut marca pe care o voiam.",
      "Serviciul e decent, nimic iesit din comun.",
    ],
    negative: [
      "Ochelarii s-au rupt dupa o luna si nu au vrut sa-i schimbe pe garantie.",
      "Lentilele nu au fost montate corect, vedeam dublu. Am trebuit sa revin de 3 ori.",
      "Preturile sunt umflate si nu negociaza deloc. Gasesti mai ieftin online.",
      "Consultul a fost superficial, 5 minute si gata. Am platit 70 lei pe nimic.",
      "Am comandat rame si au venit cu zgarieturi. Cand am reclamat, nu au rezolvat.",
    ],
  },

  "Farmacie": {
    positive: [
      "Farmacista m-a consiliat foarte bine, mi-a recomandat exact ce aveam nevoie.",
      "Au mereu toate medicamentele in stoc. Nu m-au trimis niciodata in alta parte.",
      "Preturi bune si promotii frecvente la vitamine. Vin aici de ani de zile.",
      "Personalul e amabil si rabdator, iti explica cum sa iei medicamentele.",
      "Gama de produse dermato-cosmetice e impresionanta. Gasesti tot ce cauti.",
      "Farmacia e deschisa si duminica, foarte util in cazuri de urgenta.",
      "Am comandat un produs si l-au adus in 2 zile. Serviciu rapid.",
      "Cardul de fidelitate merita, aduni puncte repede si primesti reduceri.",
      "Curata, organizata si cu personal competent. Farmacia mea de suflet.",
      "M-au ajutat sa gasesc alternative mai ieftine la medicamentele prescrise.",
    ],
    neutral: [
      "Farmacia e ok, dar uneori e coada mare si astepti mult.",
      "Au medicamente de baza, dar pentru chestii mai rare te trimit in alta parte.",
      "Preturile sunt ca peste tot, nici mai mari nici mai mici.",
      "Personalul e ok, dar nu prea au timp sa te consilieze cand e aglomerat.",
      "E aproape de casa, asta e principalul avantaj. In rest, nimic special.",
    ],
    negative: [
      "Nu aveau medicamentul de care aveam nevoie si nici nu s-au oferit sa-l comande.",
      "Farmacista a fost nepoliticoasa si s-a uitat urat cand am intrebat ceva.",
      "Preturile la produsele dermato-cosmetice sunt mult mai mari decat online.",
      "Am primit un produs expirat si cand am revenit nu au vrut sa-l schimbe.",
      "Programul e scurt, se inchid la 18. Cand ajung de la munca e deja inchis.",
    ],
  },

  "Veterinar": {
    positive: [
      "Veterinarul e minunat cu animalele, pisica mea se simte in siguranta aici.",
      "Au tratat catelul nostru cu multa grija. Il adora, merge cu placere.",
      "Consultatie detaliata, pret corect si medic foarte priceput. Recomand!",
      "Urgenta la 11 noaptea si au raspuns imediat. Salvatorii catelului meu.",
      "Vaccinarea a decurs perfect, fara stres pentru animal. Profesionisti!",
      "Au laborator propriu si am primit rezultatele in aceeasi zi. Super.",
      "Pisicuta mea a fost operata si s-a recuperat perfect. Multumim mult!",
      "Consilierea nutritionala a fost foarte utila, cainele nostru e mult mai sanatos.",
      "Personalul e plin de dragoste pentru animale, se vede din prima clipa.",
      "Cel mai bun veterinar din oras. Vin cu ambii caini de 3 ani.",
    ],
    neutral: [
      "Clinica e ok, dar preturile sunt cam mari comparativ cu alte cabinete.",
      "Veterinarul e bun, dar timpul de asteptare e lung, chiar si cu programare.",
      "Serviciile sunt decente, dar ar putea sa fie mai calzi cu animalele speriate.",
      "Am fost pentru deparazitare, a fost rapid dar cam impersonal.",
      "E ok ca locatie, dar parcarea e o problema.",
    ],
    negative: [
      "Au gresit diagnosticul si am pierdut timp si bani. Am mers la alt veterinar.",
      "Preturile sunt exagerate. 150 lei o consultatie simpla e prea mult.",
      "Cainele meu a fost stresat tot timpul vizitei, personalul nu a stiut sa-l calmeze.",
      "Am asteptat o ora cu pisica bolnava si nimeni nu ne-a bagat in seama.",
      "Dupa operatie nu ne-au dat instructiuni clare de ingrijire. Am sunat de 5 ori.",
    ],
  },

  "Stomatologie": {
    positive: [
      "Dentistul e foarte bun si deloc dureros. Prima data cand nu m-am temut.",
      "Albirea dentara a fost spectaculoasa, diferenta de 6 nuante! Sunt incantata.",
      "Am facut implant si totul a decurs perfect. Profesionalism de top.",
      "Cabinetul e modern, curat si echipat cu tot ce trebuie. Recomand.",
      "Detartrajul a fost rapid si fara durere. Dintii stralucesc!",
      "Doctorul mi-a explicat fiecare pas al tratamentului. M-am simtit in siguranta.",
      "Plomba estetica e invizibila, nu se vede diferenta. Lucru de maestru!",
      "Am facut ortodontie aici si rezultatul e perfect. Mersi, doctore!",
      "Programarile sunt respectate, nu am asteptat niciodata. Rar gasesti asa ceva.",
      "Cel mai bun cabinet stomatologic din oras. Vin cu toata familia.",
    ],
    neutral: [
      "Cabinetul e bun, dar preturile sunt peste medie. Nu toti isi permit.",
      "Tratamentul a fost ok, dar au fost niste dureri dupa.",
      "Doctorul e competent, dar un pic cam rece ca atitudine.",
      "Am facut o plomba si e ok, dar a durat 2 sedinte.",
      "Cabinetul e ok, dar locatia e greu de gasit si parcarea e imposibila.",
    ],
    negative: [
      "Plomba a cazut dupa 2 saptamani si cand am sunat au zis ca nu e vina lor.",
      "M-a durut enorm in timpul procedurii si doctorul a zis ca e normal. Nu e normal.",
      "Preturile sunt astronomice si nu le spun dinainte. Factura a fost dubla.",
      "Cel mai rau dentist la care am fost. Zero empatie, zero explicatii.",
      "Anestezia nu a functionat si au continuat oricum. Experienta traumatizanta.",
    ],
  },

  "Florarie": {
    positive: [
      "Buchetul a fost superb, exact cum l-am cerut. Florile erau proaspete!",
      "Am comandat online si livrarea a venit in 2 ore. Flori frumoase si ambalaj elegant.",
      "Aranjamentul pentru nunta a fost de vis. Multumim din suflet!",
      "Florile au rezistat aproape 2 saptamani. Calitate excelenta!",
      "Personalul e foarte creativ, fac buchete unice si originale.",
      "Am luat plante de interior si au venit cu instructiuni detaliate de ingrijire.",
      "Cutia cu trandafiri a fost cadoul perfect pentru sotie. A fost incantata!",
      "Abonamentul floral lunar e o idee geniala. Biroul arata mereu frumos.",
      "Floraria e superba, plina de culori si miresme. O placere sa intri.",
      "Preturi corecte si flori mereu proaspete. Singura florarie la care merg.",
    ],
    neutral: [
      "Florile erau frumoase, dar pretul e mai mare decat la alte florarii.",
      "Livrarea a durat mai mult decat promis, dar buchetul a fost ok.",
      "Gama de flori e limitata iarna. Am inteles, dar tot am fost dezamagita.",
      "Buchetul a fost ok, dar nu exact ce am cerut.",
      "Floraria e mica si nu au toate florile pe stoc. Trebuie comandat inainte.",
    ],
    negative: [
      "Florile s-au ofilit dupa 2 zile. Pentru 80 de lei ma asteptam la mai mult.",
      "Livrarea a intarziat 3 ore si surpriza a fost stricata. Dezamagitor total.",
      "Am cerut trandafiri rosii si au pus roz. Nu au vrut sa schimbe.",
      "Ambalajul era rupt si florile zdrobite. Zero grija la livrare.",
      "Preturile sunt exagerate, gasesti acelasi lucru la jumatate de pret in piata.",
    ],
  },

  "Curatatorie": {
    positive: [
      "Costumul a iesit impecabil, ca nou! Recomand cu caldura.",
      "Au scos o pata de vin care era de luni de zile. Profesionisti!",
      "Serviciu rapid, am primit hainele in aceeasi zi. Super convenabil.",
      "Covorul a iesit ca nou dupa curatare. Culoarele sunt mult mai vii acum.",
      "Ridica si livreaza la domiciliu, nu trebuie sa ma deplasez. Genial!",
      "Preturile sunt corecte si calitatea e constanta. Vin de 2 ani.",
      "Au curatat rochia de mireasa cu mare grija. Sunt foarte atenti cu materialele delicate.",
      "Perdelele arata ca noi dupa curatare. Le-au si calcat perfect.",
      "Cel mai bun serviciu de curatatorie din oras. Rapizi si de calitate.",
      "Canapaua a iesit impecabila dupa curatare. Nici nu mai miroase.",
    ],
    neutral: [
      "Curatarea a fost ok, dar a durat 3 zile in loc de 2 cat au promis.",
      "Preturile sunt decente, dar nu cele mai mici. Calitatea e buna totusi.",
      "Hainele au iesit curate, dar calcarea nu a fost perfecta.",
      "Serviciul e ok, dar nu au program in weekend.",
      "Au curatat bine, dar au pierdut un nasture de la sacou.",
    ],
    negative: [
      "Mi-au strans o camasa la spalat. Nu au vrut sa plateasca despagubire.",
      "Am dat covorul la curatat si l-au returnat cu o pata noua. Inacceptabil.",
      "Hainele miros a chimicale dupa curatare si nu pot fi purtate imediat.",
      "Au intarziat livrarea cu o saptamana si nu m-au anuntat. Neseriosi.",
      "Pretul final a fost dublu fata de estimare. Nu mai calc pe acolo.",
    ],
  },

  "Foto & Video": {
    positive: [
      "Sedinta foto a fost geniala! Fotograful ne-a facut sa ne simtim confortabil.",
      "Pozele de la nunta sunt spectaculoase. Am plans cand le-am vazut. Mersi!",
      "Clipul video promotional a iesit profesional. Clientii nostri sunt impresionati.",
      "Fotografii de produs excelente, exact ce aveam nevoie pentru magazinul online.",
      "Portretele corporate au iesit super, toti colegii sunt multumiti.",
      "Editarea e de top, fiecare poza e lucrata cu atentie. Se vede pasiunea.",
      "Filmarile cu drona sunt spectaculoase, perspective unice si calitate 4K.",
      "Am facut poze de buletin si au iesit bine din prima. Rapid si ieftin.",
      "Fotograful a surprins exact emotiile de la botez. Amintiri pentru toata viata.",
      "Recomand acest studio tuturor! Creativitate, profesionalism si preturi corecte.",
    ],
    neutral: [
      "Pozele sunt bune, dar editarea a durat 3 saptamani. Cam mult.",
      "Fotograful e bun, dar studiul e mic si limitat ca fundal.",
      "Calitatea e ok, dar nu wow. Am vazut portofolii mai impresionante.",
      "Pretul e mediu, primesti ce platesti. Nimic mai mult, nimic mai putin.",
      "Sedinta a fost ok, dar doar 5 din 30 de poze au iesit cu adevarat bine.",
    ],
    negative: [
      "Am asteptat 2 luni pozele de la nunta si cand au venit erau editate prost.",
      "Fotograful a intarziat 30 de minute la eveniment. Start dezastruos.",
      "Calitatea video e slaba, imagine granulata si sunet prost. Bani aruncati.",
      "Nu au venit cu echipamentul promis si s-a vazut in calitatea finala.",
      "Am platit 500 de lei si am primit poze ca de telefon. Nu merita deloc.",
    ],
  },
};

// ─── MAIN ─────────────────────────────────────────────────────

async function seedReviews() {
  const client = await pool.connect();

  try {
    // Check existing reviews
    const existing = await client.query("SELECT COUNT(*) as cnt FROM reviews");
    const existingCount = parseInt(existing.rows[0].cnt);

    if (existingCount > 0) {
      console.log(`\n⚠️  ${existingCount} review-uri exista deja in baza de date!`);
      if (!process.argv.includes("--force")) {
        console.log('   Ruleaza cu --force pentru a sterge si re-seed.');
        console.log('   Exemplu: node scripts/seed-reviews.js --force\n');
        return;
      }
      console.log("   --force detectat. Se sterg review-urile existente...");
      await client.query("BEGIN");
      await client.query("DELETE FROM review_responses");
      await client.query("DELETE FROM review_summaries");
      await client.query("DELETE FROM reviews");
      await client.query("COMMIT");
      console.log("   Review-uri sterse.\n");
    }

    // Fetch all businesses with category
    const bizResult = await client.query(`
      SELECT b.id, c.name AS category_name
      FROM businesses b
      JOIN categories c ON b.category_id = c.id
      ORDER BY b.id
    `);
    const businesses = bizResult.rows;
    console.log(`📦 ${businesses.length} business-uri gasite.\n`);

    if (businesses.length === 0) {
      console.log("❌ Nu exista business-uri in DB. Ruleaza mai intai seed-businesses.js.");
      return;
    }

    // Fetch all user IDs
    const usersResult = await client.query("SELECT id FROM users ORDER BY id");
    const allUserIds = usersResult.rows.map((r) => r.id);
    console.log(`👥 ${allUserIds.length} utilizatori gasiti.\n`);

    if (allUserIds.length < 3) {
      console.log("❌ Trebuie minim 3 utilizatori pentru a genera review-uri.");
      return;
    }

    // Generate reviews
    const allReviews = [];
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let skippedNoTemplate = 0;

    for (const biz of businesses) {
      const templates = REVIEW_TEMPLATES[biz.category_name];
      if (!templates) {
        skippedNoTemplate++;
        continue;
      }

      const reviewCount = randomInt(3, 7);
      const selectedUsers = shuffleArray(allUserIds).slice(0, Math.min(reviewCount, allUserIds.length));

      for (const userId of selectedUsers) {
        const rating = pickRating();
        const sentiment = getSentiment(rating);
        const comment = randomFrom(templates[sentiment]);
        const createdAt = randomDate(7, 180);

        allReviews.push({
          user_id: userId,
          business_id: biz.id,
          rating,
          comment,
          created_at: createdAt.toISOString(),
        });

        ratingCounts[rating]++;
      }
    }

    console.log(`✏️  ${allReviews.length} review-uri generate. Se insereaza...\n`);

    // Batch INSERT in chunks of 500 to avoid parameter limits
    const CHUNK_SIZE = 500;
    await client.query("BEGIN");

    for (let i = 0; i < allReviews.length; i += CHUNK_SIZE) {
      const chunk = allReviews.slice(i, i + CHUNK_SIZE);
      const values = [];
      const params = [];
      let paramIndex = 1;

      for (const review of chunk) {
        values.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`
        );
        params.push(review.user_id, review.business_id, review.rating, review.comment, review.created_at);
        paramIndex += 5;
      }

      await client.query(
        `INSERT INTO reviews (user_id, business_id, rating, comment, created_at)
         VALUES ${values.join(", ")}`,
        params
      );

      const progress = Math.min(i + CHUNK_SIZE, allReviews.length);
      process.stdout.write(`   Inserare: ${progress}/${allReviews.length}\r`);
    }

    await client.query("COMMIT");
    console.log("\n");

    // Summary
    const total = allReviews.length;
    const avgPerBiz = (total / businesses.length).toFixed(1);

    console.log("===================================================");
    console.log("  SEED REVIEWS COMPLET!");
    console.log("===================================================");
    console.log(`  Total review-uri:     ${total.toLocaleString()}`);
    console.log(`  Business-uri:         ${businesses.length}`);
    console.log(`  Utilizatori folositi: ${allUserIds.length}`);
    console.log(`  Media review/biz:     ${avgPerBiz}`);
    if (skippedNoTemplate > 0) {
      console.log(`  Sarite (fara template): ${skippedNoTemplate}`);
    }
    console.log("");
    console.log("  Distributie rating:");
    for (let r = 5; r >= 1; r--) {
      const count = ratingCounts[r];
      const pct = ((count / total) * 100).toFixed(1);
      const bar = "█".repeat(Math.round(pct / 2));
      console.log(`    ${r}★  ${String(count).padStart(5)}  (${pct.padStart(5)}%)  ${bar}`);
    }
    console.log("===================================================");
    console.log("");
    console.log("💡 Tip: Ruleaza 'npm run review-summaries:batch' pentru AI review summaries.");
    console.log("");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("\n❌ Eroare:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

seedReviews()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
