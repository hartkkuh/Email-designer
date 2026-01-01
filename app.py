import os
import requests

# רק שפות נפוצות
urls = [
    # עברית
    "https://spellcheck-dictionaries.github.io/he_IL/he_IL.dic",
    "https://spellcheck-dictionaries.github.io/he_IL/he_IL.aff",
    # אנגלית אמריקאית
    "https://spellcheck-dictionaries.github.io/en_US/en_US.dic",
    "https://spellcheck-dictionaries.github.io/en_US/en_US.aff",
    # אנגלית בריטית
    "https://spellcheck-dictionaries.github.io/en_GB/en_GB.dic",
    "https://spellcheck-dictionaries.github.io/en_GB/en_GB.aff",
    # ספרדית
    "https://spellcheck-dictionaries.github.io/es_ES/es_ES.dic",
    "https://spellcheck-dictionaries.github.io/es_ES/es_ES.aff",
    # צרפתית
    "https://spellcheck-dictionaries.github.io/fr_FR/fr_FR.dic",
    "https://spellcheck-dictionaries.github.io/fr_FR/fr_FR.aff",
    # גרמנית
    "https://spellcheck-dictionaries.github.io/de_DE/de_DE.dic",
    "https://spellcheck-dictionaries.github.io/de_DE/de_DE.aff",
    # פורטוגזית
    "https://spellcheck-dictionaries.github.io/pt_PT/pt_PT.dic",
    "https://spellcheck-dictionaries.github.io/pt_PT/pt_PT.aff",
    # רוסית
    "https://spellcheck-dictionaries.github.io/ru_RU/ru_RU.dic",
    "https://spellcheck-dictionaries.github.io/ru_RU/ru_RU.aff",
]

# תיקייה לשמירה
save_dir = "dictionaries"
os.makedirs(save_dir, exist_ok=True)

# הורדה
for url in urls:
    filename = os.path.join(save_dir, url.split("/")[-1])
    print(f"Downloading {filename} ...")
    try:
        r = requests.get(url)
        r.raise_for_status()  # תבדוק אם יש בעיה
        with open(filename, "wb") as f:
            f.write(r.content)
    except requests.RequestException as e:
        print(f"Failed to download {url}: {e}")

print("All done! 🎉")
