"""Check OPC archives without extracting files or resolving XML resources."""
import io
import re
import struct
import stat
import sys
import zipfile
from pathlib import PurePosixPath
from xml.etree import ElementTree

MIB = 1024 * 1024
UNSAFE_XML = re.compile(rb"<!\s*(doctype|entity)\b", re.I)



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


def validate(data, kind):
    family = "word" if kind == "docx" else "xl"
    main = "word/document.xml" if kind == "docx" else "xl/workbook.xml"
    source = io.BytesIO(data)
    check_zip_boundary(source)
    with zipfile.ZipFile(source) as archive:
        entries = archive.infolist()
        if len(entries) > 600 or sum(item.file_size for item in entries) > 48 * MIB:
            raise ValueError("Office document expands beyond the 48 MiB unpacked limit.")
        names = set()
        for item in entries:
            if item.is_dir():
                continue
            path = PurePosixPath(item.filename)
            name = path.as_posix()
            if (path.is_absolute() or ".." in path.parts or "\\" in item.filename or not path.parts
                    or ":" in path.parts[0] or name in names or stat.S_ISLNK(item.external_attr >> 16)):
                raise ValueError("Office document contains an unsafe or duplicate entry path.")
            if item.flag_bits & 1:
                raise ValueError("Office document is encrypted and cannot be checked.")
            names.add(name)
            if item.file_size > 16 * MIB or item.file_size > max(1, item.compress_size) * 300:
                raise ValueError("Office document contains an entry that exceeds the decompression limit.")
            lower = name.lower()
            if ("vbaproject" in lower or "activex" in lower or "/embeddings/" in lower
                    or "externallinks/" in lower or "connections.xml" in lower or "customui/" in lower):
                raise ValueError("Office document contains macros, linked data, or embedded objects.")
            if not (lower.endswith((".xml", ".rels")) or (
                    (lower.startswith(f"{family}/media/") or lower.startswith("docprops/"))
                    and lower.endswith((".jpg", ".jpeg", ".png")))):
                raise ValueError("Office document contains an unsupported or executable entry.")
            part = archive.read(item)
            if lower.endswith((".xml", ".rels")):
                clean = part.decode("utf-8-sig")
                if "\x00" in clean or UNSAFE_XML.search(part):
                    raise ValueError("Office document contains an unsupported XML encoding, DTD, or entity.")
                for node in ElementTree.fromstring(clean).iter():
                    tag = node.tag.rsplit("}", 1)[-1].lower()
                    if (tag in {"oleobject", "altchunk", "fldsimple", "instrtext", "externalreference"}
                            or node.attrib.get("TargetMode", "").lower() == "external"
                            or node.attrib.get("Target", "").lower().startswith(("http:", "https:", "file:", "//"))):
                        raise ValueError("Office document contains an active field or external reference.")
                    if tag == "f" and re.search(r"\[|\b(dde|webservice|hyperlink|rtd|call|register\.id)\b", node.text or "", re.I):
                        raise ValueError("Spreadsheet contains a formula that can access external data.")
            elif lower.endswith(".png"):
                if not part.startswith(b"\x89PNG\r\n\x1a\n") or not part.endswith(b"IEND\xaeB`\x82"):
                    raise ValueError("Embedded PNG has an invalid signature or trailing data.")
            elif not (part.startswith(b"\xff\xd8\xff") and part.endswith(b"\xff\xd9")):
                raise ValueError("Embedded JPEG has an invalid signature or trailing data.")
        if not {"[Content_Types].xml", main}.issubset(names):
            raise ValueError(f"Archive is missing the required {kind.upper()} document parts.")


try:
    validate(sys.stdin.buffer.read(25 * MIB + 1), sys.argv[1])
except ValueError as error:
    sys.exit(str(error))
except (RuntimeError, UnicodeError, zipfile.BadZipFile, ElementTree.ParseError):
    sys.exit("Office document is damaged or cannot be securely parsed.")
