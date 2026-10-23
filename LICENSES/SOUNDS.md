# Sounds – sources & licenses (Lantern Prowl)

All 101 sounds are real recordings released under **CC0 1.0** (https://creativecommons.org/publicdomain/zero/1.0/), reused unchanged from earlier games of this series where each source page was checked for CC0 1.0. No synthesizer, no oscillators, no beeps. `tools/build.mjs` embeds them as base64 into `js/sounds-src.js`, so the game also runs via `file://`. The rooftop echo is a generated convolution impulse (processing only). Credit is not required for CC0 and is given voluntarily, by source ID only.

## Cat, steps and pickups
| File | Used for | Source |
|---|---|---|
| meow | the cat on the start screen / landing after the leap | Freesound #756236 (CC0) |
| purr | the cat in kids mode / the end screen | Freesound #424355 (CC0) |
| step_soft_L1, step_soft_L2, step_soft_R1 | soft paws on the roof slates | Fantozzi footsteps, OpenGameArt (CC0) |
| swish_a, swish_b | lane switches, "Whisker close!" near misses | Freesound #463763 (CC0) |
| chime_a, chime_b, chime_c | lighting a jack-o'-lantern (rising chain), wisps | Freesound #418164, #119543, #660493 (CC0) |
| wing, flap_1, whoosh, swoosh_rise, fwoosh | jumps, double jumps, slides, the broom | Freesound #389634, #177242, #264777, #580967, #557812 (CC0) |
| impact, thud_a | bumping into chimneys, landing | Kenney "Impact Sounds" (CC0 1.0, see Kenney-Impact-Sounds-License.txt) |
| thump, thump_b, body_fall, crack, crumble, stone_1, stone_2, gravel_1 | landings, gargoyle smash, falling off the roof | Freesound #529396, #60013, #264062, #157804, #262118, #265580, #179341, #155934 (CC0) |

## The Moonlight Leap and the town igniting
| File | Source |
|---|---|
| riser, stinger, sub, boom, boom_bass, boom_cine, hit_dram, rumble | Freesound #822419, #754771, #428073, #264031, #268084, #255111, #222517 (CC0) |
| fw_burst, fw_burst_b, fw_crackle | Freesound #587184, #335983, #505264 (CC0) |
| choir_ah, choir_swell, magic, success, cheer, laugh_kids, harp | Freesound #764330, #458146, #249819, #615099, #32260, #754399, #610703 (CC0) |
| bell_deep, bell_strike, bell_far | Freesound #240586, #219047, #341866 (CC0) – the clock tower |

## Night ambience
| File | Source |
|---|---|
| night_loop, eerie_loop, wind, torch_loop | Freesound #251340, #32805, #159509, #437475, #481139, #697217, #483316 (CC0) |
| owl, howl, crow, whisper, boo, ghosts, creak_1 | Freesound #558214, #398430, #404687, #175944, #607205, #763804, #254735 (CC0) |
| bats, bat_swarm | Freesound #546823, #245768 (CC0) |
| thunder_big, thunder_soft | Freesound #243614, #244053 (CC0) |

## Music – VSCO 2 Community Edition (CC0 1.0)
https://github.com/sgossner/VSCO-2-CE – trimmed, faded and loudness-matched; the game re-pitches the nearest recorded note. Original music written for this game (D minor), sequenced note by note.

| Files | Instrument |
|---|---|
| org_48 … org_75 (10), ped_24 … ped_42 (7) | pipe organ manual and pedal |
| pz_D3 … pz_D5 (6), cb_E1 … cb_Fs1 (5) | violin and contrabass pizzicato |
| hp_D4, hp_A4, glissup | harp, harp glissando |
| tp_1 … tp_4, tproll, bd, crash, gong, cymcresc | timpani, bass drum, cymbals, gong |

Code: three.js (MIT, see three.js-MIT.txt). Font: Fredoka (SIL Open Font License 1.1, see Fredoka-OFL.txt).
