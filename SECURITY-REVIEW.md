# Anwendungscode: Sicherheitsprüfung vom 28. Oktober 2026

Geprüft wurden Express-Routen, Upload-Verarbeitung, Proxy-/Origin-Verhalten,
Ratenbegrenzung, Analyse-Speicher und Zweitanalyse, Provider-Requests und
Fehlerbehandlung sowie die DOM-Ausgaben und lokalen Backup-/Speicherwege im
Frontend. Eine Suche nach typischen eingecheckten Schlüsseln und privaten
Schlüsseln in versionierten Anwendungsdateien hatte keine Treffer.

## Behoben und gehärtet

- **Unbegrenzte Ressourcenbindung:** Analyse-Uploads und Provider-Aufrufe teilen
  sich ein Limit von vier gleichzeitigen Vorgängen je Prozess. Ein abgebrochener
  Browserrequest gibt den Platz erst frei, wenn der Provider-Aufruf beendet ist.
  Der Zweitanalyse-Speicher hält höchstens 32 Einträge mit zusammen 64 MiB
  Bilddaten. Laufende Einträge bleiben bis zum Abschluss in der Kapazitätszählung;
  danach werden ihre Bilddaten auch im Fehlerfall freigegeben.
- **Unbegrenzte IP-Verwaltung:** Die Ratenbegrenzung entfernt abgelaufene Clients
  und begrenzt ihre Tabelle auf 10.000 Einträge. Sie verwendet feste Zeitfenster;
  die konfigurierten Limits bleiben erhalten.
- **Upload-Validierung:** Produktionsanalysen akzeptieren genau eine Bilddatei
  ohne zusätzliche Multipart-Felder. Bekannte Dateisignaturen müssen zum
  angegebenen MIME-Typ passen. Das ersetzt keine vollständige Bilddekodierung.
  Der nur lokal verfügbare Benchmark behält sein kleines `repetitions`-Feld.
  Multipart-Fehler liefern 400 bzw. bei Größenüberschreitung 413. Explizite
  HTTP-Zeitlimits begrenzen auch langsame Uploads.
- **Fremde Webseiten als Auslöser kostenpflichtiger Analysen:** API-POSTs mit
  fremdem Origin oder `Sec-Fetch-Site: cross-site` werden vor dem Upload und
  Provider-Aufruf abgewiesen. Direkte API-Clients ohne diese Browserheader
  bleiben möglich; dies ersetzt keine Authentifizierung.
- **Vertraulichkeit und Provider-Härtung:** API-Antworten verwenden `no-store`.
  Der Gemini-Schlüssel steht im `x-goog-api-key`-Header statt in der URL, wie in
  der [Gemini-Referenz](https://ai.google.dev/api) dokumentiert. Provider-Aufrufe
  folgen keinen Redirects und senden so Bilddaten/Zugangsdaten nicht an ein
  unerwartetes Redirect-Ziel. Ein tatsächlicher Schlüsselabfluss wurde nicht
  nachgewiesen.

## Validierung

`npm test` führt die 14 bisherigen Testgruppen und zusätzlich sechs
Sicherheits-Tests mit Node.js 24.22.1 aus. Diese prüfen Speicher-/IP-Grenzen,
abgebrochene Anfragen, Bildsignaturen, echte lokale HTTP-Uploads, Origin-Sperren,
Cache-Header und Provider-Requestoptionen. Erfolgreiche Analysen werden mit einem
Testprovider geprüft; missbräuchliche Uploads erreichen ihn nicht. Die
Schlüssel-/Redirect-Prüfungen verwenden simulierte Fishial-/Gemini-Antworten.
Nach dem Deployment werden Seiten, Assets und API-Healthchecks erneut geprüft.

## Grenzen

Kein unabhängiger vollständiger Penetrationstest und keine Garantie allgemeiner
Fehlerfreiheit. Echte kostenpflichtige KI-Aufrufe, Provider-Kontoberechtigungen
und die Gerätefunktionen Kamera/GPS wurden nicht erneut vollständig getestet.
Die API bleibt absichtlich öffentlich. Verteilte Clients können grundsätzlich
weiter API-Kosten verursachen; für einen größeren öffentlichen Betrieb sind
zusätzliche Zugangs- oder Kontingentregeln sinnvoll. Analyse-IDs sind weiterhin
zufällige, kurzlebige Zugriffscodes. Lokale Fangdaten bleiben auf dem jeweiligen
Endgerät und wurden nicht an externe Dienste übertragen.
