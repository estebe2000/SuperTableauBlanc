// Fichier : modules/generation/activities/interactive-map-generator.js
import { JSZip, logger } from '../generator-utils.js';
import { escapeHtml, sanitizeRichHtml, safeUrl } from '../../utils/sanitize.js';

// ✅ NOUVEAU : Helper pour encoder l'audio en Base64 (contourne le blocage file:// des navigateurs)
const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

export async function genererZIPInteractiveMap(donnees) {
    logger.log(`🗺️ Génération Carte Interactive pour "${donnees.titre}"...`);
    const zip = new JSZip();

    // 1. Traitement des marqueurs, images ET audio
    const markersProcessed = [];
    for (let i = 0; i < donnees.markers.length; i++) {
        const marker = donnees.markers[i];
        let imgPath = "";
        let audioPath = ""; 
        let isIframe = false;

        // Traitement de l'image
        if (marker.img_url) {
            if (marker.img_url.toLowerCase().startsWith('<iframe')) {
                isIframe = true;
                imgPath = marker.img_url;
            } else {
                try {
                    const response = await fetch(marker.img_url);
                    const fileBuffer = await response.arrayBuffer();
                    const fileName = `marker_${i}_${Date.now()}.jpg`;
                    zip.file(`images/${fileName}`, fileBuffer, { binary: true });
                    imgPath = `images/${fileName}`;
                } catch (e) {
                    logger.error("Erreur image:", e);
                    imgPath = marker.img_url;
                }
            }
        }

        // ✅ NOUVEAU : Traitement Audio (Base64 + Sauvegarde physique)
        if (marker.audio) {
            try {
                audioPath = await blobToBase64(marker.audio); // Encodage pour le lecteur HTML
                
                // Sauvegarde physique dans le ZIP
                const audioBuffer = await marker.audio.arrayBuffer();
                const ext = marker.audio.name ? marker.audio.name.split('.').pop() : 'wav';
                const audioFileName = `audio_${i}_${Date.now()}.${ext}`;
                zip.file(`audio/${audioFileName}`, audioBuffer, { binary: true });
            } catch (e) {
                logger.error("Erreur lors de l'enregistrement de l'audio:", e);
            }
        }

        // Assainissement avant embarquement : ces champs sont injectés via innerHTML
        // dans le paquet généré (puis ouvert sur un LMS) → on neutralise tout XSS ici.
        markersProcessed.push({
            ...marker,
            title: escapeHtml(marker.title),
            date: escapeHtml(marker.date),
            caption: escapeHtml(marker.caption),
            credit: escapeHtml(marker.credit),
            desc: sanitizeRichHtml(marker.desc),
            img_url: isIframe ? sanitizeRichHtml(imgPath) : safeUrl(imgPath),
            isIframe: isIframe,
            color: escapeHtml(marker.color || "#0369a1"),
            audio_url: safeUrl(audioPath) // Contient désormais le flux Base64
        });
    }

    // ✅ NOUVEAU : Traitement de l'audio d'introduction
    let introAudioBase64 = "";
    if (donnees.introAudio) {
        try {
            introAudioBase64 = await blobToBase64(donnees.introAudio);
            const audioBuffer = await donnees.introAudio.arrayBuffer();
            const ext = donnees.introAudio.name ? donnees.introAudio.name.split('.').pop() : 'wav';
            zip.file(`audio/intro_audio_${Date.now()}.${ext}`, audioBuffer, { binary: true });
        } catch (e) {
            logger.error("Erreur intro audio:", e);
        }
    }

    // 2. Fichier de données
    const dataJsContent = `const MAP_DATA = ${JSON.stringify({
        titre: donnees.titre, // rendu via innerText côté paquet → pas d'échappement (sinon &amp; visible)
        intro: sanitizeRichHtml(donnees.intro),
        introAudio: introAudioBase64, // Injection intro
        langue: donnees.langue || 'Français',
        style: donnees.style,
        isSwipeMode: donnees.isSwipeMode,
        styleLeft: donnees.styleLeft,
        styleRight: donnees.styleRight,
        isTourMode: donnees.isTourMode,
        tourDuration: donnees.tourDuration,
        tourLineColor: donnees.tourLineColor,
        tourLineStyle: donnees.tourLineStyle,
        markers: markersProcessed
    }, null, 2)};`;
    zip.file("data.js", dataJsContent);

    // 3. Template HTML
    const htmlTemplate = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Carte Interactive</title>
    <link rel="stylesheet" href="./libs/leaflet.css" />
    <link rel="stylesheet" href="./libs/leaflet.fullscreen.css" />
    <style>
        @font-face{font-family:'Marianne';src:url('fonts/Marianne-Regular.woff2') format('woff2');font-weight:400;font-display:swap}@font-face{font-family:'Marianne';src:url('fonts/Marianne-Bold.woff2') format('woff2');font-weight:700;font-display:swap}
        body { font-family: 'Marianne', 'Segoe UI', Roboto, system-ui, -apple-system, sans-serif; margin: 0; display: flex; height: 100vh; background: #f8fafc; }
        #sidebar { width: 350px; padding: 25px; overflow-y: auto; background: white; box-shadow: 2px 0 15px rgba(0,0,0,0.05); z-index: 1000; display: flex; flex-direction: column; flex-shrink: 0; }
        #map { flex-grow: 1; height: 100%; position: relative; z-index: 1; }
        .popup-img { width: 100%; max-width: 250px; border-radius: 8px; margin: 10px 0; }
        h1 { font-family: 'Marianne', Georgia, 'Times New Roman', serif; color: #1e3c72; margin-top: 0; }
        hr { border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0; }
        #tour-controls {
            position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: rgba(255, 255, 255, 0.95); padding: 10px 20px; border-radius: 30px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 9999; display: flex; gap: 15px;
            align-items: center; backdrop-filter: blur(5px); border: 1px solid #e2e8f0;
        }
        #tour-controls button {
            background: #0369a1; color: white; border: none; border-radius: 50%;
            width: 40px; height: 40px; font-size: 16px; cursor: pointer; display: flex;
            align-items: center; justify-content: center; transition: all 0.2s;
        }
        #tour-controls button:hover { transform: scale(1.1); background: #075985; }
        #tour-controls button#btn-play { width: auto; border-radius: 20px; padding: 0 20px; font-weight: bold; font-size: 14px; }
        #tour-countdown { font-size: 14px; font-weight: bold; color: #ef4444; min-width: 45px; text-align: center; }
    </style>
</head>
<body>
    <div id="sidebar">
        <h1 id="ui-title"></h1>
        <p id="ui-intro" style="line-height: 1.5; color: #334155;"></p>
        <hr>
        <p style="color: #64748b; font-size: 0.9em;"><i>💡 Cliquez sur les repères pour plus de détails.</i></p>
    </div>
    <div id="map"></div>
    <div id="tour-controls" style="display: none;">
        <button id="btn-reset" title="Vue globale">⟲</button>
        <button id="btn-prev">⏮</button>
        <button id="btn-play">▶️ Démarrer</button>
        <button id="btn-next">⏭</button>
        <span id="tour-countdown" style="display: none;"></span>
    </div>
    <script src="./libs/leaflet.js"></script>
    <script src="./libs/leaflet-side-by-side.min.js"></script>
    <script src="./libs/Leaflet.fullscreen.min.js"></script>
    <script src="data.js"></script>
    <script>
        window.onload = function() {
            document.title = MAP_DATA.titre;
            document.getElementById('ui-title').innerText = MAP_DATA.titre;
            document.getElementById('ui-intro').innerHTML = MAP_DATA.intro;
            
            // ✅ INJECTION DU LECTEUR AUDIO D'INTRO
            if (MAP_DATA.introAudio) {
                var introAudioHtml = '<div style="margin: 15px 0; text-align: center;"><audio controls src="' + MAP_DATA.introAudio + '" style="width: 100%; height: 35px; outline: none;"></audio></div>';
                document.getElementById('ui-intro').innerHTML += introAudioHtml;
            }
            
            var map = L.map('map', { fullscreenControl: true }).setView([46.2, 2.2], 5);

            var tourControls = document.getElementById('tour-controls');
            map.getContainer().appendChild(tourControls);
            L.DomEvent.disableClickPropagation(tourControls);

            function getDynamicTileUrls(langue) {
                var osmUrl = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
                if (langue === 'German' || langue === 'Allemand') {
                    osmUrl = 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';
                } else if (langue !== 'Français' && langue !== 'French') {
                    osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
                }
                return {
                    'voyager': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
                    'osm': osmUrl,
                    'satellite': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
                    'topo': 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
                    'ign_cassini': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.CASSINI&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
                    'ign_1950': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS.1950-1965&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
                };
            }

            var tileStyles = getDynamicTileUrls(MAP_DATA.langue);

            if (MAP_DATA.isSwipeMode) {
                var left = L.tileLayer(tileStyles[MAP_DATA.styleLeft]).addTo(map);
                var right = L.tileLayer(tileStyles[MAP_DATA.styleRight]).addTo(map);
                L.control.sideBySide(left, right).addTo(map);

                setTimeout(function() {
                    var slider = document.querySelector('.leaflet-sbs-range');
                    if (slider) {
                        L.DomEvent.disableClickPropagation(slider);
                        slider.addEventListener('mousedown', function() { map.dragging.disable(); });
                        slider.addEventListener('touchstart', function() { map.dragging.disable(); }, {passive: true});
                        window.addEventListener('mouseup', function() { map.dragging.enable(); });
                        window.addEventListener('touchend', function() { map.dragging.enable(); });
                    }
                }, 200); 
            } else {
                L.tileLayer(tileStyles[MAP_DATA.style || 'osm']).addTo(map);
            }
        
            var bounds = [], markersArray = [], latlngs = [];
            MAP_DATA.markers.forEach(function(m, i) {
                var pinColor = m.color || '#0369a1';
                var customIcon = L.divIcon({
                    className: 'custom-pin',
                    html: '<svg viewBox="0 0 24 36" width="28" height="42"><path fill="' + pinColor + '" stroke="#fff" stroke-width="2" d="M12 0C5.373 0 0 5.373 0 12c0 7.632 10.334 22.548 11.235 23.865a1 1 0 0 0 1.53 0C13.666 34.548 24 19.632 24 12c0-6.627-5.373-12-12-12zm0 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>',
                    iconSize: [28, 42], iconAnchor: [14, 42], popupAnchor: [0, -38]
                });

                var marker = L.marker([m.lat, m.lng], { icon: customIcon }).addTo(map);
                latlngs.push([m.lat, m.lng]);
                bounds.push([m.lat, m.lng]);
                markersArray.push(marker);

            var media = m.isIframe ? 
                '<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:10px 0 5px 0;border-radius:6px;background:#000;">' + m.img_url.replace('<iframe', '<iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen') + '</div>' : 
                (m.img_url ? '<div style="text-align:center;"><img src="' + m.img_url + '" class="popup-img" style="margin-bottom:5px;"></div>' : '');

            var captionHtml = m.caption ? 
                '<div style="font-size:0.85em; font-weight:bold; color:#334155; text-align:center; margin-bottom:2px;">' + m.caption + '</div>' : 
                '';

            var creditHtml = m.credit ? 
                '<div style="font-size:0.7em; font-style:italic; color:#94a3b8; text-align:center; margin-bottom:10px;">© ' + m.credit + '</div>' : 
                '';

            // ✅ INJECTION DU LECTEUR AUDIO POUR LE MARQUEUR
            var audioHtml = m.audio_url ? 
                '<div style="margin: 10px 0; text-align: center;"><audio controls src="' + m.audio_url + '" style="width: 100%; height: 35px; outline: none;"></audio></div>' : 
                '';

            var couleurDate = m.color || '#0369a1';

            var popupContent = '<b style="font-size:1.1em; color:#0f172a;">' + m.title + '</b><br><small style="color:' + couleurDate + '; font-weight:bold;">' + m.date + '</small>' + 
                               media + 
                               captionHtml + 
                               creditHtml + 
                               audioHtml + 
                               '<div style="margin-top:10px; border-top:1px solid #f1f5f9; padding-top:10px;">' + m.desc + '</div>';

                marker.bindPopup(popupContent, { minWidth: 280 });
                marker.on('click', function() {
                    if(window.stopTour) stopTour();
                    var baseZoom = parseInt(m.zoom) || 12;
                    var zoomCompense = baseZoom + 1; 
                    map.flyTo([m.lat, m.lng], zoomCompense, { animate: true, duration: 1.2 });
                });
            });

            if (MAP_DATA.isTourMode && latlngs.length > 1) {
                document.getElementById('tour-controls').style.display = 'flex';
                var dash = MAP_DATA.tourLineStyle === 'dashed' ? '10,10' : (MAP_DATA.tourLineStyle === 'dotted' ? '2,8' : '');
                L.polyline(latlngs, { color: MAP_DATA.tourLineColor, weight: 4, dashArray: dash, opacity: 0.6 }).addTo(map);

                var tourIdx = -1, isPlaying = false, timer = null;
                var btnPlay = document.getElementById('btn-play'), cd = document.getElementById('tour-countdown');

                window.stopTour = function() {
                    isPlaying = false; 
                    clearInterval(timer);
                    cd.style.display = 'none'; 
                    btnPlay.innerHTML = "▶️ Reprendre";
                };

                function playNext() {
                    if(!isPlaying) return;
                    tourIdx++;

                    if(tourIdx >= MAP_DATA.markers.length) {
                        stopTour(); 
                        map.fitBounds(bounds, { padding: [50,50] });
                        tourIdx = -1; 
                        btnPlay.innerHTML = "▶️ Relancer"; 
                        return;
                    }

                    var m = MAP_DATA.markers[tourIdx];
                    var baseZoom = parseInt(m.zoom) || 12;
                    var zoomCompense = baseZoom + 1;

                    map.flyTo([m.lat, m.lng], zoomCompense, { duration: 1.5 });

                    map.once('moveend', function() {
                        markersArray[tourIdx].openPopup();
                        var left = MAP_DATA.tourDuration;
                        cd.style.display = 'inline'; 
                        cd.innerText = "⏱ " + left + "s";
    
                        timer = setInterval(function() {
                            left--; 
                            cd.innerText = "⏱ " + left + "s";
                            if(left <= 0) { 
                                clearInterval(timer); 
                                playNext(); 
                            }
                        }, 1000);
                    });
                }

                btnPlay.onclick = function() {
                    if(isPlaying) stopTour();
                    else { isPlaying = true; btnPlay.innerHTML = "⏸️ Pause"; playNext(); }
                };
                document.getElementById('btn-next').onclick = function() { stopTour(); tourIdx++; if(tourIdx < MAP_DATA.markers.length) markersArray[tourIdx].fire('click'); };
                document.getElementById('btn-prev').onclick = function() { stopTour(); tourIdx--; if(tourIdx >= 0) markersArray[tourIdx].fire('click'); };
            }

            document.getElementById('btn-reset').onclick = function() {
                if(window.stopTour) stopTour();
                map.fitBounds(bounds, { padding: [50, 50] });
            };

            if (MAP_DATA.markers.length === 1) {
                var uniqueMarker = MAP_DATA.markers[0];
                var baseZoom = parseInt(uniqueMarker.zoom) || 12;
                map.setView([uniqueMarker.lat, uniqueMarker.lng], baseZoom + 1);
            } else if (bounds.length > 1) {
                map.fitBounds(bounds, { padding: [50, 50] });
            } else {
                map.setView([46.2276, 2.2137], 5);
            }
        };
    </script>
</body>
</html>`;

    zip.file("index.html", htmlTemplate);

    // RGPD : on embarque Leaflet + plugins dans le paquet (libs/), plus aucun
    // appel à unpkg / jsDelivr / Mapbox côté élève. Seules les tuiles de fond
    // restent servies par leur fournisseur (OSM-France par défaut, souverain).
    const libsText = {
        'libs/leaflet.css': '../../../../vendor/leaflet/leaflet.css',
        'libs/leaflet.js': '../../../../vendor/leaflet/leaflet.js',
        'libs/leaflet-side-by-side.min.js': '../../../../vendor/leaflet-side-by-side/leaflet-side-by-side.min.js',
        'libs/Leaflet.fullscreen.min.js': '../../../../vendor/leaflet-fullscreen/Leaflet.fullscreen.min.js',
        'libs/leaflet.fullscreen.css': '../../../../vendor/leaflet-fullscreen/leaflet.fullscreen.css',
    };
    const libsBinary = {
        'libs/images/marker-icon.png': '../../../../vendor/leaflet/images/marker-icon.png',
        'libs/images/marker-icon-2x.png': '../../../../vendor/leaflet/images/marker-icon-2x.png',
        'libs/images/marker-shadow.png': '../../../../vendor/leaflet/images/marker-shadow.png',
        'libs/images/layers.png': '../../../../vendor/leaflet/images/layers.png',
        'libs/images/layers-2x.png': '../../../../vendor/leaflet/images/layers-2x.png',
        'libs/fullscreen.png': '../../../../vendor/leaflet-fullscreen/fullscreen.png',
        'libs/fullscreen@2x.png': '../../../../vendor/leaflet-fullscreen/fullscreen@2x.png',
    };
    try {
        for (const [dest, rel] of Object.entries(libsText)) {
            zip.file(dest, await (await fetch(new URL(rel, import.meta.url).href)).text());
        }
        for (const [dest, rel] of Object.entries(libsBinary)) {
            zip.file(dest, await (await fetch(new URL(rel, import.meta.url).href)).arrayBuffer(), { binary: true });
        }
    } catch (e) {
        logger.error("Embarquement des libs Leaflet échoué : " + e.message);
    }

    // Charte : police Marianne (souveraine) embarquée dans le paquet.
    for (const __mf of ['Marianne-Regular.woff2', 'Marianne-Bold.woff2']) {
        try { zip.file('fonts/' + __mf, await (await fetch(new URL('../../../../css/fonts/' + __mf, import.meta.url).href)).arrayBuffer(), { binary: true }); } catch (__e) {}
    }

    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return { blob, fileName: `carte-interactive-${Date.now()}.zip` };
}