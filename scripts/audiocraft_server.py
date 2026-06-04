import json
import os
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


HOST = os.getenv("AUDIOCRAFT_HOST", "127.0.0.1")
PORT = int(os.getenv("AUDIOCRAFT_PORT", "7868"))
MODEL_NAME = os.getenv("AUDIOCRAFT_MODEL", "facebook/musicgen-small")
DEFAULT_DURATION = int(os.getenv("AUDIOCRAFT_DURATION", "20"))

_model = None
_model_lock = threading.Lock()
_generation_lock = threading.Lock()


def _json_error(handler, status, message):
    body = json.dumps({"error": message}).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _load_model():
    global _model
    with _model_lock:
        if _model is not None:
            return _model

        import torch
        from audiocraft.models import MusicGen

        device = "cuda" if torch.cuda.is_available() else "cpu"
        try:
            _model = MusicGen.get_pretrained(MODEL_NAME, device=device)
        except TypeError:
            _model = MusicGen.get_pretrained(MODEL_NAME)
            if hasattr(_model, "to"):
                _model.to(device)
        print(f"AudioCraft loaded {MODEL_NAME} on {device}", flush=True)
        return _model


def _generate_music(prompt, duration):
    from audiocraft.data.audio import audio_write

    model = _load_model()
    model.set_generation_params(duration=duration)

    with _generation_lock:
        wav = model.generate([prompt])

    with tempfile.TemporaryDirectory(prefix="akashsuu-audiocraft-") as temp_dir:
        output_base = Path(temp_dir) / "music"
        audio_write(
            str(output_base),
            wav[0].cpu(),
            model.sample_rate,
            strategy="loudness",
            loudness_compressor=True,
        )
        return output_base.with_suffix(".wav").read_bytes()


class AudioCraftHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            body = json.dumps({"ok": True, "model": MODEL_NAME}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        _json_error(self, 404, "Not found")

    def do_POST(self):
        if self.path != "/generate":
            _json_error(self, 404, "Not found")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            prompt = str(payload.get("prompt") or payload.get("inputs") or "").strip()
            duration = int(payload.get("duration") or DEFAULT_DURATION)
            duration = max(4, min(duration, 60))

            if not prompt:
                _json_error(self, 400, "Missing prompt")
                return

            audio = _generate_music(prompt[:1200], duration)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
        except Exception as exc:
            _json_error(self, 500, str(exc))

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} - {fmt % args}", flush=True)


def main():
    server = ThreadingHTTPServer((HOST, PORT), AudioCraftHandler)
    print(f"AudioCraft server listening on http://{HOST}:{PORT}", flush=True)
    print("POST /generate with JSON: {\"prompt\":\"cyberpunk song\", \"duration\":20}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
