/** Viewport breakpoints shared by dashboard screens and navigation. */
export const MOBILE_BREAKPOINT = 768;
export const DESKTOP_BREAKPOINT = 1024;
export const SMALL_PHONE_BREAKPOINT = 420;

export const getResponsiveLayout = (width: number) => ({
  isMobile: width < MOBILE_BREAKPOINT,
  isTablet: width >= MOBILE_BREAKPOINT && width < DESKTOP_BREAKPOINT,
  isDesktop: width >= DESKTOP_BREAKPOINT,
  isCompactShell: width < DESKTOP_BREAKPOINT,
  isSmallPhone: width < SMALL_PHONE_BREAKPOINT,
});
