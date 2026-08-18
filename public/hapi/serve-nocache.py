#!/usr/bin/env python3
"""Serveur statique de développement HAPI avec anti-cache.

Envoie `Cache-Control: no-store` sur chaque réponse pour que le navigateur
recharge toujours la dernière version des modules JS/CSS. Évite le problème
récurrent « je ne vois pas mes modifications » sans avoir à changer de port
ni à faire Cmd+Shift+R.

Usage : python3 serve-nocache.py [port]   (port par défaut : 8290)
Page d'entrée : http://localhost:<port>/ia/index.html
"""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

# Sert toujours depuis le dossier du script (racine du projet), quel que soit le cwd.
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8290
    print(f"Serveur anti-cache HAPI sur http://localhost:{port}/ia/index.html")
    try:
        HTTPServer(("", port), NoCacheHandler).serve_forever()
    except KeyboardInterrupt:
        pass
