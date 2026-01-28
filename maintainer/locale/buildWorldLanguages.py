#!/usr/bin/env python
"""Build a worldlanguages-style JSON with Locale entries from worlddetails.json.

Reports:
- LanguageName values without a mapping
- Mapped locales not present in content/locale
- Conflicting LanguageName values for the same LanguageId
"""

from __future__ import annotations

import json
import os
import sys
from typing import Dict, List, Set, Tuple

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LOCALE_DIR = os.path.join(ROOT, "content", "locale")
OUTPUT_FILENAME = "worldlanguages.json"

# Hard-coded mapping of English (UK) LanguageName -> locale
LANGUAGE_NAME_TO_LOCALE: Dict[str, str] = {
    "Albanian": "sq",
    "Arabic": "ar",
    "Azərbaycanca": "az",
    "Indonesian": "id",
    "Bosnian": "bs",
    "Bulgarian": "bg",
    "Català": "ca",
    "Česky": "cs",
    "Dansk": "da",
    "Deutsch": "de",
    "Estonian": "et",
    "English (UK)": "en-GB",
    "English (US)": "en-US",
    "Español, España": "es-ES",
    "Español, Latinoamericano": "es-CR",
    "Español, Rioplatense": "es-AR",
    "Euskara": "eu",
    "Français": "fr",
    "Frysk": "fy-NL",
    "Furlan": "fur-IT",
    "Galego": "gl",
    "Georgian": "ka",
    "Hebrew": "he",
    "Hrvatski": "hr",
    "Íslenska": "is",
    "Italiano": "it",
    "Latviešu": "lv",
    "Lëtzebuergesch": "lb",
    "Lietuvių": "lt",
    "Magyar": "hu",
    "Nederlands": "nl",
    "Norsk, bokmål": "no",
    "Norsk, nynorsk": "nn-NO",
    "Persian": "fa",
    "Polski": "pl",
    "Português": "pt-PT",
    "Português, Brasil": "pt-BR",
    "Romanian": "ro",
    "Slovensky": "sk",
    "Slovenščina": "sl",
    "Suomi": "fi",
    "Svenska": "sv-SE",
    "Tiếng Việt": "vi",
    "Türkçe": "tr",
    "Vlaams": "vls-BE",
    "Ellinika": "el",
    "Belarusian": "be",
    "Macedonian": "mk",
    "Russian": "ru",
    "Srpski": "sr",
    "Ukrainian": "uk",
    "Chinese": "zh-CN",
    "Korean": "ko",
    "Japanese": "ja",
}



def load_supported_locales() -> Set[str]:
    locales: Set[str] = set()
    for entry in os.listdir(LOCALE_DIR):
        full = os.path.join(LOCALE_DIR, entry)
        if os.path.isdir(full):
            locales.add(entry)
    return locales


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: build_league_locale_map.py <path-to-worlddetails.json>")
        return 2

    input_path = os.path.abspath(sys.argv[1])
    output_path = os.path.join(os.path.dirname(input_path), OUTPUT_FILENAME)

    with open(input_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    leagues = data.get("HattrickData", {}).get("LeagueList", [])
    supported_locales = load_supported_locales()

    language_by_id: Dict[str, str] = {}
    missing_language_names: List[Tuple[str, str, str]] = []
    missing_locale_mappings: List[Tuple[str, str]] = []
    mismatched_locales: List[Tuple[str, str]] = []
    conflicting_language_names: List[Tuple[str, str, str]] = []

    for league in leagues:
        league_id = str(league.get("LeagueID", "")).strip()
        lang_name = str(league.get("LanguageName", "")).strip()
        lang_id_raw = str(league.get("LanguageId", "")).strip()

        if not lang_id_raw:
            missing_language_names.append((league_id, lang_name, lang_id_raw))
            continue

        if lang_id_raw in language_by_id and language_by_id[lang_id_raw] != lang_name:
            conflicting_language_names.append((lang_id_raw, language_by_id[lang_id_raw], lang_name))
        else:
            language_by_id[lang_id_raw] = lang_name

    # Write output
    language_list = []
    for lang_id in sorted(language_by_id.keys(), key=lambda v: int(v)):
        lang_name = language_by_id[lang_id]
        locale = LANGUAGE_NAME_TO_LOCALE.get(lang_name)
        if not locale:
            missing_locale_mappings.append((lang_id, lang_name))
        elif locale not in supported_locales:
            mismatched_locales.append((lang_id, locale))
        language_list.append({
            "LanguageID": lang_id,
            "LanguageName": lang_name,
            "Locale": locale,
        })

    output_payload = {"HattrickData": {"LanguageList": language_list}}

    with open(output_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(output_payload, fh, ensure_ascii=False, indent=2)

    # Report
    print(f"Wrote {len(language_list)} languages to: {output_path}")

    if missing_language_names:
        print("\nMissing LanguageName mapping (leagueId, LanguageName, LanguageId):")
        for league_id, lang_name, lang_id in missing_language_names:
            print(f"  {league_id}: {lang_name!r} (LanguageId={lang_id})")

    if missing_locale_mappings:
        print("\nMissing LanguageName -> Locale mapping (LanguageId, LanguageName):")
        for lang_id, lang_name in missing_locale_mappings:
            print(f"  {lang_id}: {lang_name!r}")

    if mismatched_locales:
        print("\nMapped locale not found in content/locale (LanguageId, locale):")
        for lang_id, locale in mismatched_locales:
            print(f"  {lang_id}: {locale}")

    if conflicting_language_names:
        print("\nConflicting LanguageName for LanguageId (LanguageId, FirstName, NewName):")
        for lang_id, first_name, new_name in conflicting_language_names:
            print(f"  {lang_id}: {first_name!r} vs {new_name!r}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
