# Import anglaisfacile.com → Neurone

```bash
python3 extract.py <cache_dir> debutants-index.tsv <cache_dir>/raw.json
python3 build.py <cache_dir>/raw.json ../../src
```

Produit `src/courses/anglais-debutant.json`, `src/courses/index.json` et télécharge les audios dans `src/audio/anglais/`.
