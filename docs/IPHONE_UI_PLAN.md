# iPhone and TestFlight preparation

Keep the existing paper-white score, ink #18242C, rehearsal blue #285E79,
interface gray #F2F4F6 and active amber #D59B2D. Native semantic San Francisco
type belongs to controls; the source score retains its own typography.

On iPhone, Library → Score → full-screen Practice is a single navigation path.
Use the split view's native collapsed navigation, starting at the library on a
fresh install. Importing or opening the generated exercise selects its reader.
The iPad keeps its existing broad score and sidebar behavior.

Portrait practice has a compact two-row transport. Landscape should fit one
transport row when its actual width permits, leaving vertical room for music.
Status and area headings wrap when necessary. At accessibility text sizes the
transport remains a two-by-two grid, with speed/sound in Practice options.
State stays in the existing controller when layout changes. Touch targets stay
at least 44 points. No new timer or musical timing model.

Review: the score is the main surface, not a collection of cards. Adapt existing
native components rather than introduce a phone-specific theme. Inspect native
iPhone portrait, landscape and accessibility screenshots before acceptance.
Also preserve the existing iPad validation job. Add a focused phone navigation,
preparation and playback test to catch unreachable controls and navigation loss.

Distribution uses a separate Xcode 26 release lane because Apple's current
upload rules require that SDK. Keep deployment target iOS 18 and the existing
Xcode 16.4 iPad regression lane. Unsigned archive preparation needs no account;
signed upload requires the owner's active membership and private signing assets.
