/** SwiftUI springs and easings converted to physical form, and every named animation of the app. */

export interface PhysicalSpring {
  readonly type: 'spring';
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
}

export interface Easing {
  readonly type: 'tween';
  readonly ease: readonly [number, number, number, number];
  readonly duration: number;
  readonly delay?: number;
}

/**
 * SwiftUI `.spring(response:dampingFraction:)` to a physical spring:
 *   stiffness = mass * (2π / response)²
 *   damping   = 4π * dampingFraction * mass / response
 * Derivation: ω₀ = 2π / response (undamped natural frequency), ζ = dampingFraction,
 * k = m·ω₀², c = 2·ζ·√(k·m) = 2·ζ·m·ω₀ = 4π·ζ·m / response.
 */
export function springFromResponse(response: number, dampingFraction: number, mass = 1): PhysicalSpring {
  const omega = (2 * Math.PI) / response;
  return { type: 'spring', stiffness: mass * omega * omega, damping: (4 * Math.PI * dampingFraction * mass) / response, mass };
}

/** SwiftUI `.spring(duration:bounce:)` (bounce >= 0): response = duration, dampingFraction = 1 - bounce. */
export function springFromDurationBounce(duration: number, bounce: number, mass = 1): PhysicalSpring {
  return springFromResponse(duration, 1 - bounce, mass);
}

/** Slowed by the `?debug=motion` time scale: stiffness / t², damping / t. */
export function scaled(spring: PhysicalSpring, timeScale: number): PhysicalSpring {
  return { ...spring, stiffness: spring.stiffness / (timeScale * timeScale), damping: spring.damping / timeScale };
}

export const EASE_OUT = [0, 0, 0.58, 1] as const;
export const EASE_IN_OUT = [0.42, 0, 0.58, 1] as const;

const easeOut = (duration: number, delay?: number): Easing =>
  delay === undefined ? { type: 'tween', ease: EASE_OUT, duration } : { type: 'tween', ease: EASE_OUT, duration, delay };

export const Motion = {
  // NotchState.swift
  open: springFromResponse(0.42, 0.78),
  close: springFromResponse(0.3, 0.92),
  hoverIn: springFromResponse(0.32, 0.55),
  hoverOut: springFromResponse(0.3, 0.85),
  saving: springFromResponse(0.45, 0.82),
  schedule: springFromResponse(0.38, 0.8), // NotchLayout.sectionAnimation, drives every section
  contentIn: easeOut(0.2, 0.16),
  contentOut: easeOut(0.12),
  reduced: easeOut(0.15),
  // HoverButtonStyle.swift
  hoverScale: springFromDurationBounce(0.22, 0.12),
  highlight: easeOut(0.12),
  press: springFromDurationBounce(0.14, 0),
  // BottomBar.swift
  flag: springFromResponse(0.25, 0.7),
  canSave: { type: 'tween', ease: EASE_IN_OUT, duration: 0.18 } as Easing,
  // QuickReminderView.swift
  chip: springFromResponse(0.3, 0.8),
  suggestion: easeOut(0.18),
  error: easeOut(0.2),
  // SavedCheckView.swift
  tickTrim: easeOut(0.28, 0.32),
  badgeBounce: springFromResponse(0.28, 0.45), // delay 0.55 s, to 1.18x
  badgeSettle: springFromResponse(0.3, 0.7), // delay 0.72 s, to 1x
  // NotchContainerView.swift
  badgeFade: easeOut(0.16),
  // NotchButtonStyles.swift
  sectionIn: easeOut(0.12),
  sectionOut: easeOut(0.1),
  stagger: (index: 0 | 1 | 2 | 3): Easing => easeOut(0.24, 0.06 + index * 0.035),
  // ScheduleMonthGrid.swift / ScheduleNotchSection.swift
  monthPage: easeOut(0.15),
  focusRing: easeOut(0.15),
  calendarScroll: easeOut(0.25),
  // Contracts section 7 (no Swift counterpart)
  regularBottomIn: easeOut(0.18, 0.12),
  regularBottomOut: easeOut(0.08),
  calendarIn: easeOut(0.12), // section transition, content enters from y -8
  dismiss: easeOut(0.15),
} as const;
