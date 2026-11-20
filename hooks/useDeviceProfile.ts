'use client';

import { useSyncExternalStore } from 'react';

export type DeviceFormFactor =
  | 'flip-cover'
  | 'phone-portrait'
  | 'phone-landscape'
  | 'fold-flex'
  | 'fold-unfolded'
  | 'tablet'
  | 'desktop';

export type PadLayoutMode = 'hidden' | 'bottom-deck' | 'side-flanks';

export interface DeviceProfile {
  width: number;
  height: number;
  hasTouch: boolean;
  hasFinePointer: boolean;
  isLandscape: boolean;
  isVerticalFold: boolean;
  isHorizontalFold: boolean;
  formFactor: DeviceFormFactor;
  recommendedPadLayout: PadLayoutMode;
  compactUi: boolean;
  preferMouseSteer: boolean;
}

const SERVER_SNAPSHOT: DeviceProfile = {
  width: 1280,
  height: 800,
  hasTouch: false,
  hasFinePointer: true,
  isLandscape: true,
  isVerticalFold: false,
  isHorizontalFold: false,
  formFactor: 'desktop',
  recommendedPadLayout: 'hidden',
  compactUi: false,
  preferMouseSteer: true,
};

let cachedProfile: DeviceProfile = SERVER_SNAPSHOT;

function computeDeviceProfile(): DeviceProfile {
  if (typeof window === 'undefined') return SERVER_SNAPSHOT;

  const width = Math.round(window.visualViewport?.width ?? window.innerWidth);
  const height = Math.round(window.visualViewport?.height ?? window.innerHeight);
  const isLandscape = width > height;

  const mqCoarse = window.matchMedia?.('(any-pointer: coarse)').matches ?? false;
  const mqPrimaryCoarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const mqFine = window.matchMedia?.('(any-pointer: fine)').matches ?? false;
  const mqPrimaryFine = window.matchMedia?.('(pointer: fine)').matches ?? true;
  const mqVerticalFold = window.matchMedia?.('(vertical-viewport-segments: 2)').matches ?? false;
  const mqHorizontalFold = window.matchMedia?.('(horizontal-viewport-segments: 2)').matches ?? false;

  const maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIPadOS =
    typeof navigator !== 'undefined' &&
    navigator.platform === 'MacIntel' &&
    maxTouchPoints > 1;
  const isMobileUa = /Android|iPhone|iPad|iPod|Mobile|Silk|SM-T|SM-X|Pixel|Fold|Flip/i.test(ua);

  const hasTouch = mqCoarse || maxTouchPoints > 0 || isIPadOS;
  const hasFinePointer = mqFine || (!hasTouch && mqPrimaryFine);

  const aspect = height > 0 ? width / height : 1;
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);

  let formFactor: DeviceFormFactor = 'desktop';

  if (mqVerticalFold && hasTouch) {
    // Flip phone or Pixel Fold half-folded in Flex / tabletop mode (top & bottom segments)
    formFactor = 'fold-flex';
  } else if (width <= 430 && height <= 470) {
    // Flip phone closed outer cover screen (Z Flip / Razr cover display)
    formFactor = 'flip-cover';
  } else if (
    hasTouch &&
    (mqHorizontalFold || (minDim >= 580 && maxDim <= 1080 && aspect >= 0.78 && aspect <= 1.28))
  ) {
    // Unfolded book-style foldable (Pixel 10 Pro Fold / Galaxy Z Fold inner square display)
    formFactor = 'fold-unfolded';
  } else if (hasTouch && height <= 520 && isLandscape && width <= 980) {
    // Standard phone or folded Pixel Fold rotated into landscape
    formFactor = 'phone-landscape';
  } else if (width < 640 && !isLandscape) {
    // Standard smartphone or folded foldable cover screen in portrait
    formFactor = 'phone-portrait';
  } else if (
    hasTouch &&
    (isIPadOS ||
      mqPrimaryCoarse ||
      isMobileUa ||
      (width >= 640 && width <= 1400 && maxTouchPoints > 0 && !mqPrimaryFine))
  ) {
    // iPad, Samsung Galaxy Tab, or touch-first tablet
    formFactor = 'tablet';
  } else {
    formFactor = 'desktop';
  }

  let recommendedPadLayout: PadLayoutMode = 'hidden';
  if (formFactor === 'flip-cover' || formFactor === 'phone-portrait' || formFactor === 'fold-flex') {
    recommendedPadLayout = 'bottom-deck';
  } else if (formFactor === 'phone-landscape') {
    recommendedPadLayout = 'side-flanks';
  } else if (formFactor === 'fold-unfolded') {
    // Pixel 10 Pro Fold unfolded: side flanks when wider than tall, bottom deck when square/tall
    recommendedPadLayout = width >= height + 36 ? 'side-flanks' : 'bottom-deck';
  } else if (formFactor === 'tablet') {
    // iPads & Samsung Tablets: side-flanks in landscape (Switch-like ergonomics), bottom-deck in portrait
    recommendedPadLayout = isLandscape && width >= 820 ? 'side-flanks' : 'bottom-deck';
  } else {
    recommendedPadLayout = 'hidden';
  }

  const compactUi = formFactor === 'flip-cover' || formFactor === 'phone-landscape';
  const preferMouseSteer = hasFinePointer && (formFactor === 'desktop' || mqPrimaryFine);

  if (
    cachedProfile.width === width &&
    cachedProfile.height === height &&
    cachedProfile.hasTouch === hasTouch &&
    cachedProfile.hasFinePointer === hasFinePointer &&
    cachedProfile.isLandscape === isLandscape &&
    cachedProfile.isVerticalFold === mqVerticalFold &&
    cachedProfile.isHorizontalFold === mqHorizontalFold &&
    cachedProfile.formFactor === formFactor &&
    cachedProfile.recommendedPadLayout === recommendedPadLayout &&
    cachedProfile.compactUi === compactUi &&
    cachedProfile.preferMouseSteer === preferMouseSteer
  ) {
    return cachedProfile;
  }

  cachedProfile = {
    width,
    height,
    hasTouch,
    hasFinePointer,
    isLandscape,
    isVerticalFold: mqVerticalFold,
    isHorizontalFold: mqHorizontalFold,
    formFactor,
    recommendedPadLayout,
    compactUi,
    preferMouseSteer,
  };
  return cachedProfile;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const onUpdate = () => {
    computeDeviceProfile();
    callback();
  };

  window.addEventListener('resize', onUpdate);
  window.addEventListener('orientationchange', onUpdate);
  window.visualViewport?.addEventListener('resize', onUpdate);

  const mqs = [
    window.matchMedia?.('(pointer: coarse)'),
    window.matchMedia?.('(any-pointer: coarse)'),
    window.matchMedia?.('(pointer: fine)'),
    window.matchMedia?.('(any-pointer: fine)'),
    window.matchMedia?.('(vertical-viewport-segments: 2)'),
    window.matchMedia?.('(horizontal-viewport-segments: 2)'),
  ].filter(Boolean) as MediaQueryList[];

  for (const mq of mqs) {
    mq.addEventListener?.('change', onUpdate);
  }

  return () => {
    window.removeEventListener('resize', onUpdate);
    window.removeEventListener('orientationchange', onUpdate);
    window.visualViewport?.removeEventListener('resize', onUpdate);
    for (const mq of mqs) {
      mq.removeEventListener?.('change', onUpdate);
    }
  };
}

function getSnapshot(): DeviceProfile {
  return computeDeviceProfile();
}

function getServerSnapshot(): DeviceProfile {
  return SERVER_SNAPSHOT;
}

export function useDeviceProfile(): DeviceProfile {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
