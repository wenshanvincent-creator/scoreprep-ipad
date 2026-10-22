# V1 integration UI plan

The main action is to recognize an imported original, compare the resulting
notation with its source, then read the saved edition. Follow the installed
mobile-ios-design, swiftui-expert-skill and frontend-design process.

The existing reader's Review action opens a native sheet. Its top-level states
are not configured, ready to recognize, processing, failed, and saved edition.
Processing shows completed source pages and keeps the original accessible.
The score remains the main surface. Original/Clean controls and per-source-page
review actions sit in compact native chrome. A rejected page keeps its source
view available. A result is not labelled reviewed until the user accepts it.

The worker client supplies transient job/progress state. ScoreLibrary owns saved
originals and editions. The review sheet owns its selected source page; the
Verovio component owns rendered page/size state. Navigating to another project
must not apply a previous project's recognition result.

For this open-source engineering preview, a separate connection sheet accepts
a private HTTPS worker URL and access token. Store the pair in Keychain, never
score JSON, logs or a bundled resource. The UI explains that initial conversion
uses that worker while saved editions open offline. No server is preconfigured.

Use semantic text, labelled buttons, native sheets/toolbars and flexible layout.
Wide layouts may show original/clean side by side; narrow layouts switch the
selected view. No decorative animation, silent failure, fake percentages or
automatic recognition upon opening a library item. Do not add voice or following.

Inspect actual portrait/landscape screenshots and verify original comparison,
review state and offline reopen. Cloud recognition output and native component
tests alone do not establish the integrated flow or a production deployment.
