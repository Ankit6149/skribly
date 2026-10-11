import { bundledAppIcon, GENERIC_APP_ICON } from '../../notes/bundledAppIcon';
import { useAppAppearance } from '../../settings/appAppearance';

export function WidgetContextIcon({
  processName,
  iconUrl,
}: {
  processName: string;
  iconUrl: string | undefined;
}) {
  const appearance = useAppAppearance();
  const customLogo = appearance.customIcons[processName.trim().toLowerCase()];
  const bundledLogo = bundledAppIcon(processName);
  const logo = customLogo || bundledLogo || iconUrl;
  if (logo) return <img className={`ribbon-app-icon${!customLogo && bundledLogo ? ' flat-app-icon' : appearance.quietIcons ? ' quiet-app-icon' : ''}`} src={logo} alt="" aria-hidden="true" />;

  return <img className="ribbon-app-icon flat-app-icon" src={GENERIC_APP_ICON} alt="" aria-hidden="true" />;
}
