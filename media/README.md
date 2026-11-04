# Exercise media (videos and images)

The app never guesses file names. Media shows only when data.json says so; otherwise each exercise shows a dashed "Video coming soon" box.

## Naming
media/<protocol-id>/<exercise-key>.mp4   (or .webm, .jpg, .png)
- protocol-id: the doc "id" in data.json, e.g. acl-reconstruction-12 (shown in the admin page).
- exercise-key: lowercase exercise text with dashes, max 60 chars, e.g. "Heel slides" -> heel-slides (shown in the admin page).

## data.json
Add to the protocol (doc):
"media": { "heel-slides": { "type": "video", "src": "media/acl-reconstruction-12/heel-slides.mp4", "caption": "Heel slides" } }
type: image | video | link. src: a media/... path or an https:// link (YouTube links embed automatically).

## Easiest way
1. Open <site>/#/admin, unlock, pick the protocol, fill Type / Path / Caption for each exercise, Save edits.
2. Export updated data, then send data.json (and the media files) to Jarvis, who copies files into app/media/ and runs deploy.sh.
Keep videos short and compressed (under ~10 MB) since GitHub Pages serves them directly.
