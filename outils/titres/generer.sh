#!/bin/sh
# Redessine les titres 3D de l'univers Perspectives avec la police BankGothic Md BT
# installée sur ce PC. Le fichier de police est copié le temps du dessin puis supprimé :
# il n'est jamais publié (licence). À lancer depuis la racine du projet, dans Git Bash :
#     sh outils/titres/generer.sh
set -e
POLICE="$LOCALAPPDATA/Microsoft/Windows/Fonts/BankGothic Md BT.ttf"
[ -f "$POLICE" ] || POLICE="/c/Windows/Fonts/BankGothic Md BT.ttf"
cp "$POLICE" outils/titres/bankgothic.ttf
python -m http.server 8799 --bind 127.0.0.1 > /dev/null 2>&1 &
SERVEUR=$!
sleep 2
node outils/titres/generer.mjs "http://127.0.0.1:8799/outils/titres/titres.html" "titres/perspectives" || true
kill $SERVEUR
rm -f outils/titres/bankgothic.ttf
echo "Titres redessinés dans titres/perspectives/"
