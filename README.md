# Perspectives — Benjamin H., photographe

Site portfolio immersif en 3D. On ne fait pas défiler une page : on **avance dans un couloir**
où les photographies flottent de part et d'autre, se matérialisent à l'approche et se reflètent
sur un sol invisible.

## L'expérience

- **Entrée** : écran de chargement, puis choix « avec le son » ou « en silence ».
- **Traversée** : le défilement fait avancer la caméra ; plus on va vite, plus l'image se déforme
  (aberration chromatique, distorsion, flou de vitesse).
- **Chapitres** : Bir-Hakeim, Architecture, Ville & nuit, Industrie, Nature — de grands titres
  flottants que l'on traverse.
- **Photo ouverte** : un clic, la caméra vole jusqu'à la photo et la charge en haute définition
  (flèches ← → pour naviguer, Échap pour revenir).
- **Index** : toutes les photos par chapitre, avec aperçu au survol.
- **Épilogue** : le texte « À propos » apparaît de loin au bout du couloir.
- **Son** : ambiance générée en direct, ou bande son personnelle (`son/ambiance.mp3`),
  qui réagit à la vitesse.

## Lancer le site en local

Les effets 3D nécessitent un petit serveur local (ouvrir `index.html` directement ne suffit pas).

```bash
python -m http.server 8000
```

Puis ouvrir <http://localhost:8000> dans Chrome ou Edge.

## Organisation

| Élément | Rôle |
|---|---|
| `index.html` | Structure et textes (à propos, contact) |
| `css/style.css` | Apparence |
| `js/photos.js` | Liste des photos par chapitre, bande son |
| `js/main.js` | Scène 3D et effets |
| `photos-web/` | Photos allégées utilisées par le site |
| `son/` | Bande son (facultative) |

Les originaux haute définition (`photos/`) ne sont pas publiés dans ce dépôt.
Le guide pratique (ajouter une photo, etc.) est dans [LISEZMOI.md](LISEZMOI.md).

## Technique

HTML, CSS et JavaScript, sans outil de compilation. Rendu 3D avec [Three.js](https://threejs.org/)
(r128) et des shaders GLSL sur mesure. Polices : Cormorant Garamond, Inter, IBM Plex Mono.

## Droits

- **Code** : licence MIT (voir [LICENSE](LICENSE)).
- **Photographies** : © Benjamin Hoffelé, **tous droits réservés**. Elles ne sont pas couvertes
  par la licence MIT et ne peuvent pas être réutilisées sans autorisation.
