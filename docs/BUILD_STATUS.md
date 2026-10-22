# First native build

The later accepted V1 checkpoint is recorded in
[V1_NATIVE_VERIFICATION.md](V1_NATIVE_VERIFICATION.md). The evidence below is
the original foundation checkpoint, not the final practice-preview result.

Verified on 22 October 2026 at commit
792a59e5e90a1a26805a8d484401c85cf1f15a42.

[Successful macOS workflow](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39743968563)

- Xcode 16.4, build 16F6.
- iOS 18.5 simulator, iPad Pro 11-inch (M4).
- Ten ScoreCore tests passed with zero failures.
- The native app compiled and one UI smoke test passed with zero failures.
- The smoke test opened the generated sample score and its timing editor.
- A simulator screenshot was retrieved and visually inspected.

The screenshot shows original source notation in three reading areas with
their calculated 12-second durations. It is a simulator capture, not a
design mockup.

![First iPad simulator build](assets/first-ipad-simulator.png)

Sound output, imported real-world score variety, Pencil input, Bluetooth
pedals, continuous metronome/line synchronization and TestFlight installation
have not been validated by this run. The continuous metronome and annotation
features remain roadmap work.
