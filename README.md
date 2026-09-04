# Fish Identifier MVP 0.6.2 – Beta Polish

Progressive Web App zur KI-gestützten Fischbestimmung mit lokalem Fangbuch, Gewässern, GPS-Daten und Backup. Fishial ist der primäre Dienst; bei niedriger Sicherheit kann die konfigurierte zweite KI eine zusätzliche Einschätzung liefern.

## Development Start

Voraussetzung ist Node.js 20 oder neuer.

```text
npm install
npm start
```

Danach ist die App standardmäßig unter `http://localhost:3000` erreichbar. Service Worker und PWA-Funktionen dürfen auf `localhost` im sicheren Entwicklungskontext arbeiten.

## Beta-/Produktionskonfiguration

`.env.example` nach `.env` kopieren und nur lokal mit den benötigten Werten befüllen. Für Beta oder Produktion insbesondere setzen:

- `NODE_ENV=production`
- `APP_ENV=beta` oder `APP_ENV=production`
- `FISHIAL_CLIENT_ID` und `FISHIAL_CLIENT_SECRET`
- `GEMINI_API_KEY`, wenn die zweite Meinung aktiviert ist
- Analyse- und Second-Opinion-Rate-Limits
- `TRUST_PROXY=true` ausschließlich hinter einem vertrauenswürdigen Reverse Proxy

Der Server beendet den Start bei einer unvollständigen produktionsähnlichen Konfiguration. `.env` darf niemals committed oder als statische Datei ausgeliefert werden. API-Schlüssel gehören ausschließlich auf den Server.

## Deployment-Anforderungen

- Node.js 20+
- HTTPS-Domain für Installation, Standortzugriff und zuverlässige PWA-Funktionen
- keine Server-Datenbank erforderlich
- persistente Fangbuch-, Gewässer-, GPS- und Backup-Daten bleiben im Browser des jeweiligen Geräts
- keine Benutzerkonten und keine Cloud-Synchronisierung
- `GET /api/health` als einfacher Healthcheck

## Sicherheit

Analyse und zweite Meinung sind getrennt, serverseitig und IP-basiert begrenzt. Uploads liegen nur im Arbeitsspeicher, sind größenbegrenzt und auf unterstützte Bildtypen beschränkt. Dev-Endpunkte sind bei `APP_ENV=beta`, `APP_ENV=production` oder `NODE_ENV=production` deaktiviert. Fehlerantworten enthalten keine Stacktraces oder Provider-Schlüssel.

Die App-Shell wird offline gecacht. Fotos, Backups, Fangbuch-/GPS-Daten und Analyseanfragen werden nicht vom Service Worker gespeichert. Öffentliche Artenmetadaten dürfen für das Offline-Lexikon gecacht werden.

## Private-Beta-Checkliste

- HTTPS, Healthcheck und Startup-Validierung prüfen
- Installation und Offline-Start testen
- Fishial-Fall ab 80 % sowie zweite Meinung unter 80 % testen
- Rate-Limit und verständliche 429-Antwort prüfen
- Fangbuch, kg/g, Gewässer und GPS testen
- lokales und externes Backup wiederherstellen
- Updatehinweis nach einer neuen App-Shell-Version prüfen
- Info-, Datenschutz-, Impressums- und Feedbackbereiche prüfen
- finale rechtliche Angaben vor einem öffentlichen Release ergänzen

## Private Beta Deployment

1. Repository bei einem beliebigen Node.js-Hostingdienst bereitstellen.
2. Node.js 22 LTS auswählen; unterstützt werden Node.js 20 bis 24.
3. Installationsbefehl `npm ci` konfigurieren.
4. Startbefehl `npm start` konfigurieren.
5. die unten genannten Variablen im Secret-/Environment-Bereich des Hosters setzen – keine `.env` hochladen.
6. den Healthcheck auf `/api/health` setzen.
7. die bereitgestellte HTTPS-Domain öffnen und die PWA installieren.
8. anschließend die Deployment-Akzeptanzprüfung durchführen.

Pflicht für Beta/Produktion sind `NODE_ENV=production`, `APP_ENV=beta` oder `production`, `FISHIAL_CLIENT_ID` und `FISHIAL_CLIENT_SECRET`. Bei aktivierter zweiter Meinung sind zusätzlich `SECOND_OPINION_ENABLED=true`, `SECOND_OPINION_PROVIDER=GEMINI` und `GEMINI_API_KEY` erforderlich.

Optional konfigurierbar sind `PORT`, `HOST`, `MAX_UPLOAD_SIZE_BYTES`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, beide `SECOND_OPINION_RATE_LIMIT_*`-Werte, Provider-Basis-URLs und Modellname. Ein Hostingdienst setzt `PORT` normalerweise automatisch. `HOST` bleibt üblicherweise `0.0.0.0`.

`TRUST_PROXY=true` darf nur gesetzt werden, wenn ein vertrauenswürdiger Reverse Proxy unmittelbar vor dem Node-Prozess steht und der Hostinganbieter dies für die Erkennung der Client-IP verlangt. Ohne Proxy bleibt der Wert `false`. Die richtige Einstellung hängt vom Hostinganbieter und dessen Proxy-Kette ab; sie darf nicht geraten werden, da eine falsche Einstellung IP-basiertes Rate Limiting schwächen oder alle Tester zusammenfassen kann.

HTTPS wird durch Hostingplattform oder Reverse Proxy bereitgestellt. Express verwaltet bewusst keine Zertifikate. HTTPS ist für installierbare PWA, Service Worker, zuverlässige Standortabfragen und sichere Bildübertragung erforderlich; `localhost` bleibt für Entwicklung zulässig.

Frontend und API werden von derselben Domain ausgeliefert. Daher ist kein globales CORS erforderlich. Alle Browseranfragen verwenden relative Same-Origin-Pfade. Die CSP erlaubt ausschließlich eigene Scripts, Styles und API-Verbindungen sowie `blob:`/`data:` für lokale Bilddarstellung.

### Deployment Acceptance Checklist

- Deployment startet ohne Konfigurationsfehler; Logs enthalten keine Schlüssel oder Nutzerdaten.
- `/api/health` antwortet mit HTTP 200 und Version 0.6.2.
- `/api/dev/stats` und `/api/dev/gemini-benchmark` antworten in Beta/Produktion mit 404.
- HTTPS, Manifest, Service Worker, Installation und Updatehinweis funktionieren.
- Fishial-Fall ab 80 % und Fishial-Fall unter 80 % mit Gemini prüfen.
- Provider-Ausfall zeigt eine verständliche Meldung ohne technische Details.
- Rate Limit greift für denselben Tester; verschiedene Tester erhalten hinter dem Proxy unterschiedliche korrekte Client-IPs.
- Fang speichern, Seite neu laden und App schließen/öffnen; lokale Daten bleiben erhalten.
- Gewässer, GPS sowie lokales und externes Backup prüfen.

Es gibt weiterhin keine Server-Datenbank und keine Cloud-Synchronisierung. Browserdaten sind an Gerät, Browserprofil und Domain gebunden; ein Domainwechsel übernimmt sie nicht automatisch.

## Private Beta – Feedback

`PUBLIC_FEEDBACK_EMAIL` enthält die bewusst öffentliche Empfängeradresse. „Feedback senden“ öffnet das lokale Mailprogramm mit dem eingegebenen Text und der App-Version. Es wird nichts automatisch versendet; der Nutzer sieht und bestätigt die Nachricht selbst. Fotos, GPS, Fänge und KI-Historie werden nicht übernommen. „Feedback kopieren“ bleibt als Fallback verfügbar.

## Private Beta – Network Check

Der Diagnose-Endpunkt ist ausschließlich bei `APP_ENV=beta` verfügbar und speichert oder zeigt keine echte IP-Adresse an.

1. Auf Gerät A `/api/beta/network-check` öffnen und `clientIpHash` notieren.
2. Den Endpunkt auf Gerät B über ein anderes Netzwerk öffnen, beispielsweise Mobilfunk statt WLAN.
3. Die Hashes vergleichen.

Unterschiedliche erkannte Client-IPs müssen unterschiedliche Hashes ergeben. Der Hash wird nur für die Antwort berechnet, auf 16 Zeichen gekürzt und nicht protokolliert oder gespeichert. Bei `APP_ENV=production` antwortet der Pfad mit 404.

## Rate Limit Test

Für einen temporären Test können beispielsweise folgende Werte in der Hosting-Umgebung gesetzt werden:

```text
RATE_LIMIT_WINDOW_MS=120000
RATE_LIMIT_MAX_REQUESTS=3
SECOND_OPINION_RATE_LIMIT_WINDOW_MS=120000
SECOND_OPINION_RATE_LIMIT_MAX_REQUESTS=3
```

Nach dem Neustart wiederholt analysieren und HTTP 429 sowie `Retry-After` prüfen. Anschließend die normalen Werte von 10 Anfragen pro 600000 ms wiederherstellen. Analyse und zweite Meinung bleiben getrennt limitiert.
