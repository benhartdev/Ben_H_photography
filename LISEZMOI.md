# Perspectives — guide pratique

## Lancer le site
Les effets 3D ont besoin d'un petit serveur local. Dans Git Bash, à la racine du projet :

    python -m http.server 8000

Puis ouvre http://localhost:8000 dans Chrome ou Edge. Pour arrêter : Ctrl + C.

## Organisation des fichiers
- `index.html` : textes de la page (à propos, e-mail, liens).
- `css/style.css` : l'apparence.
- `js/photos.js` : **les univers, chapitres et photos** (fichier à modifier).
- `js/main.js` : l'expérience 3D (normalement on n'y touche pas).
- `photos/` : tes originaux (gardés sur le PC, pas envoyés sur GitHub).
- `photos-web/` : copies allégées utilisées par le site ; `photos-web/objets/` pour l'univers Écrins.
- `son/` : ta bande son (`ambiance.mp3`), facultative.

## Ajouter une photo
1. Mets l'original dans `photos/` (ou `photos/objets/` pour un objet d'art).
2. Crée sa copie allégée dans `photos-web/` (ou `photos-web/objets/`) : même nom, en JPEG,
   environ 2560 px sur le grand côté.
3. Ajoute une ligne dans le bon chapitre de `js/photos.js` :
   `{ f: "ma-photo.jpg", titre: "Mon titre", lieu: "Paris", annee: 2025 },`

## Ajouter un univers
En bas de `js/photos.js`, la liste `UNIVERS` : chaque univers a un nom, une accroche,
un sous-titre, un style (`"couloir"` ou `"ecrin"`), un dossier de photos et ses chapitres.

## Bande son
Dépose ton fichier dans `son/` sous le nom `ambiance.mp3` (ou change la ligne `MUSIQUE`
en haut de `js/photos.js`). Sans fichier, le site joue une ambiance générée.

## Enregistrer et publier tes modifications sur GitHub

    git add -A
    git commit -m "Description de ce que tu as changé"
    git push
