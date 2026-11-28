"""Read archive entries into bounded scratch files without extracting paths."""
import json
import shutil
import struct
import stat
import sys
import zipfile
from pathlib import PurePosixPath

AUDIO = {".mp3", ".flac", ".m4a", ".wav", ".ogg", ".opus", ".aac"}
IMAGES = {".jpeg", ".jpg", ".png", ".webp", ".gif"}
MiB = 1024 * 1024


def canonical(name):
    path = PurePosixPath(name.replace("\\", "/"))
    if not path.parts or path.is_absolute() or ".." in path.parts or ":" in path.parts[0] or any(ord(c) < 32 for c in name):
        raise ValueError("Unsafe file path in archive.")
    return path.as_posix()


def members(archive, stickers=False):
    result = {}
    rows = archive.infolist()
    max_bytes = 512 * MiB if stickers else 2 * 1024 * MiB
    if len(rows) > (800 if stickers else 2400) or sum(row.file_size for row in rows) > max_bytes:
        raise ValueError("ZIP exceeds the allowed entry count or total unpacked size.")
    for row in rows:
        if row.is_dir():
            continue
        name = canonical(row.filename)
        if name in result or stat.S_ISLNK(row.external_attr >> 16):
            raise ValueError("Archive contains a duplicate or linked file.")
        path = PurePosixPath(name)
        if "__MACOSX" in path.parts or path.name in {".DS_Store", "Thumbs.db"}:
            continue
        suffix = path.suffix.lower()
        metadata_file = not stickers and path.name in {"tracks.json", "import_errors.json"}
        if not stickers and suffix not in IMAGES | AUDIO and not metadata_file:
            raise ValueError("ZIP contains an unsupported or nested file. Include only supported media and library metadata.")
        limit = (128 if not stickers and suffix in AUDIO else 5 if metadata_file else 16) * MiB
        if row.flag_bits & 1:
            raise ValueError("ZIP is password-protected. Upload an unlocked archive.")
        if not 0 < row.file_size <= limit or row.file_size > max(1, row.compress_size) * 300:
            raise ValueError("ZIP contains an entry that exceeds its size or decompression ratio limit.")
        result[name] = row
    return result


def plan(archive, files):
    manifests = [name for name in files if PurePosixPath(name).name == "tracks.json"]
    if len(manifests) > 1:
        raise ValueError("Provide one tracks.json per archive.")
    if manifests:
        name = manifests[0]
        if files[name].file_size > 5 * MiB:
            raise ValueError("tracks.json exceeds the metadata limit.")
        base = PurePosixPath(name).parent
        raw = json.loads(archive.read(files[name]))
        tracks = raw.get("tracks") if isinstance(raw, dict) else raw
        if not isinstance(tracks, list) or not tracks or len(tracks) > 1000:
            raise ValueError("tracks.json must contain 1 to 1000 tracks.")
        return [metadata(row, base, files) for row in tracks]
    tracks = [name for name in files if PurePosixPath(name).suffix.lower() in AUDIO]
    if not tracks or len(tracks) > 1000:
        raise ValueError("Provide an archive with 1 to 1000 supported audio files.")
    covers = {}
    for name in files:
        path = PurePosixPath(name)
        if path.stem.lower() in {"cover", "folder", "artwork", "album"} and path.suffix.lower() in IMAGES:
            covers.setdefault(path.parent, name)
    return [{"file": name, "image": covers.get(PurePosixPath(name).parent)} for name in tracks]


def metadata(row, base, files):
    if not isinstance(row, dict) or not isinstance(row.get("file"), str):
        raise ValueError("Each track needs an audio file reference.")
    file = (base / canonical(row["file"])).as_posix()
    if file not in files or PurePosixPath(file).suffix.lower() not in AUDIO:
        raise ValueError("tracks.json points to a missing or unsupported audio file.")
    images = row.get("images")
    if not isinstance(images, dict):
        images = {}
    image = next((value for value in [images.get("track"), images.get("album"), row.get("artwork")]
                  if isinstance(value, str) and value), None)
    image = (base / canonical(image)).as_posix() if image else None
    if image not in files or PurePosixPath(image).suffix.lower() not in IMAGES:
        image = None
    fields = {key: row[key] for key in ("_id", "title", "artist", "artists", "album", "composer", "year", "category", "tags", "license", "licenseUrl", "source") if key in row}
    return {**fields, "file": file, "image": image}



def check_zip_boundary(file):
    file.seek(0)
    if file.read(4) != b"PK\x03\x04":
        raise ValueError("ZIP header is invalid or the archive contains an executable prefix.")
    file.seek(0, 2)
    size = file.tell()
    file.seek(max(0, size - 65557))
    tail = file.read()
    position = tail.rfind(b"PK\x05\x06")
    if position < 0 or position + 22 > len(tail):
        raise ValueError("ZIP directory is missing or damaged.")
    comment = struct.unpack_from("<H", tail, position + 20)[0]
    if comment or position + 22 != len(tail):
        raise ValueError("ZIP contains an archive comment or trailing payload.")
    file.seek(0)


def main():
    command, path, *args = sys.argv[1:]
    with open(path, "rb") as source:
        check_zip_boundary(source)
    with zipfile.ZipFile(path) as archive:
        files = members(archive, command == "stickers" or command == "sticker-entry")
        if command == "stickers":
            if not 0 < len(files) <= 400:
                raise ValueError("Provide 1 to 400 sticker images.")
            print(json.dumps(list(files), ensure_ascii=True))
            return
        if command == "plan":
            print(json.dumps(plan(archive, files), ensure_ascii=True))
            return
        name, output = args
        entry = files[name]
        suffix = PurePosixPath(name).suffix.lower()
        sticker = command == "sticker-entry"
        maximum = 16 * MiB if sticker or suffix in IMAGES else 128 * MiB if suffix in AUDIO else 0
        if entry.flag_bits & 1:
            sys.exit("This audio or artwork file is password-protected. Upload an unlocked ZIP.")
        if not 0 < entry.file_size <= maximum or entry.file_size / max(1, entry.compress_size) > 500:
            raise ValueError("An archive entry exceeds its size limit.")
        with archive.open(entry) as source, open(output, "xb") as target:
            shutil.copyfileobj(source, target, length=MiB)


try:
    main()
except ValueError as error:
    sys.exit(str(error) if not isinstance(error, (UnicodeError, json.JSONDecodeError)) else "ZIP metadata is not valid UTF-8 JSON.")
except (KeyError, OSError, RuntimeError, zipfile.BadZipFile):
    sys.exit("ZIP is damaged or uses an unsupported compression method.")
