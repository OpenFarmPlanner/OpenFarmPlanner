# CropSpecies Taxonomie-Audit

Datum: 2026-08-21

## Umfang und Datenquelle

Diese Analyse ist rein lesend erfolgt. Es wurden keine `CropSpecies`, `CropSpeciesTranslation`, `PublicCulture` oder `Culture`-Zeilen geschrieben oder verändert.

Ausgewertet wurden zwei read-only Datenquellen:

- Öffentliche Kulturbibliothek und `CropSpeciesTranslation`: lokale Entwicklungsdatenbank des App-Repos.
- Projekt `Gelawi Zwiebelzopf`: Production-Agent-API `GET /cultures/` mit Project ID 1.

Die regulären Production-Endpunkte für `public-cultures`, `crop-species` und `projects` lieferten mit dem verfügbaren Agent-Token `403`; ein Admin-/Projekt-übergreifender Read-Zugang lag nicht vor. Die öffentliche Bibliothek ist deshalb lokal analysiert, das private Projekt `Gelawi Zwiebelzopf` dagegen über die Production-Agent-API gegengeprüft.

Die Auswirkungsanalyse ist bewusst auf folgende Bereiche begrenzt:

- Öffentliche Kulturbibliothek: `CropSpecies`, `CropSpeciesTranslation`, `PublicCulture`
- Projekt `Gelawi Zwiebelzopf`: Production-Agent-API, 66 private Culture-Zeilen
- Demo-Projekt: lokal nicht angelegt; statisch aus dem Demo-Template `Solawi Sonnenacker` geprüft

Andere Projekte wurden nicht analysiert und nicht mitgezählt.

Wichtiger Befund für `Gelawi Zwiebelzopf`: In der Production-Agent-API haben alle 66 privaten Culture-Zeilen aktuell `crop_species: null`. Für eine reine CropSpecies-FK-Migration wären im Production-Projekt deshalb direkt 0 Culture-Zeilen betroffen. Zusätzlich sind unten name-basierte Prüfkandidaten genannt, weil private Gelawi-Kulturen wie `Bohne`, `Kohl`, `Salat` usw. fachlich trotzdem von einer späteren Aufräumentscheidung profitieren können.

## Vorgegebene CropSpecies-Liste Deutsch/Englisch

Die vorgegebene Liste `backend/crops/seed_data.py` wurde ebenfalls geprüft:

- 144 Einträge.
- Jeder Eintrag hat eine deutsche und eine englische Übersetzung.
- Keine exakten Duplikate in den deutschen Anzeigenamen.
- Keine exakten Duplikate in den englischen Anzeigenamen.

Auffällige fachliche Überlappungen:

| Key | Deutsch | Englisch | Bewertung |
|---|---|---|---|
| `bean` | `Bohne` | `Bean` | Zu grob neben konkreten Bohnenarten; sollte nicht als Ziel-Species für PublicCulture-Mapping verwendet werden. |
| `broad_bean` | `Ackerbohne` | `Broad bean` | Gute eigene Species für `Vicia faba`; wichtig als Trennung von Gartenbohnen. |
| `bush_bean` | `Buschbohne` | `Bush bean` | Gute engere Species für Buschbohnen; wahrscheinlich besser als `bean`. |
| `french_bean` | `Grüne Bohne` | `French bean` | Überschneidet sich mit Garten-/Busch-/Stangenbohne; manuelle Taxonomie-Entscheidung nötig, ob als eigene Species oder Synonym/Nutzung. |
| `kidney_bean` | `Kidneybohne` | `Kidney bean` | Nutzung/Samentyp innerhalb `Phaseolus vulgaris`; möglicherweise eher Synonym/Nutzung als eigene Anbau-Species. |
| `pole_bean` | `Stangenbohne` | `Pole bean` | Gute eigene Wuchsform-Species oder Untergruppe, wenn Busch/Stange getrennt geplant werden soll. |
| `runner_bean` | `Feuerbohne` | `Runner bean` | Eigene Art (`Phaseolus coccineus`), sollte nicht unter generischem `Bohne` landen. |
| `mung_bean` | `Mungbohne` | `Mung bean` | Eigene Art/Gattung, nicht mit Gartenbohne vermischen. |
| `soybean` | `Sojabohne` | `Soybean` | Eigene Art/Gattung, nicht mit Gartenbohne vermischen. |
| `lettuce` | `Salat` | `Lettuce` | Deutsch `Salat` ist potenziell zu allgemein, wenn auch Cichorium-/Asiasalat-/Kresse-Fälle darunter landen. In der lokalen öffentlichen Bibliothek aktuell nur Kopfsalat-Fall sichtbar. |
| `summer_squash` | `Zucchini` | `Zucchini` | Kein exaktes Duplikat, aber der Key ist breiter als der Anzeigename. Prüfen, ob `zucchini` als Key fachlich klarer wäre. |

Fazit zur Seed-Liste: Die Liste ist technisch vollständig und ohne exakte de/en-Duplikate, aber `bean/Bohne/Bean` sollte als zu grober Mapping-Zielwert deaktiviert, abgelehnt oder nur noch als Such-/Synonymbegriff verwendet werden.

## Prüfmethode

Geprüft wurden alle `CropSpecies` mit mehr als einer veröffentlichten `PublicCulture`-Zeile. Streng nach "mehr als eine nicht-leere Sorte" sind in der lokalen Datenquelle insbesondere `Bohne`, `Mangold` und `Tomate` relevant. Zusätzlich sind beim Audit auffällige Species-Daten mit aufgenommen, wenn Übersetzungen, Species-Status oder PublicCulture-Namen auf Fehlmapping hindeuten.

Bewertungskriterien:

- Passen Sortenname, PublicCulture-Name und Beschreibung plausibel zur selben botanischen Art/Gattung?
- Weichen Wuchsform, Aussaat-/Pflanzlogik oder Erntelogik so stark ab, dass eine gemeinsame Kulturart für Planung und Suche riskant wird?
- Deuten `CropSpeciesTranslation`-Einträge, Synonyme oder regionale Namen auf eine ungewollte Vermischung hin?
- Falls botanisch nicht eindeutig: als "unklar, manuelle Prüfung nötig" markieren.

## Kandidaten

### 1. `Bohne` (CropSpecies ID 6)

Status: `published`

Translations:

- `de`: `Bohne`
- `en`: `Bean`
- Keine Synonyme oder regionalen Namen hinterlegt.

Problem:

`Bohne` / `Bean` ist als CropSpecies-Name zu grob. In der lokalen öffentlichen Bibliothek liegen unter dieser Species zwar nur Phaseolus-nahe Einträge (`Canadian Wonder`, `Golden Teepee`), aber der Name selbst deckt im Deutschen und Englischen auch Ackerbohne/Saubohne (`Vicia faba`) ab. Das ist genau der strukturelle Risikofall: Der Species-Name verhindert nicht, dass frostempfindliche Gartenbohnen und frosttolerantere Ackerbohnen unter einer Kulturart landen.

Zusätzlich unterscheiden sich die vorhandenen Nutzungslogiken bereits innerhalb der Phaseolus-Gruppe: `Canadian Wonder` ist als Trocken-/Kidneybohne beschrieben, `Golden Teepee` als gelbe Wachs-/Frischbohne. Botanisch plausibel weiterhin `Phaseolus vulgaris`, aber für Erntefenster und Notes muss die Nutzung klar getrennt bleiben.

Betroffene Sorten / PublicCulture-Zeilen:

| PublicCulture ID | Aktuell | Vorgeschlagene Kulturart | Hinweis |
|---:|---|---|---|
| 116 | `Bohne` / leer | `Gartenbohne` oder `Buschbohne` (`Phaseolus vulgaris`), manuelle Prüfung nötig | Allgemeine Zeile enthält laut Beschreibung Red-Kidney-/Buschbohnen-Inhalte und wirkt eher sorten-/nutzungsnah als wirklich allgemein. |
| 117 | `Bohne (Canadian Wonder2)` | `Gartenbohne` / `Trockenbohne` (`Phaseolus vulgaris`) | Sortenname und Beschreibung sprechen für Red-Kidney-/Trockenbohne. `Canadian Wonder2` wirkt zusätzlich wie Test-/Duplikatname. |
| 122 | `Bohne (Golden Teepee)` | `Gartenbohne` / `Buschbohne` (`Phaseolus vulgaris`) | Gelbe Wachsbohne, plausibel `Phaseolus vulgaris`; kein Hinweis auf `Vicia faba`. |

Impact:

| Bereich | Betroffene Zeilen |
|---|---:|
| Öffentliche Bibliothek (`PublicCulture`) | 3 |
| `Gelawi Zwiebelzopf` (`Culture`, direkte `crop_species`-FKs in Production) | 0 |
| `Gelawi Zwiebelzopf` name-basiert zu prüfen | 3 (`Bohne`: `Canadian Wonder`, `Faraday`, `Golden Teepee`) |
| Demo-Projekt (`Solawi Sonnenacker` Template) | 0 |

Empfehlung:

`Bohne` als CropSpecies nicht weiter als Sammelbegriff verwenden. Mindestens trennen in:

- `Gartenbohne` / `Buschbohne` (`Phaseolus vulgaris`)
- `Ackerbohne` / `Saubohne` (`Vicia faba`)

Ob Frischbohne/Wachsbohne/Trockenbohne eigene CropSpecies oder nur Nutzungs-/Notiz-Unterscheidungen innerhalb `Phaseolus vulgaris` sein sollen, ist eine fachliche Produktentscheidung.

### 2. `Tomate` (CropSpecies ID 79)

Status: `published`

Translations:

- `de`: `Tomate`
- `en`: `Tomato`
- Keine Synonyme oder regionalen Namen hinterlegt.

Problem:

Die Species selbst ist botanisch plausibel für echte Tomateneinträge. Auffällig ist aber eine veröffentlichte PublicCulture-Zeile `t (test)`, die weder durch den Sortennamen noch durch Beschreibung oder Übersetzungen als Tomate belegbar ist. Das sieht nach Test-/Fehlmapping in der öffentlichen Bibliothek aus, nicht nach einer taxonomisch sinnvollen Sorte.

Betroffene Sorten / PublicCulture-Zeilen:

| PublicCulture ID | Aktuell | Vorgeschlagene Kulturart | Hinweis |
|---:|---|---|---|
| 136 | `t (test)` unter `Tomate` | unklar, manuelle Prüfung nötig; wahrscheinlich entfernen statt neu zuordnen | Keine botanische Zuordnung möglich. Testdaten sollten nicht als Tomaten-Sorte geführt werden. |

Nicht betroffene Tomatenzeilen:

- `Tomate` / leer
- `Tomate (Jani)`

Impact:

| Bereich | Betroffene Zeilen |
|---|---:|
| Öffentliche Bibliothek (`PublicCulture`) | 1 |
| `Gelawi Zwiebelzopf` (`Culture`, direkte `crop_species`-FKs in Production) | 0 |
| `Gelawi Zwiebelzopf` name-basiert zu prüfen | 0 für `t (test)`; echte Tomatenzeilen sind vorhanden, aber nicht dieser Fehlmapping-Fall |
| Demo-Projekt (`Solawi Sonnenacker` Template) | 0 für diesen Fehlmapping-Fall; das Template enthält Tomaten, aber keine `t (test)`-Zeile |

Empfehlung:

`t (test)` nicht still einer anderen Kulturart zuordnen. Manuell prüfen und voraussichtlich aus der öffentlichen Bibliothek entfernen.

### 3. `2` (CropSpecies ID 153)

Status: `published`

Translations:

- Keine `CropSpeciesTranslation`-Einträge vorhanden.

Problem:

Der CropSpecies-Name `2` ist kein fachlicher Kulturartname. Die zugeordneten PublicCulture-Zeilen heißen `Ackerbohne`; das deutet fachlich auf `Vicia faba`. Eine der Sorten heißt `E2E Kollaboration 1784784227996` und wirkt wie Test-/E2E-Daten.

Dieser Fall ist keine "zu grobe" taxonomische Gruppierung, sondern ein beschädigter oder testbedingter Species-Eintrag in der öffentlichen Bibliothek. Wegen des Bezugs zu `Ackerbohne` ist er für die Bohnen-Trennung trotzdem relevant.

Betroffene Sorten / PublicCulture-Zeilen:

| PublicCulture ID | Aktuell | Vorgeschlagene Kulturart | Hinweis |
|---:|---|---|---|
| 145 | `Ackerbohne` / leer unter CropSpecies `2` | `Ackerbohne` (`Vicia faba`) | Name spricht klar für Ackerbohne/Saubohne. |
| 146 | `Ackerbohne (E2E Kollaboration 1784784227996)` unter CropSpecies `2` | unklar, manuelle Prüfung nötig; wahrscheinlich Testdaten entfernen | Sortenname wirkt nicht fachlich. |

Impact:

| Bereich | Betroffene Zeilen |
|---|---:|
| Öffentliche Bibliothek (`PublicCulture`) | 2 |
| `Gelawi Zwiebelzopf` (`Culture`, direkte `crop_species`-FKs in Production) | 0 |
| `Gelawi Zwiebelzopf` name-basiert zu prüfen | 0; keine `Ackerbohne`-Zeile in Production-Agent-API sichtbar |
| Demo-Projekt (`Solawi Sonnenacker` Template) | 0 |

Empfehlung:

Eigenständige CropSpecies `Ackerbohne` / `Broad bean` mit sauberer Übersetzung verwenden. Die E2E-Zeile nicht still übernehmen, sondern manuell prüfen und vermutlich entfernen.

### 4. `Gurke2` (CropSpecies ID 152)

Status: `rejected`

Translations:

- Keine `CropSpeciesTranslation`-Einträge vorhanden.

Problem:

Unter einer abgelehnten Species `Gurke2` hängen weiterhin veröffentlichte PublicCulture-Zeilen. Die PublicCulture-Namen `Gurke` und `RS-Gu-01.25` sprechen fachlich für Gurke (`Cucumis sativus`) und damit wahrscheinlich für die existierende Species `Gurke` (ID 27), nicht für eine eigene `Gurke2`.

Das ist kein Hinweis auf botanisch zu grobe Gruppierung, aber ein starker Datenhygiene-/Moderationsfall: veröffentlichte Kulturen referenzieren eine abgelehnte oder duplizierte CropSpecies.

Betroffene Sorten / PublicCulture-Zeilen:

| PublicCulture ID | Aktuell | Vorgeschlagene Kulturart | Hinweis |
|---:|---|---|---|
| 143 | `Gurke` / leer unter `Gurke2` | `Gurke` (`Cucumis sativus`) | Wirkt wie allgemeine Gurkenzeile, aber auf abgelehnter Species. |
| 144 | `Gurke (RS-Gu-01.25)` unter `Gurke2` | `Gurke` (`Cucumis sativus`) | Sorten-/Linienname passt zu Gurke; keine fachliche Begründung für `Gurke2` sichtbar. |

Impact:

| Bereich | Betroffene Zeilen |
|---|---:|
| Öffentliche Bibliothek (`PublicCulture`) | 2 |
| `Gelawi Zwiebelzopf` (`Culture`, direkte `crop_species`-FKs in Production) | 0 |
| `Gelawi Zwiebelzopf` name-basiert zu prüfen | 1 (`Gurke (RS-Gu-01.25)`) |
| Demo-Projekt (`Solawi Sonnenacker` Template) | 0 |

Empfehlung:

PublicCulture-Zeilen von `Gurke2` auf die reguläre CropSpecies `Gurke` prüfen. Danach sollte keine veröffentlichte PublicCulture mehr auf eine abgelehnte Species zeigen.

### 5. `Karfiol` (CropSpecies ID 16)

Status: `published`

Translations:

- `de`: `Karfiol`
- `en`: `Cauliflower`

Problem:

Die CropSpecies selbst ist nicht zu grob: `Karfiol`/`Cauliflower` ist fachlich enger als `Kohl`. Auffällig ist jedoch, dass die PublicCulture-Zeilen als `Kohl` bzw. `Kohl (Di Sicilia violetto)` gespeichert sind. Das kann in UI, Suche oder Imports wie eine Vermischung aller Kohlarten wirken, obwohl die Species-Translation auf Blumenkohl/Karfiol verweist.

Betroffene Sorten / PublicCulture-Zeilen:

| PublicCulture ID | Aktuell | Vorgeschlagene Kulturart | Hinweis |
|---:|---|---|---|
| 118 | `Kohl` / leer unter `Karfiol` | `Karfiol` / `Blumenkohl` (`Brassica oleracea var. botrytis`) | PublicCulture-Name zu grob; Species wirkt korrekt. |
| 119 | `Kohl (Di Sicilia violetto)` unter `Karfiol` | `Karfiol` / `Blumenkohl` (`Brassica oleracea var. botrytis`) | Sorte passt nach Beschreibung zu violettem Blumenkohl/Karfiol. |

Impact:

| Bereich | Betroffene Zeilen |
|---|---:|
| Öffentliche Bibliothek (`PublicCulture`) | 2 |
| `Gelawi Zwiebelzopf` (`Culture`, direkte `crop_species`-FKs in Production) | 0 |
| `Gelawi Zwiebelzopf` name-basiert zu prüfen | 9 (`Kohl` allgemein plus 8 Sortenzeilen) |
| Demo-Projekt (`Solawi Sonnenacker` Template) | 0 |

Empfehlung:

Kein CropSpecies-Split nötig. PublicCulture-`name` und ggf. Notizen sollten aber nicht generisch `Kohl` sagen, wenn die Species `Karfiol` ist.

## Geprüfte Nicht-Kandidaten in der lokalen Datenquelle

Diese CropSpecies haben mehr als eine veröffentlichte PublicCulture-Zeile, wirken aber nach Sortennamen, Übersetzungen und sichtbaren Beschreibungen nicht wie eine zu grobe botanische Gruppierung:

| CropSpecies ID | Name | PublicCulture-Zeilen | Bewertung |
|---:|---|---:|---|
| 27 | `Gurke` | 2 | `Gurke` und `Arola`; beide plausibel `Cucumis sativus`. |
| 15 | `Karotte` | 2 | `Karotte` und `Nantaise 2/Milan`; beide plausibel Möhre/Karotte. |
| 109 | `Knollenfenchel` | 2 | `Knollenfenchel` und `Lorenzo`; gleiche Kulturart. Auffällig ist nur, dass die allgemeine Notiz laut Inhalt sehr sortenspezifisch wirkt. |
| 19 | `Mangold` | 3 | `Mangold`, `Luiza`, `Chard (Bright Lights)`; `Chard` ist die englische Entsprechung, keine unerwünschte Vermischung sichtbar. |
| 41 | `Salat` | 2 | `Salat` und `Grazer Krauthäuptel 2`; beide plausibel Kopfsalat/Salat. Keine Catalogna-/Cichorium-Zeile in der lokalen öffentlichen Bibliothek sichtbar. |
| 76 | `Zucchini` | 2 | `Zucchini` und `Zuboda`; gleiche Kulturart. |

## Offene Punkte vor einer Korrektur

- Production-Read-Zugang für öffentliche `CropSpecies`/`PublicCulture` klären, damit die lokale öffentliche Analyse gegen den echten Production-Stand verifiziert werden kann.
- Entscheiden, ob private Production-Cultures im Projekt `Gelawi Zwiebelzopf` künftig wieder `crop_species`-FKs bekommen sollen; aktuell liefert die Agent-API für alle 66 Zeilen `crop_species: null`.
- Entscheiden, ob `Bohne` als Species vollständig durch präzisere Species ersetzt wird oder ob `Bohne` nur als Suchsynonym auf `Gartenbohne` und `Ackerbohne` zeigen soll.
- Test-/E2E-Fälle (`t (test)`, `E2E Kollaboration ...`, `Canadian Wonder2`, Species `2`, Species `Gurke2`) manuell prüfen, bevor fachliche Migrationen geplant werden.
- Bei Karfiol prüfen, ob die PublicCulture-`name`-Werte korrigiert werden sollen, obwohl die CropSpecies selbst bereits spezifisch genug ist.
