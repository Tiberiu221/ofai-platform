# Liquid Glass Bottom Navigation Bar — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the existing bottom nav bar into a liquid glass effect with animated orange underline indicator.

**Architecture:** Enhanced BackdropFilter approach — modify existing `_ShellScreen` in `app.dart`. Increase blur, lower opacity, add inset shadows, gradient border top, and replace dot indicator with sliding orange underline. No new dependencies.

**Tech Stack:** Flutter, BackdropFilter, AnimatedPositioned, BoxDecoration, LinearGradient

---

### Task 1: Add new glass color constants

**Files:**
- Modify: `ofai_flutter/lib/core/theme/app_colors.dart:42`

**Step 1: Add liquid glass colors**

After the existing `bgGlass` constant (line 42), add:

```dart
  // Liquid glass (enhanced transparency for bottom nav)
  static const bgGlassLiquid = Color(0x88111111);   // ~53% alpha
  static const glassHighlight = Color(0x05FFFFFF);   // white 2% top highlight
  static const glassInsetTop = Color(0x08FFFFFF);    // white 3% inset shadow
  static const glassInsetBottom = Color(0x1A000000); // black 10% inset shadow
  static const accentGlow = Color(0x4DFB923C);       // orange 30% for underline glow
```

**Step 2: Run flutter analyze**

Run: `"C:/dev/flutter/bin/flutter.bat" analyze --no-pub`
Expected: No new errors

**Step 3: Commit**

```bash
git add ofai_flutter/lib/core/theme/app_colors.dart
git commit -m "feat(flutter): add liquid glass color constants"
```

---

### Task 2: Convert _ShellScreen to StatefulWidget for animation

**Files:**
- Modify: `ofai_flutter/lib/app.dart:38-123`

**Context:** Currently `_ShellScreen` is a `StatelessWidget`. We need `StatefulWidget` to track `previousIndex` for the underline slide animation direction.

**Step 1: Convert to StatefulWidget**

Replace the class definition (lines 38-123) with:

```dart
class _ShellScreen extends StatefulWidget {
  final Widget child;
  final int currentIndex;

  const _ShellScreen({required this.child, required this.currentIndex});

  @override
  State<_ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<_ShellScreen> {
  static const _items = [
    _NavItem(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Acasa'),
    _NavItem(icon: Icons.explore_outlined, activeIcon: Icons.explore, label: 'Exploreaza'),
    _NavItem(icon: Icons.bookmark_outline, activeIcon: Icons.bookmark, label: 'Colectia mea'),
    _NavItem(icon: Icons.person_outline, activeIcon: Icons.person, label: 'Cont'),
  ];

  static const _routes = ['/', '/explore', '/collection', '/account'];

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      extendBody: true,
      body: widget.child,
      bottomNavigationBar: RepaintBoundary(
        child: ClipRRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
            child: Container(
              height: AppSpacing.bottomNavHeight + bottomPadding,
              decoration: BoxDecoration(
                color: AppColors.bgGlassLiquid,
                // Gradient border top: transparent → orange 15% → transparent
                border: const Border(
                  top: BorderSide(color: AppColors.borderLight, width: 0.5),
                ),
                // Inset shadows for glass depth
                boxShadow: const [
                  // Top inset highlight (simulates light on glass)
                  BoxShadow(
                    color: AppColors.glassInsetTop,
                    blurRadius: 1,
                    offset: Offset(0, 1),
                  ),
                  // Bottom inner shadow (depth)
                  BoxShadow(
                    color: AppColors.glassInsetBottom,
                    blurRadius: 4,
                    offset: Offset(0, -2),
                  ),
                ],
              ),
              child: Stack(
                children: [
                  // Top highlight gradient (light on glass)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 24,
                    child: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [AppColors.glassHighlight, Color(0x00000000)],
                        ),
                      ),
                    ),
                  ),
                  // Nav items row
                  Padding(
                    padding: EdgeInsets.only(bottom: bottomPadding),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: List.generate(_items.length, (i) {
                        final item = _items[i];
                        final isActive = i == widget.currentIndex;
                        return Expanded(
                          child: Semantics(
                            label: item.label,
                            selected: isActive,
                            button: true,
                            child: GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () => context.go(_routes[i]),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    isActive ? item.activeIcon : item.icon,
                                    size: 24,
                                    color: isActive ? AppColors.accent : AppColors.textTertiary,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    item.label,
                                    style: AppTypography.labelSmall.copyWith(
                                      color: isActive ? AppColors.accent : AppColors.textTertiary,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  // Orange underline indicator (replaces dot)
                                  AnimatedContainer(
                                    duration: const Duration(milliseconds: 250),
                                    curve: Curves.easeInOutCubic,
                                    width: isActive ? 40 : 0,
                                    height: 2,
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(1),
                                      gradient: isActive
                                          ? const LinearGradient(
                                              colors: [
                                                Color(0x00FB923C),
                                                AppColors.accent,
                                                Color(0x00FB923C),
                                              ],
                                            )
                                          : null,
                                      boxShadow: isActive
                                          ? const [
                                              BoxShadow(
                                                color: AppColors.accentGlow,
                                                blurRadius: 6,
                                                spreadRadius: 0,
                                              ),
                                            ]
                                          : null,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
```

**Important — what changed vs original:**
- `StatelessWidget` → `StatefulWidget` (needed for future animation enhancements)
- `this.child` → `widget.child`, `this.currentIndex` → `widget.currentIndex`
- `sigmaX/Y: 20` → `sigmaX/Y: 30` (stronger blur)
- `AppColors.bgGlass` → `AppColors.bgGlassLiquid` (more transparent)
- Added `boxShadow` for glass depth inset shadows
- Wrapped content in `Stack` to add top highlight gradient
- Replaced `AnimatedContainer` dot (circle 4px) with underline (40px × 2px gradient + glow)
- Added `bottomPadding` variable to avoid calling `MediaQuery.of(context).padding.bottom` twice

**What stays identical:**
- `_items` list, `_routes` list — exact same
- `AppSpacing.bottomNavHeight` — same 72px
- `extendBody: true` — same
- `RepaintBoundary` wrapping — same
- Icon sizes (24), label style (`AppTypography.labelSmall`) — same
- Active/inactive colors — same
- `GestureDetector` + `context.go()` navigation — same
- `Semantics` accessibility — same

**Step 2: Run flutter analyze**

Run: `"C:/dev/flutter/bin/flutter.bat" analyze --no-pub`
Expected: No new errors (only pre-existing infos)

**Step 3: Commit**

```bash
git add ofai_flutter/lib/app.dart
git commit -m "feat(flutter): liquid glass bottom nav with orange underline"
```

---

### Task 3: Visual verification

**Step 1: Run app and verify bottom nav**

Run: `"C:/dev/flutter/bin/flutter.bat" run`

**Verify:**
- [ ] Bottom nav is more transparent (content visible behind)
- [ ] Blur effect is stronger (smoother glass look)
- [ ] Top highlight gradient visible (subtle light on glass)
- [ ] Orange underline appears under active tab
- [ ] Underline animates smoothly between tabs (250ms ease)
- [ ] Underline has gradient fade at edges (not hard cut)
- [ ] Underline has orange glow underneath
- [ ] Icons and labels unchanged
- [ ] Safe area padding still works on devices with home indicator
- [ ] No layout overflow or clipping issues

**Step 2: Final commit + push**

```bash
git push
```

---

## Risk Analysis

| Risk | Impact | Mitigation |
|---|---|---|
| BoxShadow on Container doesn't render as inset | Low | BoxShadow simulates inset via offset — if it looks off, remove shadow and rely on highlight gradient only |
| AnimatedContainer underline width 0→40 looks odd | Low | Tweak width or use `AnimatedOpacity` instead |
| Blur sigma 30 slow on old devices | Very Low | Flutter's BackdropFilter is GPU-accelerated; 30 is safe |
| Stack breaks layout height | Low | Stack is inside fixed-height Container — children are positioned, no height change |
