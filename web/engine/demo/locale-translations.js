"use strict";

const additionalTranslations = new Map(`
Main menu|Menu principal|Hauptmenü|Menú principal
File|Fichier|Datei|Archivo
Edit|Édition|Bearbeiten|Edición
Tools|Outils|Werkzeuge|Herramientas
Window|Fenêtre|Fenster|Ventana
Help|Aide|Hilfe|Ayuda
Language|Langue|Sprache|Idioma
Interface language|Langue de l’interface|Sprache der Benutzeroberfläche|Idioma de la interfaz
New song|Nouveau morceau|Neuer Song|Nueva canción
Open song|Ouvrir un morceau|Song öffnen|Abrir canción
Open song…|Ouvrir un morceau…|Song öffnen…|Abrir canción…
Open songs|Morceaux ouverts|Geöffnete Songs|Canciones abiertas
Close song|Fermer le morceau|Song schließen|Cerrar canción
Save Web project|Enregistrer le projet Web|Webprojekt speichern|Guardar proyecto web
Export JJazzLab files|Exporter les fichiers JJazzLab|JJazzLab-Dateien exportieren|Exportar archivos de JJazzLab
Export JJazzLab files…|Exporter les fichiers JJazzLab…|JJazzLab-Dateien exportieren…|Exportar archivos de JJazzLab…
Export MIDI (GM)|Exporter en MIDI (GM)|MIDI (GM) exportieren|Exportar MIDI (GM)
Export WAV|Exporter en WAV|WAV exportieren|Exportar WAV
Export MP3|Exporter en MP3|MP3 exportieren|Exportar MP3
Print…|Imprimer…|Drucken…|Imprimir…
Undo|Annuler|Rückgängig|Deshacer
Redo|Rétablir|Wiederholen|Rehacer
Undo (Ctrl+Z)|Annuler (Ctrl+Z)|Rückgängig (Strg+Z)|Deshacer (Ctrl+Z)
Redo (Ctrl+Y)|Rétablir (Ctrl+Y)|Wiederholen (Strg+Y)|Rehacer (Ctrl+Y)
Copy|Copier|Kopieren|Copiar
Cut|Couper|Ausschneiden|Cortar
Paste|Coller|Einfügen|Pegar
Delete|Supprimer|Löschen|Eliminar
Duplicate|Dupliquer|Duplizieren|Duplicar
Settings|Paramètres|Einstellungen|Configuración
Preferences|Préférences|Einstellungen|Preferencias
Preferences…|Préférences…|Einstellungen…|Preferencias…
Theme|Thème|Design|Tema
Light|Clair|Hell|Claro
Dark|Sombre|Dunkel|Oscuro
Follow system|Suivre le système|Systemeinstellung übernehmen|Usar el ajuste del sistema
Font|Police|Schriftart|Fuente
Interface font|Police de l’interface|Oberflächenschrift|Fuente de la interfaz
Text color|Couleur du texte|Textfarbe|Color del texto
Version and Diagnostics…|Version et diagnostic…|Version und Diagnose…|Versión y diagnóstico…
Version and Diagnostics|Version et diagnostic|Version und Diagnose|Versión y diagnóstico
JJazzLab User Guide|Guide de l’utilisateur JJazzLab|JJazzLab-Benutzerhandbuch|Guía de JJazzLab
JJazzLab Forum|Forum JJazzLab|JJazzLab-Forum|Foro de JJazzLab
Donate to JJazzLab|Faire un don à JJazzLab|Für JJazzLab spenden|Donar a JJazzLab
Cancel|Annuler|Abbrechen|Cancelar
Close|Fermer|Schließen|Cerrar
Apply|Appliquer|Anwenden|Aplicar
Save|Enregistrer|Speichern|Guardar
Reset to Defaults|Rétablir les réglages par défaut|Standardeinstellungen wiederherstellen|Restaurar valores predeterminados
Playback|Lecture|Wiedergabe|Reproducción
Transport|Commandes de lecture|Wiedergabesteuerung|Controles de reproducción
Play|Lire|Wiedergabe|Reproducir
Stop|Arrêter|Stopp|Detener
Pause|Pause|Pause|Pausa
Playing|Lecture en cours|Wiedergabe läuft|Reproduciendo
Paused|En pause|Pausiert|En pausa
Stopped|Arrêté|Angehalten|Detenido
Play from here|Lire à partir d’ici|Ab hier wiedergeben|Reproducir desde aquí
Play selected bars|Lire les mesures sélectionnées|Ausgewählte Takte wiedergeben|Reproducir los compases seleccionados
Previous song part|Partie précédente|Vorheriger Songabschnitt|Sección anterior
Next song part|Partie suivante|Nächster Songabschnitt|Sección siguiente
Playback position|Position de lecture|Wiedergabeposition|Posición de reproducción
Metronome|Métronome|Metronom|Metrónomo
Count-in|Décompte|Einzähler|Cuenta de entrada
Two-bar count-in|Décompte de deux mesures|Zwei Takte einzählen|Cuenta de entrada de dos compases
Count-in length|Durée du décompte|Länge des Einzählers|Duración de la cuenta de entrada
Tempo (BPM)|Tempo (BPM)|Tempo (BPM)|Tempo (BPM)
Loop|Boucle|Schleife|Bucle
Loop range|Plage de boucle|Schleifenbereich|Intervalo del bucle
First bar of loop|Première mesure de la boucle|Erster Takt der Schleife|Primer compás del bucle
Last bar of loop|Dernière mesure de la boucle|Letzter Takt der Schleife|Último compás del bucle
Lead sheet|Grille d’accords|Akkordblatt|Guía de acordes
Lead sheet controls|Commandes de la grille|Akkordblatt-Steuerung|Controles de la guía de acordes
Lead sheet appearance|Affichage de la grille|Darstellung des Akkordblatts|Aspecto de la guía de acordes
Song title|Titre du morceau|Songtitel|Título de la canción
Edit chord|Modifier l’accord|Akkord bearbeiten|Editar acorde
Edit bar|Modifier la mesure|Takt bearbeiten|Editar compás
Edit bar…|Modifier la mesure…|Takt bearbeiten…|Editar compás…
Add bar|Ajouter une mesure|Takt hinzufügen|Añadir compás
Insert bar|Insérer une mesure|Takt einfügen|Insertar compás
Delete last bar|Supprimer la dernière mesure|Letzten Takt löschen|Eliminar el último compás
Bar annotation|Annotation de mesure|Taktnotiz|Nota del compás
Chord type|Type d’accord|Akkordtyp|Tipo de acorde
Chord symbol|Symbole d’accord|Akkordsymbol|Símbolo de acorde
Chord aliases|Alias d’accords|Akkord-Aliasse|Alias de acordes
Chord inspector|Inspecteur d’accords|Akkordinspektor|Inspector de acordes
Chord inspector…|Inspecteur d’accords…|Akkordinspektor…|Inspector de acordes…
Scale|Gamme|Tonleiter|Escala
Current chord|Accord actuel|Aktueller Akkord|Acorde actual
Next chord|Accord suivant|Nächster Akkord|Acorde siguiente
Song structure|Structure du morceau|Songstruktur|Estructura de la canción
Song part|Partie du morceau|Songabschnitt|Sección de la canción
Part name|Nom de la partie|Abschnittsname|Nombre de la sección
Song parts|Parties du morceau|Songabschnitte|Secciones de la canción
Add song part|Ajouter une partie|Songabschnitt hinzufügen|Añadir sección
Section|Section|Abschnitt|Sección
Section…|Section…|Abschnitt…|Sección…
Time signature|Signature rythmique|Taktart|Compás
Rhythm|Rythme|Rhythmus|Ritmo
Rhythm library…|Bibliothèque de rythmes…|Rhythmusbibliothek…|Biblioteca de ritmos…
Variation|Variation|Variation|Variación
Intensity|Intensité|Intensität|Intensidad
Fill|Break|Fill|Relleno
Accompaniment settings|Réglages de l’accompagnement|Begleiteinstellungen|Ajustes de acompañamiento
Accompaniment settings…|Réglages de l’accompagnement…|Begleiteinstellungen…|Ajustes de acompañamiento…
Preparing accompaniment…|Préparation de l’accompagnement…|Begleitung wird vorbereitet…|Preparando el acompañamiento…
Quick input|Saisie rapide|Schnelleingabe|Entrada rápida
Instrument|Instrument|Instrument|Instrumento
Volume|Volume|Lautstärke|Volumen
Pan|Panoramique|Panorama|Panorama
Mute|Muet|Stummschalten|Silenciar
Solo|Solo|Solo|Solo
Reverb|Réverbération|Hall|Reverberación
Chorus|Chorus|Chorus|Coro
Channel settings|Réglages du canal|Kanaleinstellungen|Ajustes del canal
User track|Piste utilisateur|Benutzerspur|Pista de usuario
Add user track|Ajouter une piste utilisateur|Benutzerspur hinzufügen|Añadir pista de usuario
Piano roll|Éditeur de notes|Pianorolle|Editor de notas
Select|Sélectionner|Auswählen|Seleccionar
Draw|Dessiner|Zeichnen|Dibujar
Erase|Effacer|Löschen|Borrar
Snap to grid|Aligner sur la grille|Am Raster ausrichten|Ajustar a la cuadrícula
Grid|Grille|Raster|Cuadrícula
Quantize|Quantifier|Quantisieren|Cuantizar
Velocity|Vélocité|Anschlagstärke|Velocidad
Duration|Durée|Dauer|Duración
Panel Layout|Disposition des panneaux|Fensteranordnung|Disposición de paneles
Panel Layout…|Disposition des panneaux…|Fensteranordnung…|Disposición de paneles…
Full Screen|Plein écran|Vollbild|Pantalla completa
Install App…|Installer l’application…|App installieren…|Instalar aplicación…
Built-in Synthesizer|Synthétiseur intégré|Interner Synthesizer|Sintetizador interno
Built-in Synthesizer…|Synthétiseur intégré…|Interner Synthesizer…|Sintetizador interno…
MIDI Output Settings|Réglages de la sortie MIDI|MIDI-Ausgabeeinstellungen|Ajustes de salida MIDI
Auto|Auto|Auto|Automático
Default|Par défaut|Standard|Predeterminado
`.trim().split("\n").map(line => {
    const [english, fr, de, es] = line.split("|");
    return [english, { fr, de, es }];
}));
