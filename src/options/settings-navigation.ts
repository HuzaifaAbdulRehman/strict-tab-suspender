export interface SettingsNavigationPort {
  close(): void;
  navigateToPopup(): void;
  scheduleFallback(callback: () => void): void;
}

export function returnFromSettings(port: SettingsNavigationPort): void {
  port.close();
  port.scheduleFallback(() => port.navigateToPopup());
}
