# Pipeline SEO SERILEC — Actualités LinkedIn

## Fonctionnement automatique

1. Le workflow `.github/workflows/sync-linkedin-news.yml` cherche chaque matin les **URLs candidates** de publications SERILEC. Il ne publie aucun texte, aucune image et aucune page issue d'une découverte non validée.
2. Les URLs non reconnues sont conservées dans `data/linkedin-pending.json`, qui est exclu des sites déployés. Ce fichier constitue une **file de vérification**, pas une preuve que le post est public ou exact.
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
