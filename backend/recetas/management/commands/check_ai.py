import os
import subprocess
import tempfile
import time

from django.core.management.base import BaseCommand

from recetas.utils import (
    GEMINI_MODEL,
    call_ideas,
    convert_audio_to_mp3,
    extract_recipe_from_audio,
    extract_recipe_from_text,
)

SAMPLE_TEXT = "Panqueques: 2 huevos, 250 ml de leche, 120 g de harina. Batir todo y cocinar en sartén con manteca."
SAMPLE_SPEECH = (
    "Tortilla de papas. Necesitás cuatro papas, tres huevos y media cebolla. "
    "Primero freí las papas y la cebolla. Después mezclalas con los huevos batidos "
    "y cociná la tortilla de los dos lados."
)


class Command(BaseCommand):
    help = "Hace una llamada de prueba a Gemini por cada uso (texto, audio e Ideas) y muestra si anda."

    def add_arguments(self, parser):
        parser.add_argument("--audio", help="Archivo de audio propio. Sin esto, en macOS se genera uno con `say`.")

    def probar(self, name, fn):
        start = time.monotonic()
        try:
            result = fn()
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ {name}: {e}"))
            return False
        ok = bool(result)
        style = self.style.SUCCESS if ok else self.style.ERROR
        self.stdout.write(style(f"{'✓' if ok else '✗'} {name} ({time.monotonic() - start:.1f}s)"))
        if result:
            self.stdout.write(f"  {result}")
        return ok

    def handle(self, *args, **options):
        self.stdout.write(f"Modelo: {GEMINI_MODEL}")
        results = [
            self.probar("Texto", lambda: extract_recipe_from_text(SAMPLE_TEXT, strict_mode=True)),
            self.probar("Ideas", lambda: call_ideas(
                "algo rápido con huevo",
                [{"uuid": "1", "title": "Tortilla de papas", "categories": [], "ingredients": ["huevo", "papa"], "prep_time": 30}],
            )),
        ]

        with tempfile.TemporaryDirectory() as tmp:
            audio = options["audio"]
            if not audio:
                audio = os.path.join(tmp, "prueba.aiff")
                try:
                    subprocess.run(["say", "-v", "Paulina", "-o", audio, SAMPLE_SPEECH], check=True, capture_output=True)
                except (OSError, subprocess.CalledProcessError):
                    self.stdout.write(self.style.WARNING("- Audio: salteado (pasá --audio <archivo>)"))
                    audio = None
            if audio:
                results.append(self.probar(
                    "Audio",
                    lambda: extract_recipe_from_audio(convert_audio_to_mp3(audio), "", require_audio=True),
                ))

        if not all(results):
            raise SystemExit(1)
