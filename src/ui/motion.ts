/** Motion is allowed only when neither the OS nor the in-app setting asks to reduce it. */
export function motionAllowed(prefersReduced: boolean, settingReduced: boolean): boolean {
  return !(prefersReduced || settingReduced);
}
