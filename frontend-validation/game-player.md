# Embedded game player validation

Verified locally on 2026-10-03 with Chrome and macOS Safari 26.2 and an isolated temporary SQLite database. No deployment or production data changes.

## Behavior

- Project cards have a primary Play button; clicking the card also opens the player. Modified link clicks retain normal new-tab behavior.
- A sandboxed external iframe loads only when requested. Closing or switching removes the previous iframe, ending that game session.
- The player provides Fullscreen (when supported), Vote while voting is open, Next game with wraparound, and an always-visible external link.
- Close and Escape restore gallery position and opener focus. A live event phase change preserves the current iframe and updates vote availability.
- Both CSP policies permit HTTP(S) frames; the site's script restrictions and anti-framing headers remain in place. Same-origin submissions use the external-link fallback.
- Cross-origin load events do not prove successful rendering. The player keeps a fallback link visible and offers a delayed hint if loading stalls.

## Verified

- The supplied Catch the Star URL renders inside the local application. Started a round, clicked a star, and observed score 1.
- Fullscreen enters and exits. Voting from fullscreen exits fullscreen and opens the existing vote dialog.
- A local test vote succeeds, preserves the game, and displays confirmation in the player. Vote replacement confirmation also works.
- Next game changes the iframe and title; the last fixture wraps to the first.
- Same-origin fallback shows instructions and the correct external link without creating an iframe.
- Closing removes the iframe and restores focus. Escape closes the player.
- Closing voting through the temporary database hides Vote while preserving the open game.
- Safari 26.2: opened the gallery with both submissions and voting closed, played the supplied game, and observed score 1. Next game and wraparound work with voting closed. Native fullscreen entry and exit succeeded on the later check; an earlier request was rejected while gameplay continued. Rejected fullscreen requests now expand the player to the browser window, with Restore size available.
- Safari: opening and closing voting automatically updates the player controls without restarting the current game. Polling now runs even when the gallery was initially opened outside voting, and also refreshes when accepted-project count or submission status changes.
- Non-voting phases display Free play and hide Vote. Playing remains available before voting, after voting closes, and after results publication. Only accepted submissions are public.
- Desktop, 390px mobile, and 320px narrow layouts inspected. At 320px the controls remain visible with no player overflow.
- All 12 integration tests pass. The additional test covers accepted-game access across three non-voting phases, unpublished score restrictions, pending-project exclusion, and rejected votes while voting is closed. The frontend test covers matching frame policies and retained script/anti-framing restrictions.
- JavaScript syntax and git whitespace checks pass.

## Preview and limits

The local preview is http://127.0.0.1:4613/gallery while its process remains running. It includes the supplied game, a second copy for Next game testing, and a same-origin fallback fixture. These records live only in the temporary preview database.

Screenshots: `game-player-desktop.png`, `game-player-320.png`, and `game-player-safari.png`. The preview is left with voting closed for free play.

No Firefox, physical iPhone/iPad, or screen-reader testing. Safari's dialog and dynamic viewport support shipped in 15.4; unprefixed native fullscreen shipped for macOS/iPadOS in 16.4. Native fullscreen is feature-detected and optional; the mobile player already fills the browser viewport. Third-party sites may still refuse framing or need capabilities outside this sandbox; those games can use the external link. Browser responsive testing does not add touch controls to games that require a keyboard.
