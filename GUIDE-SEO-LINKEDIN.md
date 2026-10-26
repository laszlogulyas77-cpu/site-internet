# Pipeline SEO SERILEC — Actualités LinkedIn

## Prérequis Windsor.ai (lecture seule)

- Connecter **LinkedIn Company Pages** pour la page officielle **SERILEC** dans Windsor.ai.
- Dans GitHub, sur le dépôt **laszlogulyas77-cpu/site-internet** : **Settings → Secrets and variables → Actions → Repository secrets → New repository secret**.
- Nom **exact** : `WINDSOR_API_KEY`. Valeur : la **nouvelle** clé API Windsor.ai (ne pas réutiliser une clé publiquement partagée).
- Facultatif : `WINDSOR_LINKEDIN_ACCOUNT_ID` pour restreindre le connecteur à l'identifiant d'une page si plusieurs sont accessibles. Sinon, les lignes sont filtrées par le nom de compte SERILEC.
- Les secrets **Environment** ne sont pas accessibles ici tant que le job n'est pas configuré pour cet environnement : employer un **Repository secret**.
- Le connecteur ChatGPT Windsor.ai est indépendant : il ne suffit pas de le connecter pour créer le secret GitHub.

La clé est uniquement lue par `scripts/sync-windsor-linkedin.py` lors du workflow ; aucun appel ne l'affiche ni ne l'écrit dans le dépôt. Si la clé est absente, le workflow **échoue explicitement** et n'altère pas les actualités.

### Tester la connexion

Ouvrir [Veille LinkedIn SERILEC via Windsor.ai](https://github.com/laszlogulyas77-cpu/site-internet/actions/workflows/sync-linkedin-news.yml) puis **Run workflow → main**. Le job effectue d'abord des tests sans réseau, puis interroge l'API `linkedin_organic` (champs `share_activity`, `share_text`, `share_title`, `share_published_time`, `share_audience_type_all_followers`, identifiant et nom de compte).

Le fonctionnement quotidien est déclenché à **06:23 UTC**. Les URL candidates sont sauvegardées dans `data/linkedin-pending.json` sans publication automatique. Une nouvelle URL trouvée via Windsor reste une **piste à valider** (source, caractère public, exactitude des informations), même si Windsor signale une audience publique.

## Fonctionnement automatique

1. Le workflow `.github/workflows/sync-linkedin-news.yml` interroge chaque matin **Windsor.ai LinkedIn Pages** (pas le flux agrégé `/all`). Il récupère les activités et les métadonnées de la page SERILEC en lecture seule. Il ne publie aucun contenu issu d'une découverte non validée.
2. Les activités inconnues sont conservées dans `data/linkedin-pending.json` (dates, titre, aperçu si déclaré public), fichier exclu des sites déployés. La veille vérifie l'identité SERILEC, les identifiants et les dates. Ce fichier constitue une **file de vérification**, pas une preuve définitive de publication publique.
3. Les actualités validées sont ajoutées à `data/news.json` avec `published: true` **et** leur identifiant LinkedIn est inscrit dans `data/seo-approved-activities.json`.
4. À chaque déploiement, `scripts/build-seo-news.py` génère les pages HTML, insère des liens statiques sur `actualites.html`, complète les champs `page` du JSON déployé, puis `prepare-production.py` et `augment-sitemap-articles.py` mettent à jour les métadonnées et le sitemap.
5. `python3 scripts/build-seo-news.py --verify` contrôle les pages, canonical, dates, ordre chronologique, liens et sitemap. **Tout échec bloque le déploiement.**

Les articles éditoriaux existants sont préservés. Les pages automatiques ont une URL stable `/actualites/linkedin-ACTIVITY_ID.html`. Les actualités courtes ou génériques peuvent être publiées en `noindex`, sans figurer dans le sitemap.

## Validation manuelle d'une nouvelle publication

- Ouvrir l'URL dans `data/linkedin-pending.json` et vérifier sur LinkedIn : **compte SERILEC**, publication réellement publique, **date**, titre, texte complet, image et absence de doublon.
- Ajouter uniquement les faits confirmés dans `data/news.json` (champs `title`, `date`, `category`, `excerpt`, `content`, `link`, `image` si le fichier existe, `alt`, `published: true`). Ne pas inventer de client, de montant, de résultat ni de prestation.
- Ajouter l'**activity_id** à `data/seo-approved-activities.json`. Le seul champ `published: true` ne suffit pas : le déploiement refuse un identifiant non approuvé.
- Supprimer l'URL de la file `data/linkedin-pending.json` si elle y figure, puis committer sur `main`.
- Vérifier les workflows [OVH](https://github.com/laszlogulyas77-cpu/site-internet/actions/workflows/deploy-ovh.yml) et [GitHub Pages](https://github.com/laszlogulyas77-cpu/site-internet/actions/workflows/deploy-pages.yml), puis consulter la nouvelle URL et le [sitemap](https://www.groupe-serilec.fr/sitemap.xml).

## Sécurité et limites

- Les **33 identifiants historiques** dans la liste d'approbation correspondent aux actualités déjà publiées sur le site lors de l'activation du pipeline. Leur présence dans cette liste n'est pas une nouvelle vérification indépendante de LinkedIn.
- Une URL candidate n'est **jamais** publiée automatiquement, même si un moteur de recherche la signale. Les publications nouvelles doivent être approuvées.
- Une date incohérente avec l'identifiant LinkedIn, un doublon ou une publication sans approbation explicite font échouer la préparation.
- Le programme ne peut pas garantir la découverte de tous les posts : LinkedIn peut limiter l'accès aux contenus publics. Une revue éditoriale reste nécessaire.
- Les contenus du site sont générés **au moment du déploiement** : les fichiers HTML automatiques et les champs `page` enrichis ne sont pas committés individuellement dans GitHub.
