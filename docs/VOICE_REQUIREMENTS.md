# Voice requirements — V3, after the v0.1 practice preview

These are saved requirements, not current implementation tasks.

- Use Apple Speech; never a cloud transcription API.
- Check SFSpeechRecognizer.supportsOnDeviceRecognition.
- Set requiresOnDeviceRecognition = true on the audio-buffer request.
- If unsupported, unavailable or denied, retain touch. Never silently remove
  the flag or route audio to a server.
- Request microphone and Speech permissions explicitly with accurate Info.plist
  text when implementing V3, not during V1.
- Use a small distinct command set and test start/stop-type confusions.
- SFCustomLanguageModelData can bias toward phrases on supported systems.
  Biasing does not constrain output to a hard grammar or guarantee accuracy.
- Feed microphone buffers through AVAudioEngine while listening is enabled.
  Show listening state and provide an immediate stop.
- Handle recognition completion/errors/interruptions. Deduplicate partial/final
  results so a command executes once. Do not assume tasks run indefinitely.
- Combine confidence with command/state validity. Measure false activations
  and missed commands while instruments play.
- Verify airplane-mode operation on a supported iPad. A flag or mocked test
  does not establish real offline recognition.

Finish V1 before implementing these requirements.
