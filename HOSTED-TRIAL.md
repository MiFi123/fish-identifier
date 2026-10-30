# Fischmodell-Test auf Render

Die bestehende App bleibt unter `/` erreichbar. Der zusätzliche Test liegt unter `/versuch/` und verwendet ausschließlich den eigenen CPU-Modellprozess. Er ist mit `LOCAL_LAB_ENABLED=true` aktivierbar und ansonsten nicht registriert.

Render-Konfiguration:

- Build: `bash scripts/render-build.sh`
- Start: `npm start` (unverändert)
- Healthcheck: `/api/health` (unverändert)
- Laufzeit: Node, zusätzlich vorhandenes Python 3
- Keine neuen API-Schlüssel nötig

Der Build installiert eine separate ONNX-Laufzeit in `.model-venv`. Die umfangreichere PyTorch-Umgebung `.export-venv` wird nur während der Modellkonvertierung gebraucht. Die offiziellen Fishial-Pakete werden aus `model-sources.json` heruntergeladen, per SHA-256 geprüft und in ONNX umgewandelt. Die Referenzdaten werden ohne leere Füllplätze gespeichert; es gehen keine echten Referenzen verloren. Modelle und Umgebungen werden nicht in Git eingecheckt.

Zur Laufzeit werden ausschließlich ONNX Runtime, NumPy und Pillow importiert. Ein einzelner Modellprozess mit jeweils einer Bildanalyse begrenzt den Speicherverbrauch. Der Hauptserver und das bestehende Fangbuch bleiben unabhängig erreichbar, wenn das Modell noch startet oder ausfällt. Der Test hat eigene IP-Limits und Same-Origin-Prüfungen. Bilder werden nur im Arbeitsspeicher ausgewertet und nicht dauerhaft gespeichert oder an externe KI-Dienste gesendet.

Die UI weist auf die Übertragung zum Testserver hin. Die vorhandenen Profilarten, Modellgrenzen und nicht kalibrierten Bildabstände bleiben sichtbar. Es gibt keine Aussage über eine nachgewiesene Erkennungsgenauigkeit. Der Test benötigt eine Verbindung zum eigenen Server; die Modelle laufen in dieser Variante nicht direkt auf dem Handy.

Prüfen:

```text
npm run test:hosted
npm test
.model-venv/bin/python scripts/smoke-hosted.py
```

Der Modelltest prüft die mitgelieferte Schleie und ein erzeugtes leeres Bild. Bei neuem Build müssen beide Fälle erneut geprüft werden. Bildsammlungen unabhängiger Nutzer sind für eine Qualitätsbewertung weiterhin erforderlich.
