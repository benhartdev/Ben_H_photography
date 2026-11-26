# Perspectives — site photo de Benjamin H.

## Lancer le site
Les effets 3D ont besoin d'un petit serveur local. Dans Git Bash, à la racine du projet :

    python -m http.server 8000

Puis ouvre http://localhost:8000 dans Chrome ou Edge. Pour arrêter : Ctrl + C.

## Organisation des fichiers
- `index.html` : textes de la page (à propos, e-mail, liens).
- `css/style.css` : l'apparence.
- `js/photos.js` : **les photos, rangées par chapitre** (fichier à modifier).
- `js/main.js` : l'expérience 3D (normalement on n'y touche pas).
- `photos/` : tes originaux (le site ne les utilise pas directement).
- `photos-web/` : copies allégées (2560 px max), utilisées par le site.

## Ajouter une photo
1. Mets l'original dans `photos/`.
2. Crée sa copie allégée dans `photos-web/` (même nom de fichier, ~2560 px sur le grand côté).
3. Ajoute une ligne dans le bon chapitre de `js/photos.js` :
   `{ f: "ma-photo.jpg", titre: "Mon titre", lieu: "Paris", annee: 2025 },`
