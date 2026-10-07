# Workflow-uri n8n — OFAI

Automatizările care rulează **în afara** aplicației: backend-ul trimite evenimente, n8n le îmbogățește din baza de date și acționează (email, Telegram, moderare cu Claude). Fișierele de aici sunt exporturi n8n; se importă din **n8n → Workflows → Import from file**.

## Cum ajung evenimentele în n8n

Backend-ul apelează `triggerWebhook(path, payload)` din [`appredueri_backend/src/services/n8n.js`](../appredueri_backend/src/services/n8n.js): un `POST` fire-and-forget către `N8N_WEBHOOK_URL + path`. Dacă n8n e oprit sau variabila lipsește, aplicația nu e afectată (nu așteaptă răspuns, loghează eroarea).

| Eveniment | Trimis din | Payload |
|---|---|---|
| `/webhook/new-user` | înregistrare (email, Google web/mobil) | `user_id, created_at, source?` |
| `/webhook/new-offer` | creare ofertă | `offer_id, business_id, business_name, title, discount_*, start_date, end_date` |
| `/webhook/new-review` | review nou | `review_id, business_id, business_name, rating` |
| `/webhook/new-subscriber` | un utilizator urmărește un business | `user_id, business_id, created_at` |

**Convenție:** payload-ul conține doar ID-uri și câteva câmpuri de context. Datele personale (email, nume) **nu** circulă prin webhook; fiecare workflow le citește din Postgres cu interogări parametrizate (`$1` + *Query Replacement*), ca în backend.

## Workflow-urile

| # | Fișier | Trigger | Ce face |
|---|---|---|---|
| WF1 | `WF1_New_Review_Notify_Owner.json` | `new-review` | Citește review-ul + proprietarul din DB → email proprietarului cu stelele și comentariul (Resend). |
| WF2 | `WF2_New_User_Welcome.json` | `new-user` | Citește utilizatorul → email de bun venit (3 pași) → alertă Telegram la admin. Fără email → se oprește. |
| WF3 | `WF3_New_Offer_AI_Moderation.json` | `new-offer` | Citește oferta → **Claude (Haiku)** verifică dacă e înșelătoare/spam, cu inputul împachetat în `[USER_INPUT]` → `ok` = Telegram „publicată”; altfel Telegram + email admin cu link spre `/admin/offers/:id`. Răspuns neparsabil = `review` (fail closed). |
| WF4 | `WF4_New_Follower_Milestone.json` | `new-subscriber` | Numără urmăritorii business-ului → email proprietarului **doar la praguri** (1, 10, 25, 50, 100, 250, 500, 1000), ca să nu spameze. |
| WF5 | `WF5_Daily_Expiring_Offers.json` | zilnic 08:00 (Europe/Bucharest) | Ofertele care expiră peste 3 zile → un singur email per proprietar cu lista lui → rezumat Telegram la admin. Fără oferte → se oprește. |

Toate emailurile pleacă de la `OFAI <noreply@ofai.ro>` prin Resend, în română, cu același șablon (header portocaliu `#FB923C`, buton CTA, footer cu link spre preferințe).

## Credențiale (se setează în n8n, niciodată în JSON)

| Nume credențial în n8n | Tip | Folosit de |
|---|---|---|
| `OFAI Postgres (Railway)` | Postgres | WF1–WF5 |
| `Resend API (Authorization: Bearer)` | Header Auth (`Authorization: Bearer re_…`) | WF1–WF5 |
| `OFAI Telegram Bot` | Telegram API | WF2, WF3, WF5 |
| `Anthropic API (x-api-key)` | Header Auth (`x-api-key`) | WF3 |

Placeholder-e de înlocuit după import: `ADMIN_CHAT_ID` (nodurile Telegram) și `ADMIN_EMAIL` (WF3).

## Test local

```bash
# simulează backend-ul (n8n pornit local, workflow activ sau "Listen for test event")
curl -X POST http://localhost:5678/webhook/new-user -H 'Content-Type: application/json' -d '{"user_id": 1, "source": "test"}'
```

## Note

- WF1 a fost corectat (oct 2026): nodul Webhook v2 pune payload-ul sub `body`, iar backend-ul trimite doar `review_id`, deci workflow-ul citește acum detaliile din Postgres înainte de a formata emailul.
- Joburile care țin de date (expirări, scoruri, curățenie) rămân în backend (`services/cronJobs.js`, node-cron); n8n e pentru fluxurile de notificare și integrare, ușor de modificat fără deploy.
