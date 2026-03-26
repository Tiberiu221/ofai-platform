const pool = require('./src/db');

const posts = [
  {
    slug: 'bun-venit-pe-ofai-platforma-reduceri-locale',
    title: 'Bun venit pe OFAI — Platforma ta de reduceri și oferte locale',
    excerpt: 'Descoperă OFAI, platforma care te conectează cu cele mai bune oferte de la business-urile din orașul tău. Restaurante, beauty, fitness, auto și multe altele — totul într-un singur loc.',
    content: `<p>Ne bucurăm că ești aici! <strong>OFAI</strong> este platforma care îți aduce cele mai bune reduceri și oferte de la business-urile locale din România, direct pe telefonul tău.</p>

<h2>Ce este OFAI?</h2>
<p>OFAI (Oferte AI) este o platformă românească care conectează consumatorii cu ofertele verificate de la business-uri locale. Fie că vrei o reducere la salon, un pachet medical avantajos sau o ofertă specială la cafeneaua preferată — le găsești pe toate aici.</p>

<h2>Cum funcționează?</h2>
<ol>
<li><strong>Explorează ofertele</strong> — Navighează prin categorii precum Beauty, Fitness, Auto, Cafenele sau Clinici medicale</li>
<li><strong>Filtrează după oraș</strong> — Selectează orașul tău (București, Cluj-Napoca, Timișoara, Iași și alte 7 orașe) pentru a vedea ofertele locale</li>
<li><strong>Salvează favoritele</strong> — Marchează ofertele care te interesează și primește notificări când apar oferte noi</li>
<li><strong>Profită de reduceri</strong> — Folosește ofertele direct la business-ul ales</li>
</ol>

<h2>Ce categorii de oferte găsești?</h2>
<p>Pe OFAI ai acces la oferte din <strong>17 categorii</strong>, printre care:</p>
<ul>
<li><strong>Beauty & Wellness</strong> — saloane de beauty, spa-uri, frizerii</li>
<li><strong>Sănătate</strong> — clinici medicale, stomatologie, optică, farmacii</li>
<li><strong>Fitness</strong> — săli de fitness, retreat-uri, programe de wellness</li>
<li><strong>Auto</strong> — service-uri auto, spălătorii, detailing</li>
<li><strong>Cafenele</strong> — specialty coffee, ceainării, brunch spots</li>
<li><strong>Servicii</strong> — curățătorii, florării, foto-video și multe altele</li>
</ul>

<h2>De ce OFAI?</h2>
<p>Spre deosebire de alte platforme de cupoane, OFAI se concentrează pe <strong>business-uri locale verificate</strong>. Fiecare ofertă este verificată, iar business-urile au profile complete cu program, adresă, fotografii și recenzii de la alți utilizatori.</p>

<blockquote>Misiunea noastră este simplă: să te ajutăm să economisești bani susținând în același timp business-urile locale din comunitatea ta.</blockquote>

<h2>Descarcă aplicația</h2>
<p>OFAI este disponibil atât pe web cât și ca aplicație mobilă. Descarcă aplicația OFAI din Google Play pentru a primi notificări instant când apar oferte noi în orașul tău.</p>

<p>Explorează <a href="/oferte">ofertele disponibile</a> sau descoperă <a href="/business-uri">business-urile</a> din zona ta. Bun venit în comunitatea OFAI!</p>`,
    category_id: 5,
    author_name: 'Echipa OFAI',
    meta_title: 'OFAI — Platforma de Reduceri și Oferte Locale din România',
    meta_description: 'Descoperă cele mai bune oferte de la business-uri locale verificate. Beauty, fitness, auto, cafenele și clinici — totul într-un singur loc pe OFAI.'
  },
  {
    slug: 'cum-sa-economisesti-cu-ofai-ghid-complet',
    title: 'Cum să economisești cu OFAI: Ghid complet pentru începători',
    excerpt: 'Învață cum să profiți la maxim de platforma OFAI. De la filtre inteligente până la notificări personalizate — descoperă toate funcțiile care te ajută să economisești.',
    content: `<p>Într-o perioadă în care prețurile cresc constant, fiecare leu economisit contează. OFAI îți pune la dispoziție instrumente inteligente care te ajută să găsești cele mai bune oferte din orașul tău, fără efort.</p>

<h2>1. Folosește filtrele pentru a găsi oferte relevante</h2>
<p>Pe pagina de <a href="/oferte">oferte</a>, ai la dispoziție mai multe filtre:</p>
<ul>
<li><strong>Filtru pe oraș</strong> — selectează orașul tău pentru a vedea doar ofertele locale</li>
<li><strong>Filtru pe categorie</strong> — alege din 17 categorii (Beauty, Fitness, Auto, Clinică etc.)</li>
<li><strong>Sortare</strong> — ordonează după dată, popularitate sau mărimea reducerii</li>
</ul>
<p>Combinând aceste filtre, ajungi rapid la ofertele care te interesează.</p>

<h2>2. Salvează ofertele favorite</h2>
<p>Ai văzut o ofertă interesantă dar nu ești gata să o folosești? Adaug-o la <strong>favorite</strong> cu un singur tap. Le regăsești oricând în secțiunea <a href="/colectia-mea">Colecția mea</a>.</p>

<h2>3. Urmărește business-urile preferate</h2>
<p>Când urmărești un business, vei fi notificat automat de fiecare dată când acesta publică o ofertă nouă. E cel mai simplu mod de a nu rata nicio reducere de la locurile tale preferate.</p>

<h2>4. Activează notificările personalizate</h2>
<p>Din setările contului, poți personaliza notificările:</p>
<ul>
<li><strong>Oferte zilnice</strong> — primește un rezumat zilnic cu cele mai bune oferte noi</li>
<li><strong>Flash deals</strong> — fii alertat instant când apare o ofertă cu timp limitat</li>
<li><strong>Digest săptămânal</strong> — un sumar cu cele mai populare oferte din ultima săptămână</li>
</ul>

<h2>5. Verifică ofertele flash</h2>
<p>Ofertele flash sunt reduceri cu <strong>timp limitat</strong> — de obicei câteva ore sau o zi. Au adesea cele mai mari reduceri, dar dispar rapid. Activează notificările flash pentru a le prinde la timp.</p>

<h2>6. Explorează pe categorii</h2>
<p>Uneori cele mai bune oferte vin din categorii la care nu te-ai gândit. Navighează prin <a href="/categorii">toate categoriile</a> — s-ar putea să descoperi un salon de beauty cu 30% reducere sau o clinică cu consultație gratuită lângă tine.</p>

<h2>Cât poți economisi?</h2>
<p>Pe OFAI găsești reduceri de la <strong>15% până la 100%</strong> (consultații gratuite, de exemplu). Un utilizator activ poate economisi în medie <strong>200-500 RON pe lună</strong> folosind ofertele disponibile în orașul său.</p>

<p>Începe acum — explorează <a href="/oferte">ofertele disponibile</a> și creează-ți un cont gratuit!</p>`,
    category_id: 1,
    author_name: 'Echipa OFAI',
    meta_title: 'Cum să economisești cu OFAI — Ghid complet',
    meta_description: 'Ghid pas cu pas pentru a profita de reducerile OFAI. Filtre, notificări, favorite și flash deals — totul pentru a economisi mai mult.'
  },
  {
    slug: 'top-5-categorii-reduceri-populare-romania',
    title: 'Top 5 categorii de reduceri populare în România în 2026',
    excerpt: 'Ce reduceri caută românii cel mai des? De la beauty și fitness până la servicii auto și clinici medicale — descoperă tendințele anului 2026.',
    content: `<p>Piața de oferte și reduceri locale din România este în continuă creștere. Am analizat datele de pe OFAI pentru a identifica cele mai căutate categorii de reduceri în 2026.</p>

<h2>1. Beauty & Wellness — Liderul incontestabil</h2>
<p>Categoria <a href="/categorii">Beauty</a> rămâne cea mai populară, cu servicii de la saloane precum tratamente faciale, manichiură, extensii gene și proceduri de îngrijire a părului. Reducerile variază între <strong>15% și 50%</strong>, iar cele mai căutate sunt pachetele combo (ex: manichiură + pedichiură cu reducere).</p>
<p><strong>Tendința 2026:</strong> Creștere a interesului pentru tratamente naturale și produse eco-friendly.</p>

<h2>2. Clinici Medicale — Prevenția devine prioritară</h2>
<p>Pachetele de <strong>analize de sânge</strong> și <strong>consultații gratuite</strong> atrag tot mai mulți utilizatori. Ofertele de tip „pachet preventiv" cu reduceri de 20-30% sunt printre cele mai accesate pe platformă.</p>
<p><strong>Tendința 2026:</strong> Telemedicina și pachetele de screening complet câștigă popularitate.</p>

<h2>3. Fitness — Rezoluțiile care rezistă</h2>
<p>Spre deosebire de anii anteriori, în 2026 interesul pentru fitness <strong>nu scade</strong> după ianuarie. Abonamentele cu reducere, clasele de group fitness și programele personalizate de antrenament rămân căutate tot anul.</p>
<p><strong>Tendința 2026:</strong> Creștere a interesului pentru retreat-uri de wellness și antrenamente outdoor.</p>

<h2>4. Auto — Întreținerea smart</h2>
<p>Românii caută tot mai des oferte pentru <strong>ITP, revizie, spălare premium</strong> și detailing auto. Categoria auto are una dintre cele mai mari rate de conversie pe OFAI — cine caută o ofertă auto, de obicei o și folosește.</p>
<p><strong>Tendința 2026:</strong> Service-uri specializate pe vehicule electrice și hibride.</p>

<h2>5. Cafenele — Experiența, nu doar cafeaua</h2>
<p>Cafenelele de specialitate câștigă teren. Ofertele de tip „2 cafele la preț de 1" sau „brunch cu reducere" sunt foarte populare, mai ales în marile orașe precum București, Cluj-Napoca și Timișoara.</p>
<p><strong>Tendința 2026:</strong> Spații de co-working integrate în cafenele, cu oferte speciale pentru freelanceri.</p>

<h2>Bonus: Categorii în creștere</h2>
<p>Trei categorii care cresc rapid pe OFAI:</p>
<ul>
<li><strong>Stomatologie</strong> — mai ales albire dentară și consultații de ortodonție</li>
<li><strong>Spa & Wellness</strong> — pachete de masaj și tratamente de relaxare</li>
<li><strong>Florării</strong> — comenzi online cu livrare, mai ales în jurul sărbătorilor</li>
</ul>

<p>Explorează toate categoriile pe OFAI și descoperă <a href="/oferte">ofertele</a> disponibile în orașul tău.</p>`,
    category_id: 3,
    author_name: 'Echipa OFAI',
    meta_title: 'Top 5 categorii reduceri populare în România 2026',
    meta_description: 'Cele mai căutate reduceri în România: beauty, clinici, fitness, auto, cafenele. Descoperă tendințele și cele mai bune oferte din 2026.'
  },
  {
    slug: 'ghid-alegere-salon-beauty-perfect',
    title: 'Ghid complet: Cum îți alegi salonul de beauty perfect',
    excerpt: 'De la recenzii și portofoliu până la igienă și prețuri — tot ce trebuie să știi înainte de a alege un salon de beauty.',
    content: `<p>Cu sute de saloane de beauty disponibile în marile orașe din România, alegerea celui potrivit poate fi copleșitoare. Iată un ghid practic care te ajută să faci alegerea corectă.</p>

<h2>1. Verifică recenziile și rating-ul</h2>
<p>Prima și cea mai importantă regulă: <strong>citește recenziile</strong>. Pe OFAI, fiecare business are recenzii de la clienți reali. Caută saloane cu:</p>
<ul>
<li>Minim <strong>4 stele</strong> din 5</li>
<li>Cel puțin <strong>10+ recenzii</strong> (un rating de 5 stele din 2 recenzii nu e relevant)</li>
<li>Recenzii <strong>recente</strong> — un salon excelent acum 2 ani poate fi mediocru azi</li>
</ul>

<h2>2. Analizează portofoliul</h2>
<p>Un salon bun își prezintă cu mândrie lucrările. Verifică galeria foto de pe profil — fotografiile înainte/după sunt cel mai bun indicator al calității.</p>

<h2>3. Verifică prețurile și transparența</h2>
<p>Saloanele profesioniste au <strong>prețuri clare</strong>, publicate pe profil sau în catalog. Evită locurile care nu afișează prețuri — de obicei înseamnă surprize neplăcute.</p>
<p>Pe OFAI, multe saloane oferă <strong>reduceri exclusive</strong> — verifică ofertele active înainte de a face o programare la preț întreg.</p>

<h2>4. Locație și accesibilitate</h2>
<p>Un salon excelent la 45 de minute distanță devine rapid un inconvenient. Filtrează <a href="/business-uri">business-urile</a> după orașul tău pentru a găsi opțiuni aproape de tine.</p>

<h2>5. Igiena — non-negociabilă</h2>
<p>La prima vizită, observă:</p>
<ul>
<li>Instrumentele sunt <strong>sterilizate</strong> vizibil?</li>
<li>Spațiul de lucru este <strong>curat și ordonat</strong>?</li>
<li>Se folosesc <strong>prosoape și materiale de unică folosință</strong> unde este cazul?</li>
</ul>
<p>Dacă ceva nu arată în regulă, nu te sfii să pleci. Igiena este mai importantă decât orice reducere.</p>

<h2>6. Specializarea contează</h2>
<p>Un salon care face „de toate" nu excelează neapărat la niciuna. Dacă vrei un serviciu specific (ex: extensii gene, microblading, coloristică avansată), caută saloane <strong>specializate</strong> pe acel serviciu.</p>

<h2>Checklist rapid</h2>
<ul>
<li>Rating 4+ stele cu 10+ recenzii</li>
<li>Portofoliu foto actualizat</li>
<li>Prețuri publicate transparent</li>
<li>Locație accesibilă</li>
<li>Igienă impecabilă</li>
<li>Specializare pe serviciul dorit</li>
</ul>

<p>Descoperă saloanele de beauty din orașul tău pe <a href="/categorii">OFAI</a> și compară ofertele disponibile.</p>`,
    category_id: 1,
    author_name: 'Echipa OFAI',
    meta_title: 'Cum alegi salonul de beauty perfect — Ghid complet',
    meta_description: 'Ghid practic pentru alegerea salonului de beauty: recenzii, portofoliu, prețuri, igienă și specializare. Compară saloane pe OFAI.'
  },
  {
    slug: 'de-ce-business-ul-tau-are-nevoie-de-prezenta-online',
    title: 'De ce business-ul tău local are nevoie de prezență pe o platformă de oferte',
    excerpt: 'Vizibilitate, clienți noi și venituri mai mari — descoperă cum o platformă de oferte poate transforma un business local.',
    content: `<p>Dacă ai un business local — salon, restaurant, clinică, sală de fitness sau orice alt serviciu — și nu ești prezent online, pierzi clienți în fiecare zi. Iată de ce o platformă de oferte ca OFAI poate face diferența.</p>

<h2>Problema: Clienții te caută online, nu pe stradă</h2>
<p>Peste <strong>80% din consumatorii români</strong> caută servicii locale pe internet înainte de a lua o decizie. Dacă nu te găsesc, aleg pe altcineva. E atât de simplu.</p>

<h2>Cum te ajută OFAI?</h2>

<h3>1. Vizibilitate instant</h3>
<p>Profilul tău pe OFAI apare în căutări pe oraș și categorie. Când cineva caută „salon beauty București" sau „fitness Cluj-Napoca", business-ul tău e acolo — cu logo, descriere, program și recenzii.</p>

<h3>2. Oferte care atrag clienți noi</h3>
<p>O reducere de 20% pe prima vizită poate transforma un trecător în client fidel. Ofertele funcționează ca un <strong>magnet de clienți noi</strong> — odată ce experimentează calitatea serviciului tău, revin la preț întreg.</p>

<h3>3. Recenzii care construiesc încredere</h3>
<p>Fiecare recenzie pozitivă pe profilul tău este o <strong>recomandare publică</strong>. Pe OFAI, recenziile sunt verificate — doar clienți reali pot lăsa feedback, ceea ce le face mai credibile decât cele de pe alte platforme.</p>

<h3>4. Analytics și date despre clienți</h3>
<p>Prin portalul de business OFAI, ai acces la statistici: câți oameni ți-au vizualizat profilul, câți au accesat ofertele, care sunt cele mai populare servicii. Aceste date te ajută să iei decizii informate.</p>

<h3>5. Costuri reduse față de publicitatea tradițională</h3>
<p>Comparativ cu flyere, reclame în ziar sau panouri publicitare, prezența pe OFAI este mult mai <strong>cost-eficientă</strong>. Planul gratuit oferă funcționalități de bază, iar planurile Standard și Premium vin cu instrumente avansate de promovare.</p>

<h2>Studiu de caz: Rezultate reale</h2>
<p>Un salon de beauty din București și-a crescut baza de clienți cu <strong>40%</strong> în primele 3 luni pe OFAI, publicând o singură ofertă de „manichiură + pedichiură cu 25% reducere". Investiția? Zero lei — folosind planul gratuit.</p>

<h2>Cum începi?</h2>
<p>Adăugarea business-ului pe OFAI durează <strong>sub 5 minute</strong>:</p>
<ol>
<li>Accesează <a href="/pentru-business">pagina pentru business</a></li>
<li>Completează informațiile de bază (nume, categorie, oraș, adresă)</li>
<li>Adaugă logo-ul și o descriere</li>
<li>Publică prima ofertă</li>
</ol>

<p>Nu mai aștepta — <a href="/pentru-business">adaugă business-ul tău pe OFAI</a> astăzi și începe să atragi clienți noi.</p>`,
    category_id: 2,
    author_name: 'Echipa OFAI',
    meta_title: 'De ce ai nevoie de prezență pe o platformă de oferte — Ghid business',
    meta_description: 'Descoperă cum o platformă de oferte locale poate aduce vizibilitate, clienți noi și venituri mai mari business-ului tău. Ghid complet pe OFAI.'
  },
  {
    slug: 'cele-mai-bune-oferte-primavara-2026',
    title: 'Cele mai bune oferte de primăvară 2026 — Ce să nu ratezi',
    excerpt: 'Primăvara vine cu oferte de sezon: detox, fitness, beauty refresh și întreținere auto. Descoperă ce reduceri te așteaptă pe OFAI.',
    content: `<p>Primăvara este sezonul reinventării — și asta se reflectă și în ofertele disponibile pe OFAI. De la „fresh start" la beauty până la pregătirea mașinii pentru vară, iată ce oferte nu trebuie să ratezi.</p>

<h2>Beauty: Sezonul refresh-ului</h2>
<p>Primăvara este momentul ideal pentru:</p>
<ul>
<li><strong>Tratamente faciale de hidratare</strong> — după iarna uscată, pielea are nevoie de îngrijire intensivă</li>
<li><strong>Manichiură cu culori de primăvară</strong> — saloanele lansează colecții noi de nuanțe</li>
<li><strong>Epilare</strong> — oferte early-bird pentru sezonul cald</li>
</ul>
<p>Caută reduceri de până la <strong>30%</strong> la saloane de <a href="/categorii">beauty</a> din orașul tău.</p>

<h2>Fitness: Motivația de primăvară</h2>
<p>Dacă rezoluția de Anul Nou a cedat, primăvara e a doua șansă. Pe OFAI găsești:</p>
<ul>
<li>Abonamente lunare cu reducere la săli de fitness</li>
<li>Pachete de antrenament personal</li>
<li>Oferte la clase de yoga, pilates și cycling</li>
</ul>
<p>Multe săli oferă <strong>prima ședință gratuită</strong> — profită ca să testezi mai multe opțiuni.</p>

<h2>Auto: Pregătirea pentru vară</h2>
<p>Primăvara este momentul pentru:</p>
<ul>
<li><strong>Schimbul de cauciucuri</strong> — oferte la montaj + echilibrare</li>
<li><strong>Spălare premium + detailing interior</strong> — scoate sarea și murdăria de iarnă</li>
<li><strong>Revizia de primăvară</strong> — lichide, filtre, frâne — pachet complet cu reducere</li>
</ul>

<h2>Sănătate: Check-up de primăvară</h2>
<p>Nu uita de tine! Primăvara e momentul perfect pentru:</p>
<ul>
<li><strong>Analize complete de sânge</strong> — clinicile de pe OFAI oferă reduceri de 20-30%</li>
<li><strong>Control stomatologic</strong> — detartraj + consultație cu reducere</li>
<li><strong>Consultație oftalmologică</strong> — verificare anuală + oferte la ochelari noi</li>
</ul>

<h2>Cafenele: Terasa se deschide</h2>
<p>Cele mai populare cafenele din București, Cluj, Timișoara și Iași oferă <strong>promoții de deschidere a terasei</strong>. Caută oferte de tip „cafea + desert" sau „brunch de weekend" cu reduceri exclusive pe OFAI.</p>

<h2>Cum prinzi cele mai bune oferte?</h2>
<ol>
<li><strong>Activează notificările flash</strong> — cele mai mari reduceri sunt pe timp limitat</li>
<li><strong>Urmărește business-urile favorite</strong> — vei fi primul care află de ofertele noi</li>
<li><strong>Verifică zilnic secțiunea „Noi"</strong> — ofertele proaspete au cele mai bune disponibilități</li>
</ol>

<p>Nu rata ofertele de primăvară — explorează <a href="/oferte">toate reducerile disponibile</a> pe OFAI.</p>`,
    category_id: 4,
    author_name: 'Echipa OFAI',
    meta_title: 'Cele mai bune oferte de primăvară 2026 — OFAI',
    meta_description: 'Oferte de primăvară 2026: beauty refresh, fitness, auto detailing, check-up medical. Descoperă reducerile de sezon pe OFAI.'
  },
  {
    slug: 'cum-sa-atragi-clienti-noi-prin-oferte-speciale',
    title: 'Cum să atragi clienți noi prin oferte speciale: Ghid pentru antreprenori',
    excerpt: 'Strategii dovedite pentru atragerea clienților prin oferte și reduceri. De la pricing psychology până la fidelizare — ghid complet pentru business-uri locale.',
    content: `<p>Ca proprietar de business local, știi că atragerea de clienți noi este o provocare constantă. Ofertele speciale sunt unul dintre cele mai eficiente instrumente — dar doar dacă le folosești strategic.</p>

<h2>Psihologia din spatele reducerilor</h2>
<p>Reducerile funcționează pentru că activează două mecanisme psihologice puternice:</p>
<ul>
<li><strong>FOMO (Fear of Missing Out)</strong> — sentimentul că ratezi ceva valoros</li>
<li><strong>Percepția de valoare</strong> — clienții simt că primesc mai mult decât plătesc</li>
</ul>
<p>Cheia este să creezi oferte care atrag fără să-ți devalorizeze serviciul.</p>

<h2>5 tipuri de oferte care funcționează</h2>

<h3>1. Reducere pe prima vizită</h3>
<p>Clasicul <strong>„20% off prima vizită"</strong> funcționează excelent pentru servicii repetitive (beauty, fitness, cafenele). Clientul testează la preț redus, revine la preț întreg dacă-i place.</p>

<h3>2. Pachete combo</h3>
<p>Combină două servicii la un preț mai bun decât separat: „Manichiură + pedichiură — 120 lei în loc de 160 lei". Clientul percepe valoare, tu crești valoarea medie a comenzii.</p>

<h3>3. Flash deals (oferte cu timp limitat)</h3>
<p>Ofertele valabile doar <strong>24-48 de ore</strong> creează urgență. Pe OFAI, aceste oferte au cele mai mari rate de conversie — clienții acționează rapid când văd un countdown.</p>

<h3>4. Oferte sezoniere</h3>
<p>Aliniază ofertele la sezon: detailing auto primăvara, tratamente hidratare iarna, abonamente fitness în ianuarie. Clienții caută activ aceste servicii în aceste perioade.</p>

<h3>5. Programul de recomandare</h3>
<p>Oferă o reducere clientului care aduce un prieten. Ambele părți câștigă, iar costul de achiziție a clientului nou este minim.</p>

<h2>Greșeli de evitat</h2>
<ul>
<li><strong>Reduceri prea mari</strong> — 50%+ reducere poate sugera că serviciul nu valorează prețul întreg</li>
<li><strong>Oferte permanente</strong> — dacă mereu ai reducere, nu mai e reducere. Rotești ofertele lunar</li>
<li><strong>Lipsa termenului limită</strong> — fără deadline, clientul amână. Mereu pune o dată de expirare</li>
<li><strong>Calitate redusă la ofertă</strong> — dacă oferi serviciu inferior clienților cu reducere, nu vor reveni niciodată</li>
</ul>

<h2>Măsoară rezultatele</h2>
<p>Pe <a href="/pentru-business">portalul OFAI</a>, ai acces la statistici detaliate:</p>
<ul>
<li>Câți oameni au vizualizat oferta</li>
<li>Câți au dat click pe „Programează" sau „Sună"</li>
<li>Care oferte performează cel mai bine</li>
</ul>
<p>Folosește aceste date pentru a optimiza continuu strategia de oferte.</p>

<p>Ești gata să atragi mai mulți clienți? <a href="/pentru-business">Adaugă business-ul tău pe OFAI</a> și publică prima ofertă.</p>`,
    category_id: 2,
    author_name: 'Echipa OFAI',
    meta_title: 'Cum atragi clienți noi prin oferte speciale — Ghid antreprenori',
    meta_description: 'Strategii pentru business-uri locale: cum creezi oferte eficiente care atrag clienți noi. Pricing, flash deals, pachete combo și fidelizare.'
  },
  {
    slug: 'ghid-servicii-stomatologice-reducere-romania',
    title: 'Ghid: Cum găsești servicii stomatologice de calitate cu reducere',
    excerpt: 'Serviciile stomatologice nu trebuie să fie scumpe. Descoperă cum poți face economii la detartraj, albire, consultații și tratamente dentare pe OFAI.',
    content: `<p>Serviciile stomatologice sunt printre cele mai evitate de români din cauza prețurilor ridicate. Dar cu puțină planificare și ofertele potrivite, poți menține o igienă dentară impecabilă fără să-ți golești portofelul.</p>

<h2>De ce sunt importante controalele regulate?</h2>
<p>Un control stomatologic la fiecare <strong>6 luni</strong> poate preveni probleme costisitoare pe termen lung. O carie mică depistată devreme costă <strong>150-300 RON</strong> de tratat. Aceeași carie ignorată 2 ani poate necesita un tratament de canal de <strong>800-1500 RON</strong>.</p>
<p>Prevenția este întotdeauna mai ieftină decât tratamentul.</p>

<h2>Ce servicii stomatologice găsești cu reducere pe OFAI?</h2>

<h3>Detartraj + periaj profesional</h3>
<p>Cel mai comun serviciu cu reducere. Prețul normal: 200-350 RON. Cu ofertele de pe OFAI, găsești <strong>reduceri de 20-30%</strong>, ajungând la 150-250 RON. Recomandat la fiecare 6 luni.</p>

<h3>Consultație + plan de tratament</h3>
<p>Multe clinici de pe OFAI oferă <strong>prima consultație gratuită</strong> sau cu reducere semnificativă. Este ideal pentru a evalua starea dentară și a primi un plan de tratament fără obligații.</p>

<h3>Albire dentară</h3>
<p>Unul dintre cele mai căutate servicii estetice. Prețul standard: 500-1200 RON. Pe OFAI, pachete de albire cu <strong>reducere de 15-25%</strong> sunt frecvent disponibile.</p>

<h3>Ortodonție</h3>
<p>Consultația inițială de ortodonție (evaluare + plan) este adesea oferită cu reducere sau gratuită pe OFAI. E momentul perfect să afli dacă ai nevoie de aparat dentar.</p>

<h2>Cum alegi un cabinet stomatologic?</h2>
<ul>
<li><strong>Verifică recenziile</strong> — pe OFAI, fiecare clinică are recenzii de la pacienți reali</li>
<li><strong>Caută specializarea</strong> — pentru albire, mergi la un cabinet specializat în estetică dentară</li>
<li><strong>Întreabă despre echipamente</strong> — radiografie digitală și microscopie sunt semne de cabinet modern</li>
<li><strong>Transparența prețurilor</strong> — un cabinet serios are lista de prețuri publicată</li>
</ul>

<h2>Calendar de economii dentare</h2>
<ul>
<li><strong>Ianuarie-Februarie:</strong> Oferte de Anul Nou la detartraj și consultații</li>
<li><strong>Martie:</strong> Ziua Mondială a Sănătății Orale — multe clinici oferă reduceri speciale</li>
<li><strong>Iunie-August:</strong> Oferte de vară pentru albire dentară (pregătire concediu)</li>
<li><strong>Noiembrie:</strong> Black Friday medical — cele mai mari reduceri ale anului</li>
</ul>

<p>Nu amâna vizita la stomatolog. Verifică <a href="/oferte">ofertele disponibile</a> de la clinicile stomatologice de pe OFAI și programează-te astăzi.</p>`,
    category_id: 1,
    author_name: 'Echipa OFAI',
    meta_title: 'Servicii stomatologice cu reducere — Ghid complet OFAI',
    meta_description: 'Cum găsești detartraj, albire și consultații dentare cu reducere. Ghid pentru economii la stomatolog cu oferte verificate pe OFAI.'
  }
];

(async () => {
  try {
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      const publishedAt = new Date();
      // Spread posts over last 3 weeks (every 3 days)
      publishedAt.setDate(publishedAt.getDate() - (posts.length - 1 - i) * 3);

      await pool.query(
        `INSERT INTO blog_posts (slug, title, excerpt, content, category_id, author_name, is_published, published_at, meta_title, meta_description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [p.slug, p.title, p.excerpt, p.content, p.category_id, p.author_name, true, publishedAt.toISOString(), p.meta_title, p.meta_description]
      );
      console.log(`[${i + 1}/${posts.length}] Inserted: ${p.slug}`);
    }
    console.log(`\nDone! Inserted ${posts.length} blog posts`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
