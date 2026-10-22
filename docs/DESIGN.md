# SiteTrack visual system

Reference: Design System Core, originally supplied at https://uiuxshowcase.com/resources/design-system-core/ and displayed at https://www.designsystemcore.com/.

The implementation adapts the reference's visible website styling to construction management. It is original React/CSS/vector code; it does not claim to contain the licensed Core Figma component library.

| Reference element | SiteTrack implementation |
| --- | --- |
| Surface level 1 `#0d1117` | Page background, app shell and login |
| Surface level 2 `#131922` | Forms, metric cards and data panels |
| Primary `#fcbf02` | Primary actions, highlighted hero copy and brand dot |
| Text `#c2d2ef` | Supporting copy and secondary labels |
| Border `#1c2532` | Quiet card, navigation and table boundaries |
| Purple announcement pill | Login introduction, dashboard introduction and status badges |
| Blue outlined components | Original vector composition, navigation selection, controls and progress indicators |
| Bold geometric type | Manrope headings and Inter body text; freely available alternatives to the reference's Archia/Basier Circle fonts |

The visual theme is isolated in `app/core-theme.css` and loaded after the baseline styles. It applies throughout all fourteen modules. Login and dashboard have dedicated compositions, using the shared `CoreArtwork` component. Decorative graphics are marked aria-hidden and never represent project data. Dashboard statistics and progress continue to come from the existing data queries.

The desktop layout uses paired content and form columns; mobile reflows the login, hero, toolbars, metrics and panels. Dense data tables scroll within their own containers.

This is a visual update. The previously prepared database migration and its approval gate are independent of it.
