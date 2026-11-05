# Audio fixtures

`tone.ogg` is one second of a 440 Hz sine tone, mono, Ogg/Opus at 48 kHz. It holds no speech.

```sh
ffmpeg -f lavfi -i "sine=frequency=440:duration=1" -ar 48000 -ac 1 -c:a libopus -b:a 16k tone.ogg
```
