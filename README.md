# NBS Bibliotheek

Een kleine, statische cataloguswebsite voor GitHub Pages. De website leest de
gegenereerde data uit `data/books.json` en heeft geen server of buildstap nodig.

## Publiceren met GitHub Pages

1. Push de bestanden naar GitHub.
2. Open **Settings → Pages** in de repository.
3. Kies **Deploy from a branch**, selecteer de hoofdbranch en map **/(root)**.
4. Sla op. GitHub toont daarna de URL van de website.

## De catalogus bijwerken

Installeer eenmalig Python en `openpyxl`, en voer daarna uit:

```powershell
python -m pip install openpyxl
python export_books.py
```

Het exportscript leest `Bibliotheek_Lijst_Michel.xlsx`, neemt uitsluitend de
zichtbare kolommen op en vervangt `data/books.json`. Verborgen kolommen komen
daarom ook niet terecht in zoeken of details. Commit daarna het nieuwe
JSON-bestand en het Excel-bestand.

## Lokaal bekijken

Door de browserbeveiliging moet de JSON via een lokale webserver worden geladen:

```powershell
python -m http.server 8000
```

Open vervolgens <http://localhost:8000>.
