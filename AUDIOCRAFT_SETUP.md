# AudioCraft Local Music Setup

This runs Facebook AudioCraft/MusicGen locally and lets the Discord bot call it with:

```txt
!music create cyberpunk song theme
!music lyrics I am lost in neon lights
```

AudioCraft is heavy. The official repo says it requires Python 3.9 and PyTorch 2.1.0. MusicGen works best with a GPU; `facebook/musicgen-small` can run on CPU, but it will be slow.

## 1. Create Python Environment

Use Python 3.9.

```bash
python -m venv .venv-audiocraft
```

Windows:

```bash
.venv-audiocraft\Scripts\activate
```

Linux:

```bash
source .venv-audiocraft/bin/activate
```

## 2. Install AudioCraft

CPU/basic install:

```bash
python -m pip install -r requirements-audiocraft.txt
```

If you have NVIDIA GPU, install the correct PyTorch CUDA build from pytorch.org first, then install AudioCraft:

```bash
python -m pip install setuptools wheel
python -m pip install audiocraft
```

Also install FFmpeg on the machine. AudioCraft uses it when writing audio.

## 3. Start Local AudioCraft Server

```bash
python scripts/audiocraft_server.py
```

Default server:

```txt
http://127.0.0.1:7868
```

Optional environment settings:

```env
AUDIOCRAFT_HOST=127.0.0.1
AUDIOCRAFT_PORT=7868
AUDIOCRAFT_MODEL=facebook/musicgen-small
AUDIOCRAFT_DURATION=20
```

## 4. Connect Bot To AudioCraft

Add this to the bot `.env`:

```env
AUDIOCRAFT_API_URL=http://127.0.0.1:7868
```

Restart the Discord bot after editing `.env`.

Now `!music create` and `!music lyrics` will try local AudioCraft first. If it is not running, the bot falls back to Hugging Face if `HF_API_KEY` is set.
