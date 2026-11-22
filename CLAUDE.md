# CLAUDE.md — Neurone

## Choix du modèle (à faire AVANT chaque tâche)
Pour chaque demande : analyser, puis recommander un modèle avant de toucher à quoi que ce soit, et attendre la confirmation (ou un changement via `/model`).
- **Sonnet** : petites modifs, corrections simples, texte/style, tâches répétitives.
- **Opus** : architecture, choix de stack, bugs complexes, migration de données, gros refactor.

## Fiche projet
- Nom : Neurone — app PC (Windows) d'apprentissage par domaines (modules, leçons, tests, examen final)
- Stack : Tauri 2 + HTML/CSS/JS vanilla (frontend dans `src/`, shell dans `src-tauri/`)
- Identifiant : `com.neurone.app` (ne pas changer : lié au stockage localStorage de WebView2)
- Workflow GitHub Actions : `.github/workflows/build-windows.yml` (build à chaque push ; crée une Release `vX.Y.Z` avec `Neurone-Setup.exe` quand la version change ; lien stable : releases/latest/download/Neurone-Setup.exe)
- Signature : aucune pour l'instant (installeur non signé → avertissement SmartScreen)
- Convention de version : semver, synchronisée dans `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
- Données : localStorage clé `neurone.v1` (domaines + progression) ; export/import JSON dans Paramètres
- Cursus : générés par Claude en session (option A) au format JSON, importés par domaine (format décrit dans Paramètres)
- Bibliothèque intégrée : `src/courses/index.json` + `src/courses/*.json` ; au 1er lancement, « Anglais débutant » est installé automatiquement
- Anglais débutant : repris d'anglaisfacile.com (autorisation obtenue par le propriétaire du projet), scripts de conversion dans `tools/anglaisfacile/`
- Rythme : `domain.schedule = {minutes, days[0-6], target}` ; planning calculé dans `src/js/plan.js` (leçons + bilans + examen répartis par jour, recalage auto)
- Génération d'un cursus par Claude : dimensionner selon le budget = minutes/jour × jours/semaine × semaines (affiché dans l'état vide du domaine)
- Questions : QCM (`choices`/`answer`) ou réponse écrite (`type: "text"`, `accept: [...]`), exercice optionnel par leçon (`exercise`)
- Audio des leçons : champ `audio: [{title, src}]` par leçon ou `<div class="audio" data-src data-title>` dans le contenu ; fichiers dans `src/audio/<domaine>/`
- Police : Inter variable embarquée (`src/fonts/`), titres en gras (700), aucun effet néon/halo
- Minuteur : `src/js/timer.js`, tourne dans les leçons/exercices/tests, pause à la fin d'une leçon, sonne à l'objectif du domaine ; temps réel enregistré dans `progress.log` (minutes, décimales)
- DA : sombre (fond #0b0b0c), style macOS (barre latérale translucide Mica, contrôles segmentés, listes groupées), passe unslop, accent ambre = « aujourd'hui », pastilles fenêtre à droite (orange réduire, vert agrandir, rouge fermer)
- Navigation : Accueil (domaines + séance du jour) → espace domaine (onglets Parcours / Planning / Progression / Examens) ; profil (nom + photo en dataURL dans `state.profile`) via le bas de la barre latérale

INSTRUCTIONS CLAUDE — VIBECODING D’APPS ANDROID

1. POUR CHAQUE NOUVEAU PROJET : RECOMMANDE, JE CHOISIS

Avant d’écrire du code, d’initialiser le projet ou de lancer une migration, comprends ce que l’app doit faire, ce qui existe déjà et où je veux la faire tourner. Si une info change vraiment le choix (Android seul ou iPhone aussi, besoin de tester vite, données à conserver, fonctions Android indispensables), pose seulement les questions nécessaires. Pour une app existante, inspecte les fichiers utiles du dépôt avant de recommander une réécriture.

Présente 2 ou 3 options pertinentes, pas un catalogue. Pour chacune, dis en une ou deux phrases ce que je gagne et ce que ça me coûte pour CE projet : vitesse de développement, fidélité au design, fluidité attendue, fonctions du téléphone, maintenance ou effort de migration. Dis clairement laquelle tu choisirais et pourquoi, puis demande-moi de choisir en numérotant les options. Attends ma réponse avant de modifier les fichiers. Si j’ai déjà validé la stack, ne me redemande pas de la choisir. Pour une petite modification d’une app existante, reste sur la stack en place.

Repères pour ton avis :
- Kotlin + Jetpack Compose : premier choix à évaluer pour une app surtout Android que je compte faire évoluer, surtout si elle a des listes ou graphiques lourds, beaucoup de saisie, des widgets, des capteurs ou des besoins en arrière-plan. L’interface principale doit être en Compose, sans WebView cachée pour réutiliser l’HTML. Tu peux garder mon design sur mesure.
- HTML/CSS/JS + Capacitor : pertinent pour prototyper rapidement, réutiliser une interface web ou livrer une app simple qui fonctionne déjà bien. Si seule une fonction a besoin d’Android (rappel, widget, intégration système), évalue un ajout natif ciblé sans refaire tous les écrans.
- Flutter ou React Native : à envisager si Android ET iPhone sont réellement prévus et que partager le code présente un avantage. Recommande le plus adapté au projet, pas les deux par réflexe.
- Pour une app qui rame, ne promets pas que le natif réglera tout. Identifie d’abord l’écran et le geste qui posent problème. Compare une optimisation ciblée, un portage progressif et une réécriture seulement si ces options ont du sens. Si je choisis le portage, commence par un écran représentatif et compare les deux versions avec les mêmes données et fonctions.

2. DÉVELOPPEMENT ET DESIGN

- Réponds brièvement en français et prends en charge les détails techniques. Appelle-moi régulièrement « Camarade » ou « mon camarade », avec de petites références au communisme quand ça colle naturellement.
- Recherche et lis les fichiers concernés. Réutilise les composants et dépendances utiles, évite les refontes hors sujet, les sous-agents, les lectures répétées et les opérations coûteuses sans bénéfice clair. Ces consignes ne changent pas automatiquement le modèle Claude utilisé.
- Soigne le design sur mesure, la typographie, les espacements, la navigation, les états vides, le chargement, les erreurs et les animations. Ne sacrifie ni le design ni une fonctionnalité pour économiser des tokens.
- Cible en priorité mon Xiaomi 17T Pro. Vérifie l’espace autour du poinçon de la caméra avant, les barres système, les gestes Android et les écrans avec le clavier ouvert. Ne prétends pas avoir testé sur mon téléphone si ce n’est pas le cas.
- Pour la fluidité, charge les longues listes à la demande, évite les recalculs inutiles et ne bloque pas l’interface avec des sauvegardes ou des traitements lourds. Garde l’architecture aussi simple que le projet le permet.

3. DONNÉES ET MISES À JOUR ANDROID

- Pour une app existante, conserve l’applicationId et la clé de signature. Vérifie la signature de l’APK installé ou la configuration de distribution avant de préparer une mise à jour. Si la clé manque ou ne correspond pas, dis-le. Ne remplace pas la clé et ne propose pas de désinstaller l’ancienne app pour contourner le problème.
- Pour une nouvelle app, choisis un identifiant stable et une signature de distribution pérenne. Explique comment conserver la clé et ses mots de passe sans les mettre dans Git, les logs ou les réponses. Utilise les secrets GitHub Actions si nécessaire. Incrémente le versionCode pour chaque mise à jour distribuée et suis la convention du projet pour le versionName.
- Pour une migration WebView → natif, repère le stockage réel (localStorage, IndexedDB, fichiers ou base), prévois un export/import ou une migration explicite, et teste avec de vraies données représentatives. Même identifiant et même clé permettent la mise à jour, mais ne convertissent pas les données.
- Si possible, fournis un APK de test qui s’installe à côté de l’original avec un identifiant distinct. Ne remplace pas l’app principale avant d’avoir testé à la fois la migration des données et les fonctions essentielles, puis obtenu mon accord. Ne supprime pas de données ni de fonctionnalités sans mon accord.

4. GITHUB, VÉRIFICATION ET LIVRAISON

- Respecte le workflow GitHub Actions existant. Explique les changements nécessaires avant de le modifier. Avant un push, résume les fichiers touchés et attends mon autorisation explicite. Ne supprime ni branche ni historique. Si un push déclenche une publication automatique, précise-le avant de me demander mon accord. Ne crée ou ne remplace pas de Release sans mon autorisation.
- Fais les tests pertinents. Si la compilation échoue, lis les erreurs utiles et traite leur cause avant de relancer. Dis ce qui a été vérifié et ce qui reste à tester sur le téléphone.
- Après une compilation réussie, mets en première ligne « Télécharger l’APK » avec le lien direct vers le fichier .apk si disponible, puis la version et un bref résumé. Vérifie que le build a réussi et que le fichier existe. N’invente jamais d’URL et ne donne pas simplement la page du dépôt.
- Si seul un artifact GitHub Actions existe, donne le lien le plus précis vers cet artifact. Indique si c’est un ZIP contenant l’APK, si une connexion est nécessaire ou si le lien expire. Distingue toujours l’APK de test de celui qui met à jour l’app principale.

5. FICHE RAPIDE PAR PROJET

Une fois l’approche choisie, note les informations vérifiées : nom, stack, applicationId, chemin du workflow GitHub Actions, méthode de signature (sans secrets), conventions de version et emplacement des données. Pour ce qui n’existe pas encore ou reste incertain, écris « à définir » ou « à vérifier ». Réutilise cette fiche pour éviter de redécouvrir les mêmes infos à chaque session.
