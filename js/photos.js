/* =========================================================
   TES PHOTOS, RANGÉES PAR CHAPITRE
   ---------------------------------------------------------
   - DOSSIER_PHOTOS : le dossier où sont les images
   - chaque chapitre a un titre, un sous-titre et ses photos
   - pour chaque photo :
       f      : nom du fichier
       titre  : nom affiché (titres provisoires : change-les !)
       lieu, annee : facultatifs
       w, h   : largeur / hauteur en pixels (facultatif, évite un
                petit "saut" de format au chargement)
   L'ordre ici = l'ordre dans lequel on les découvre en avançant.
   ========================================================= */

const DOSSIER_PHOTOS = "photos-web/";   // copies allégées (les originaux restent dans photos/)

/* BANDE SON
   Mets ton fichier dans le dossier son/ et écris son nom ici.
   Laisse "" pour garder l'ambiance générée automatiquement. */
const MUSIQUE = "son/ambiance.mp3";

const CHAPITRES = [
  {
    titre: "Bir-Hakeim",
    sousTitre: "Le viaduc, la nuit",
    photos: [
      { f: "Bir Hakeim le mastodonte.jpg", titre: "Le mastodonte", lieu: "Paris", w: 5906, h: 3795 },
      { f: "BENH8111-Modifier.jpg", titre: "Perspective", lieu: "Paris", w: 5609, h: 2626 },
      { f: "BENH9926-Modifier.jpg", titre: "Symétrie", lieu: "Paris", w: 3840, h: 5120 },
      { f: "BENH9921-Modifier-Modifier.jpg", titre: "Colonnade", lieu: "Paris", w: 5699, h: 2533 },
      { f: "BENH9920-Modifier.jpg", titre: "Pilier de nuit", lieu: "Paris", w: 5346, h: 3564 },
      { f: "bir-hakeim-light_300dpi_180_79_98.jpg", titre: "Lumières", lieu: "Paris", w: 21260, h: 9447 },
      { f: "ben-H7041_clean.jpg", titre: "L'arche", lieu: "Paris", w: 5577, h: 3584 },
      { f: "BENH7331_300dpi_180cm.jpg", titre: "Rive droite", lieu: "Paris", w: 21260, h: 9338 }
    ]
  },
  {
    titre: "Architecture",
    sousTitre: "Lignes, courbes et vertiges",
    photos: [
      { f: "Sans-titre-H--1.jpg", titre: "Sans titre", w: 5716, h: 2858 },
      { f: "ben H.ben H.BENH7258 - Mod - Mod.jpg", titre: "Grande Arche", lieu: "La Défense", w: 3936, h: 5906 },
      { f: "248A0730-3.jpg", titre: "Alvéoles", w: 2971, h: 2971 },
      { f: "ben H_dsc_0596_2.jpg", titre: "Dentelle de fer", lieu: "Tour Eiffel", w: 2848, h: 4288 },
      { f: "Benjamin Hoffelé Zaragoza 2015 Pasarela del voluntariado dos .jpg", titre: "Pasarela del Voluntariado", lieu: "Saragosse", annee: 2015, w: 4227, h: 2378 },
      { f: "ben H.BENH7270 - Mod-Modifier-Modifier-2.JPG", titre: "Reflet de l'Arche", lieu: "La Défense", w: 9358, h: 14082 },
      { f: "BENH0106-Modifier.jpg", titre: "Spirale", w: 7178, h: 5022 },
      { f: "BENH7140-Modifier.jpg", titre: "Courbes", lieu: "La Défense", w: 16304, h: 23622 },
      { f: "wipeout_100_100_300dpi_web.jpg", titre: "Wipeout", w: 11811, h: 11811 },
      { f: "Jardin-des-plantes-300dpi_75_100_web.jpg", titre: "Grandes serres", lieu: "Jardin des Plantes", w: 8858, h: 11816 },
      { f: "ben H.ben H.BENH3507 - Mod-4 - Mod.jpg", titre: "Structure", w: 3840, h: 2503 },
      { f: "prison_300dpi_100_150_web.jpg", titre: "Prison", w: 11811, h: 17715 },
      { f: "IMG_6181-Modifier.jpg", titre: "Fenêtre", w: 3029, h: 4512 }
    ]
  },
  {
    titre: "Ville & nuit",
    sousTitre: "Quand la ville s'allume",
    photos: [
      { f: "eiffel-4.jpg", titre: "Dame de fer", lieu: "Paris", w: 4011, h: 2665 },
      { f: "248A5242-Modifier.jpg", titre: "Traînées de lumière", w: 5760, h: 3840 },
      { f: "BENH7159-Modifier-Modifier.jpg", titre: "Descente", w: 5739, h: 2660 },
      { f: "Arbre-300dpi_60_90_web.jpg", titre: "L'arbre", w: 7087, h: 10630 },
      { f: "248A3444-catalogue_srvb.jpg", titre: "Ruelle", w: 5379, h: 3026 },
      { f: "BENH8589.jpg", titre: "Quai", w: 5734, h: 2867 }
    ]
  },
  {
    titre: "Industrie",
    sousTitre: "La beauté des machines",
    photos: [
      { f: "BENH4884-Modifier.jpg", titre: "Le colosse", w: 15748, h: 10499 },
      { f: "Autoportrait-300dpi_80_53_34.jpg", titre: "Autoportrait", w: 9449, h: 6300 },
      { f: "BENH4950-Modifier-Modifier.jpg", titre: "Coursive", w: 5401, h: 2480 },
      { f: "BENH6644-Modifier.jpg", titre: "Souterrain", w: 5626, h: 2491 },
      { f: "BENH0708-Modifier.jpg", titre: "Chantier naval", w: 5760, h: 2880 },
      { f: "BENH2182-Modifier-Modifier.jpg", titre: "Locomotive", w: 5749, h: 3234 },
      { f: "BENH2188-Modifier.jpg", titre: "En gare", w: 5724, h: 2544 }
    ]
  },
  {
    titre: "Nature",
    sousTitre: "Le vivant, en plein vol",
    photos: [
      { f: "248A9205-Modifier.jpg", titre: "Atterrissage", w: 5760, h: 3240 },
      { f: "248A9156-Modifier.jpg", titre: "Envol", w: 5134, h: 2888 },
      { f: "248A9161.jpg", titre: "Le chasseur", w: 5760, h: 3840 },
      { f: "ETREUTAT.jpg", titre: "La chapelle", lieu: "Étretat", w: 5760, h: 3240 },
      { f: "Au-petit-reveil_300dpi_130_70_web.jpg", titre: "Au petit réveil", w: 15354, h: 8267 },
      { f: "BENH1491-Modifier.jpg", titre: "La passerelle", w: 4754, h: 2377 }
    ]
  }
];

/* =========================================================
   UNIVERS « ÉCRINS » — OBJETS D'ART
   (copies allégées dans photos-web/objets/)
   ========================================================= */
const CHAPITRES_OBJETS = [
  {
    titre: "L'Œil",
    sousTitre: "Une fente de lumière dans la matière",
    photos: [
      { f: "37.jpg", titre: "Iris", w: 2560, h: 1440 },
      { f: "38.jpg", titre: "Regard", w: 2560, h: 1440 },
      { f: "42.jpg", titre: "Fêlure", w: 2560, h: 1510 },
      { f: "43.jpg", titre: "Lisière", w: 2560, h: 1502 }
    ]
  },
  {
    titre: "Indigo",
    sousTitre: "Matières profondes",
    photos: [
      { f: "BENH1397-Edit-Edit.jpg", titre: "Lune bleue", w: 2560, h: 2560 },
      { f: "BENH1403-Edit.jpg", titre: "Sédiments", w: 2560, h: 1517 },
      { f: "BENH1405-Edit.jpg", titre: "Glacier", w: 2560, h: 1552 }
    ]
  },
  {
    titre: "Plumes",
    sousTitre: "Le souffle et le fil",
    photos: [
      { f: "BENH1868-Edit-Edit.jpg", titre: "Envolée", w: 2560, h: 2560 },
      { f: "BENH1877-Edit-Edit - Copie-tif.jpg", titre: "Tourbillon", w: 2560, h: 2560 },
      { f: "BENH1898-Edit - Copie-tif.jpg", titre: "Nid", w: 2560, h: 1707 },
      { f: "BENH1901-Edit.jpg", titre: "Duvet", w: 2560, h: 1499 }
    ]
  },
  {
    titre: "Dentelle",
    sousTitre: "L'or sur la nuit",
    photos: [
      { f: "BENH1945-Edit.jpg", titre: "Médaillon", w: 2560, h: 2560 },
      { f: "BENH1972-Edit ok - Copie-tif.jpg", titre: "Broderie", w: 1920, h: 2560 },
      { f: "BENH1973-Edit.jpg", titre: "Fil d'or", w: 2560, h: 1509 }
    ]
  },
  {
    titre: "Constellation",
    sousTitre: "L'ensemble",
    photos: [
      { f: "compo-tableau-cat.jpg", titre: "La constellation", w: 2560, h: 1606 }
    ]
  }
];
/* Doublons laissés de côté : BENH1403-Edit-tif.jpg (version TIFF de BENH1403-Edit.jpg),
   BENH1921-Edit-Edit.jpg (quasi identique à 38.jpg) */

/* =========================================================
   LES UNIVERS (l'ordre = l'ordre dans le menu « Univers »)
   style : "couloir" (galerie noire) ou "ecrin" (objets sous projecteur)
   ========================================================= */
const UNIVERS = [
  { nom: "Perspectives", accroche: "Photographies", sousTitre: "Une traversée en noir et blanc", style: "couloir", dossier: DOSSIER_PHOTOS, chapitres: CHAPITRES },
  { nom: "Écrins", accroche: "Objets d'art", sousTitre: "La matière sous la lumière", style: "ecrin", dossier: "photos-web/objets/", chapitres: CHAPITRES_OBJETS }
];

/* Doublons laissés de côté (même image que d'autres fichiers) :
   BENH4968-Modifier-Modifier.jpg, cemex_pano_300dpi_130_70_web.jpg,
   bir hakeim 8111_400dpi_agran_150cm.jpg, bir-hakeim-pont-massif-120_77_12_300dpi_web.jpg */
