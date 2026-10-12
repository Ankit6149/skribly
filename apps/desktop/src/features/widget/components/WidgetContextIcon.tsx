import { bundledAppIcon } from '../../notes/bundledAppIcon';
import { BundledAppMark } from '../../notes/components/BundledAppMark';
import { useAppAppearance } from '../../settings/appAppearance';

export function WidgetContextIcon({
  processName,
  iconUrl,
  contextTitle = '',
}: {
  processName: string;
  iconUrl: string | undefined;
  contextTitle?: string;
}) {
  const appearance = useAppAppearance();
  const customLogo = appearance.customIcons[processName.trim().toLowerCase()];
  const bundledLogo = bundledAppIcon(processName);
  void iconUrl;
  if (customLogo) return <img className={`ribbon-app-icon${appearance.quietIcons ? ' quiet-app-icon' : ''}`} src={customLogo} alt="" aria-hidden="true" />;
  return <BundledAppMark className="ribbon-app-icon flat-app-icon" src={bundledLogo} processName={processName} contextTitle={contextTitle} />;
}
