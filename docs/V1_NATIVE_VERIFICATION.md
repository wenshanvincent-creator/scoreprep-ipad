# V1 native verification checkpoint

22 October 2026. V1 remains gated; the full practice goal remains active.

At integration 0b417bf, recognition workflow
[39773048865](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39773048865)
completed real homr recognition successfully. The native harness's four client
and engraving unit checks passed, including the actual homr piano-voice
regression. The three importer bounds guards therefore have native runtime
evidence on this fixture, rather than only source review.

The harness UI run failed while expecting a second notation page after size
changes. Its source-callback and narrow/large-text fixture checks passed. The
recognition workstream is inspecting actual pagination and captures before
changing that scenario. Artifact 12423913685 retains the failed run.

The separate practice foundation ef4525b includes that same integration source.
Its [run 39773187270](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39773187270)
passed 22 pure Core checks, including nine shared-clock transport checks, and
three app-hosted persistence checks. Its reader, recorded-result review and
smoke UI checks passed, but the worker-settings check failed. This does not
verify the later multi-area preparation save or native practice audio/UI.

## Simulator Keychain failure

Independent inspection of artifact 12424201731 found a visible alert reading
“A required entitlement isn't present.” It obscures the first recorded-result
portrait/landscape captures. The settings failure's accessibility snapshot
contains the expected HTTPS address; the save error is the same entitlement
failure. The prior build disabled code signing. The screenshots are failed
acceptance evidence even though the recorded-result test itself passed.

The next build enables ad-hoc simulator signing and supplies an
application-identifier entitlement for the ScorePrep simulator target only.
Keychain's default access group derives from the app's signed entitlements;
credentials continue to use the real Keychain API. There is no credential-file
fallback. See [Apple's entitlement error reference](https://developer.apple.com/documentation/security/errsecmissingentitlement).

The native UI checks now reject alerts over evidence captures and verify the
corrected address before saving. CI exports XCTest failure attachments as well
as direct captures and retains the simulator entitlement receipt. This is
simulator signing without a developer certificate or account; physical-device
and App Store signing remain separate. A new native result and inspected clean
captures must establish the fix before the V1 merge.
